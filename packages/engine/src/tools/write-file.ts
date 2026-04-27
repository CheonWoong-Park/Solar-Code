import { writeAtomic } from '@solar-code/core';
import { dirname } from 'path';
import { mkdirSync } from 'fs';
import { resolveWorkspacePath } from './path.js';
import type { ToolExecutor, ToolExecutionContext, ToolResult } from './types.js';

function stringArg(args: Record<string, unknown>, name: string): string {
  const value = args[name];
  if (typeof value !== 'string') {
    throw new Error(`Missing required string argument: ${name}`);
  }
  return value;
}

export const writeFileTool: ToolExecutor = {
  name: 'write_file',
  permission: 'write',
  definition: {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a UTF-8 text file in the workspace.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', description: 'File path relative to the workspace.' },
          content: { type: 'string', description: 'Full file content to write.' },
        },
        required: ['path', 'content'],
      },
    },
  },
  describe(args) {
    return String(args['path'] ?? '');
  },
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const rawPath = stringArg(args, 'path');
    const content = stringArg(args, 'content');
    const path = resolveWorkspacePath(context.cwd, rawPath);
    mkdirSync(dirname(path), { recursive: true });
    writeAtomic(path, content);
    return { ok: true, output: `Wrote ${content.length} chars to ${rawPath}` };
  },
};
