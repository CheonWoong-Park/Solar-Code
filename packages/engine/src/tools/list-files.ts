import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { displayPath, resolveWorkspacePath } from './path.js';
import type { ToolExecutor, ToolExecutionContext, ToolResult } from './types.js';

const DEFAULT_IGNORES = new Set(['.git', 'node_modules']);

function numberArg(args: Record<string, unknown>, name: string, fallback: number, max: number): number {
  const value = args[name];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback;
  return Math.min(Math.floor(value), max);
}

function listEntries(root: string, cwd: string, includeHidden: boolean, recursive: boolean, maxDepth: number): string[] {
  const results: string[] = [];
  const visit = (dir: string, depth: number): void => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const entry of entries) {
      if (!includeHidden && entry.name.startsWith('.')) continue;
      if (DEFAULT_IGNORES.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      results.push(`${displayPath(cwd, fullPath)}${entry.isDirectory() ? '/' : ''}`);
      if (recursive && entry.isDirectory() && depth < maxDepth) visit(fullPath, depth + 1);
    }
  };
  visit(root, 0);
  return results;
}

export const listFilesTool: ToolExecutor = {
  name: 'list_files',
  permission: 'read',
  definition: {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files and directories under a workspace path.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', description: 'Directory path relative to the workspace. Defaults to root.' },
          recursive: { type: 'boolean', description: 'List recursively. Defaults to false.' },
          max_depth: { type: 'number', description: 'Maximum recursion depth. Defaults to 2 and is capped at 10.' },
          include_hidden: { type: 'boolean', description: 'Include hidden files. Defaults to false.' },
        },
      },
    },
  },
  describe(args) {
    return String(args['path'] ?? '.');
  },
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const rawPath = typeof args['path'] === 'string' ? args['path'] : '.';
    const path = resolveWorkspacePath(context.cwd, rawPath);
    if (!existsSync(path)) return { ok: false, output: '', error: `Path not found: ${rawPath}` };
    if (!statSync(path).isDirectory()) return { ok: false, output: '', error: `Not a directory: ${rawPath}` };

    const results = listEntries(
      path,
      context.cwd,
      args['include_hidden'] === true,
      args['recursive'] === true,
      numberArg(args, 'max_depth', 2, 10)
    );
    return { ok: true, output: results.length ? results.join('\n') : '(empty directory)' };
  },
};
