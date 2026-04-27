import { readdirSync, statSync } from 'fs';
import { basename, join, relative } from 'path';
import { displayPath, normalizePathForMatch, resolveWorkspacePath } from './path.js';
import type { ToolExecutor, ToolExecutionContext, ToolResult } from './types.js';

const DEFAULT_IGNORES = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);

function stringArg(args: Record<string, unknown>, name: string): string {
  const value = args[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required string argument: ${name}`);
  }
  return value;
}

function numberArg(args: Record<string, unknown>, name: string, fallback: number, max: number): number {
  const value = args[name];
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), max);
}

function escapeRegex(char: string): string {
  return /[\\^$+?.()|[\]{}]/.test(char) ? `\\${char}` : char;
}

export function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, '/');
  let source = '^';
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const next = normalized[i + 1];
    const afterNext = normalized[i + 2];
    if (char === '*' && next === '*' && afterNext === '/') {
      source += '(?:.*/)?';
      i += 2;
    } else if (char === '*' && next === '*') {
      source += '.*';
      i += 1;
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += escapeRegex(char);
    }
  }
  source += '$';
  return new RegExp(source);
}

function collectFiles(root: string, includeHidden: boolean, maxResults: number): string[] {
  const results: string[] = [];
  const visit = (dir: string): void => {
    if (results.length >= maxResults) return;
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (results.length >= maxResults) return;
      if (!includeHidden && entry.name.startsWith('.')) continue;
      if (DEFAULT_IGNORES.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.isFile()) results.push(fullPath);
    }
  };
  visit(root);
  return results;
}

export const globTool: ToolExecutor = {
  name: 'glob',
  permission: 'read',
  definition: {
    type: 'function',
    function: {
      name: 'glob',
      description: 'Find files by glob pattern in the workspace. node_modules, dist, build, coverage, and .git are ignored.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          pattern: { type: 'string', description: 'Glob pattern such as **/*.ts or packages/*/package.json.' },
          path: { type: 'string', description: 'Directory to search from. Defaults to workspace root.' },
          include_hidden: { type: 'boolean', description: 'Include hidden files and directories. Defaults to false.' },
          max_results: { type: 'number', description: 'Maximum file results. Defaults to 100 and is capped at 1000.' },
        },
        required: ['pattern'],
      },
    },
  },
  describe(args) {
    return stringArg(args, 'pattern');
  },
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const pattern = stringArg(args, 'pattern');
    const searchRoot = resolveWorkspacePath(context.cwd, typeof args['path'] === 'string' ? args['path'] : '.');
    if (!statSync(searchRoot).isDirectory()) return { ok: false, output: '', error: `Not a directory: ${args['path'] ?? '.'}` };

    const includeHidden = args['include_hidden'] === true;
    const maxResults = numberArg(args, 'max_results', 100, 1000);
    const matcher = globToRegExp(pattern);
    const hasSlash = pattern.includes('/') || pattern.includes('\\');
    const matches = collectFiles(searchRoot, includeHidden, 10_000)
      .filter((fullPath) => {
        const relToCwd = normalizePathForMatch(relative(context.cwd, fullPath));
        const relToRoot = normalizePathForMatch(relative(searchRoot, fullPath));
        return matcher.test(hasSlash ? relToCwd : basename(fullPath)) || matcher.test(relToRoot);
      })
      .slice(0, maxResults)
      .map((fullPath) => displayPath(context.cwd, fullPath));

    return {
      ok: true,
      output: matches.length ? matches.join('\n') : '(no matches)',
    };
  },
};
