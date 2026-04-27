import { existsSync, readFileSync, statSync } from 'fs';
import { writeAtomic } from '@solar-code/core';
import { resolveWorkspacePath } from './path.js';
import type { ToolExecutor, ToolExecutionContext, ToolResult } from './types.js';

function stringArg(args: Record<string, unknown>, name: string): string {
  const value = args[name];
  if (typeof value !== 'string') {
    throw new Error(`Missing required string argument: ${name}`);
  }
  return value;
}

function booleanArg(args: Record<string, unknown>, name: string): boolean {
  return args[name] === true;
}

function optionalNumberArg(args: Record<string, unknown>, name: string): number | undefined {
  const value = args[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

export const editFileTool: ToolExecutor = {
  name: 'edit_file',
  permission: 'write',
  definition: {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Edit a file by replacing an exact string. Read the file first and include enough context for a unique match.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', description: 'File path relative to the workspace.' },
          old_string: { type: 'string', description: 'Exact text to replace.' },
          new_string: { type: 'string', description: 'Replacement text.' },
          replace_all: { type: 'boolean', description: 'Replace all occurrences. Defaults to false.' },
          expected_replacements: {
            type: 'number',
            description: 'Optional expected replacement count. Useful with replace_all.',
          },
        },
        required: ['path', 'old_string', 'new_string'],
      },
    },
  },
  describe(args) {
    return String(args['path'] ?? '');
  },
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const rawPath = stringArg(args, 'path');
    const oldString = stringArg(args, 'old_string');
    const newString = stringArg(args, 'new_string');
    const replaceAll = booleanArg(args, 'replace_all');
    const expected = optionalNumberArg(args, 'expected_replacements');

    if (!oldString) return { ok: false, output: '', error: 'old_string must not be empty' };

    const path = resolveWorkspacePath(context.cwd, rawPath);
    if (!existsSync(path)) return { ok: false, output: '', error: `File not found: ${rawPath}` };
    if (!statSync(path).isFile()) return { ok: false, output: '', error: `Not a file: ${rawPath}` };

    const current = readFileSync(path, 'utf-8');
    const count = current.split(oldString).length - 1;
    if (count === 0) return { ok: false, output: '', error: `old_string not found in ${rawPath}` };
    if (!replaceAll && count !== 1) {
      return {
        ok: false,
        output: '',
        error: `old_string matched ${count} times in ${rawPath}; provide a more specific old_string or set replace_all`,
      };
    }
    const replacements = replaceAll ? count : 1;
    if (expected !== undefined && expected !== replacements) {
      return {
        ok: false,
        output: '',
        error: `Expected ${expected} replacements but would make ${replacements}`,
      };
    }

    const updated = replaceAll
      ? current.split(oldString).join(newString)
      : current.replace(oldString, newString);
    writeAtomic(path, updated);
    return { ok: true, output: `Edited ${rawPath}; replacements: ${replacements}` };
  },
};
