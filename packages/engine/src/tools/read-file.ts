import { existsSync, readFileSync, statSync } from 'fs';
import { resolveWorkspacePath } from './path.js';
import type { ToolExecutor, ToolExecutionContext, ToolResult } from './types.js';

function stringArg(args: Record<string, unknown>, name: string): string {
  const value = args[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required string argument: ${name}`);
  }
  return value;
}

function optionalPositiveInt(args: Record<string, unknown>, name: string, fallback: number, max: number): number {
  const value = args[name];
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), max);
}

export const readFileTool: ToolExecutor = {
  name: 'read_file',
  permission: 'read',
  definition: {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a UTF-8 text file from the workspace with line numbers.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', description: 'File path relative to the workspace.' },
          offset: { type: 'number', description: '1-based starting line. Defaults to 1.' },
          limit: { type: 'number', description: 'Maximum lines to read. Defaults to 200 and is capped at 1000.' },
        },
        required: ['path'],
      },
    },
  },
  describe(args) {
    return stringArg(args, 'path');
  },
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const path = resolveWorkspacePath(context.cwd, stringArg(args, 'path'));
    if (!existsSync(path)) return { ok: false, output: '', error: `File not found: ${args['path']}` };
    if (!statSync(path).isFile()) return { ok: false, output: '', error: `Not a file: ${args['path']}` };

    const offset = optionalPositiveInt(args, 'offset', 1, Number.MAX_SAFE_INTEGER);
    const limit = optionalPositiveInt(args, 'limit', 200, 1000);
    const text = readFileSync(path, 'utf-8');
    const lines = text.split(/\r?\n/);
    const start = Math.max(offset - 1, 0);
    const selected = lines.slice(start, start + limit);
    const width = String(start + selected.length).length;
    const numbered = selected.map((line, index) => {
      const lineNo = String(start + index + 1).padStart(width, ' ');
      return `${lineNo}| ${line}`;
    });
    const suffix = start + limit < lines.length ? `\n[showing ${selected.length} of ${lines.length} lines]` : '';

    return { ok: true, output: numbered.join('\n') + suffix };
  },
};
