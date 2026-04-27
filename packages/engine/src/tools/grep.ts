import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, join, relative } from 'path';
import { globToRegExp } from './glob.js';
import { displayPath, normalizePathForMatch, resolveWorkspacePath } from './path.js';
import type { ToolExecutor, ToolExecutionContext, ToolResult } from './types.js';

const DEFAULT_IGNORES = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);
const MAX_FILE_BYTES = 1_000_000;

function stringArg(args: Record<string, unknown>, name: string): string {
  const value = args[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required string argument: ${name}`);
  }
  return value;
}

function numberArg(args: Record<string, unknown>, name: string, fallback: number, max: number): number {
  const value = args[name];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback;
  return Math.min(Math.floor(value), max);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectFiles(root: string, includeHidden: boolean, maxFiles: number): string[] {
  const results: string[] = [];
  const visit = (dir: string): void => {
    if (results.length >= maxFiles) return;
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (results.length >= maxFiles) return;
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

function matchesInclude(cwd: string, fullPath: string, include?: string): boolean {
  if (!include) return true;
  const matcher = globToRegExp(include);
  const rel = normalizePathForMatch(relative(cwd, fullPath));
  return matcher.test(rel) || matcher.test(basename(fullPath));
}

export const grepTool: ToolExecutor = {
  name: 'grep',
  permission: 'read',
  definition: {
    type: 'function',
    function: {
      name: 'grep',
      description: 'Search text in workspace files. Returns file paths, line numbers, and optional context.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          pattern: { type: 'string', description: 'Text or regex pattern to search for.' },
          path: { type: 'string', description: 'Directory or file path to search. Defaults to workspace root.' },
          regex: { type: 'boolean', description: 'Treat pattern as a JavaScript regex. Defaults to false.' },
          case_sensitive: { type: 'boolean', description: 'Case-sensitive search. Defaults to false.' },
          include: { type: 'string', description: 'Optional file glob filter, such as **/*.ts.' },
          include_hidden: { type: 'boolean', description: 'Include hidden files and directories. Defaults to false.' },
          context: { type: 'number', description: 'Context lines before and after matches. Defaults to 0, capped at 5.' },
          max_results: { type: 'number', description: 'Maximum matches. Defaults to 50, capped at 200.' },
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
    const searchPath = resolveWorkspacePath(context.cwd, typeof args['path'] === 'string' ? args['path'] : '.');
    if (!existsSync(searchPath)) return { ok: false, output: '', error: `Path not found: ${args['path'] ?? '.'}` };

    const regex = new RegExp(args['regex'] === true ? pattern : escapeRegExp(pattern), args['case_sensitive'] === true ? '' : 'i');
    const contextLines = numberArg(args, 'context', 0, 5);
    const maxResults = numberArg(args, 'max_results', 50, 200);
    const include = typeof args['include'] === 'string' ? args['include'] : undefined;
    const includeHidden = args['include_hidden'] === true;
    const stat = statSync(searchPath);
    const files = stat.isFile() ? [searchPath] : collectFiles(searchPath, includeHidden, 10_000);
    const results: string[] = [];

    for (const file of files) {
      if (results.length >= maxResults) break;
      if (!matchesInclude(context.cwd, file, include)) continue;
      const fileStat = statSync(file);
      if (fileStat.size > MAX_FILE_BYTES) continue;
      let text: string;
      try {
        text = readFileSync(file, 'utf-8');
      } catch {
        continue;
      }
      if (text.includes('\u0000')) continue;
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (results.length >= maxResults) break;
        regex.lastIndex = 0;
        if (!regex.test(lines[i])) continue;
        const rel = displayPath(context.cwd, file);
        if (contextLines === 0) {
          results.push(`${rel}:${i + 1}: ${lines[i]}`);
          continue;
        }
        const start = Math.max(0, i - contextLines);
        const end = Math.min(lines.length - 1, i + contextLines);
        const block = [];
        for (let lineIndex = start; lineIndex <= end; lineIndex++) {
          const marker = lineIndex === i ? '>' : ' ';
          block.push(`${rel}:${lineIndex + 1}${marker} ${lines[lineIndex]}`);
        }
        results.push(block.join('\n'));
      }
    }

    return { ok: true, output: results.length ? results.join('\n') : '(no matches)' };
  },
};
