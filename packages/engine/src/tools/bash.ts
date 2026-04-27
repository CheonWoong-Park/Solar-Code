import { spawn } from 'child_process';
import { validateBashCommand } from './bash-policy.js';
import type { ToolExecutor, ToolExecutionContext, ToolResult } from './types.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_OUTPUT_CHARS = 10_000;

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

export const bashTool: ToolExecutor = {
  name: 'bash',
  permission: 'execute',
  definition: {
    type: 'function',
    function: {
      name: 'bash',
      description: 'Run a shell command in the current workspace. Use mainly for builds, tests, checks, git, or commands explicitly requested by the user. Do not use for casual identity questions or simple file operations.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          command: { type: 'string', description: 'Shell command to run.' },
          timeout_ms: {
            type: 'number',
            description: 'Timeout in milliseconds. Defaults to 10000 and is capped at 60000.',
          },
          max_output_chars: {
            type: 'number',
            description: 'Maximum stdout/stderr characters returned. Defaults to 10000 and is capped at 50000.',
          },
        },
        required: ['command'],
      },
    },
  },
  describe(args) {
    return stringArg(args, 'command');
  },
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const command = stringArg(args, 'command');
    const denial = validateBashCommand(command);
    if (denial) return { ok: false, output: '', error: `Blocked by command policy: ${denial.reason}` };

    const timeoutMs = numberArg(args, 'timeout_ms', DEFAULT_TIMEOUT_MS, 60_000);
    const maxOutputChars = numberArg(args, 'max_output_chars', DEFAULT_MAX_OUTPUT_CHARS, 50_000);

    return new Promise((resolve) => {
      const child = spawn(command, {
        cwd: context.cwd,
        env: process.env,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let truncated = false;
      let timedOut = false;

      const append = (target: 'stdout' | 'stderr', chunk: Buffer): void => {
        const text = chunk.toString();
        const currentLength = stdout.length + stderr.length;
        const remaining = maxOutputChars - currentLength;
        if (remaining <= 0) {
          truncated = true;
          return;
        }
        const next = text.slice(0, remaining);
        if (next.length < text.length) truncated = true;
        if (target === 'stdout') stdout += next;
        else stderr += next;
      };

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);

      child.stdout?.on('data', (chunk: Buffer) => append('stdout', chunk));
      child.stderr?.on('data', (chunk: Buffer) => append('stderr', chunk));

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({ ok: false, output: '', error: err.message });
      });

      child.on('close', (code, signal) => {
        clearTimeout(timer);
        const sections: string[] = [];
        if (stdout) sections.push(`stdout:\n${stdout.trimEnd()}`);
        if (stderr) sections.push(`stderr:\n${stderr.trimEnd()}`);
        if (!sections.length) sections.push('(no output)');
        if (truncated) sections.push(`[truncated to ${maxOutputChars} chars]`);
        if (timedOut) sections.push(`[timed out after ${timeoutMs}ms]`);
        sections.push(`exit_code: ${code ?? 'null'}${signal ? ` signal: ${signal}` : ''}`);

        resolve({
          ok: !timedOut && code === 0,
          output: sections.join('\n\n'),
          error: timedOut ? `Command timed out after ${timeoutMs}ms` : code === 0 ? undefined : `Command exited with ${code}`,
        });
      });
    });
  },
};
