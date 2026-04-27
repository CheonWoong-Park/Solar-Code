import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export type HookEvent =
  | 'SessionStart'
  | 'UserPromptSubmit'
  | 'BeforeToolUse'
  | 'AfterToolUse'
  | 'BeforeCommand'
  | 'AfterCommand'
  | 'Stop';

export interface HookDefinition {
  event: HookEvent;
  /** Shell command to run. Executed only if hooks.enabled = true and user opted in. */
  command: string;
  description?: string;
}

export interface HooksConfig {
  enabled: boolean;
  hooks: HookDefinition[];
}

export function loadHooks(omsDir: string): HooksConfig {
  const hooksPath = join(omsDir, 'hooks.json');
  if (!existsSync(hooksPath)) {
    return { enabled: false, hooks: [] };
  }
  try {
    return JSON.parse(readFileSync(hooksPath, 'utf-8')) as HooksConfig;
  } catch {
    return { enabled: false, hooks: [] };
  }
}

/**
 * Fire hooks for a given event.
 * Hooks are NEVER executed without explicit user opt-in (enabled: true in hooks.json).
 * Commands are run with the user's shell, NOT via eval.
 */
export async function fireHooks(
  hooksConfig: HooksConfig,
  event: HookEvent,
  context: Record<string, string> = {}
): Promise<void> {
  if (!hooksConfig.enabled) return;
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  const matching = hooksConfig.hooks.filter((h) => h.event === event);
  for (const hook of matching) {
    try {
      // Inject context as env vars — no shell interpolation of user input
      const envVars: NodeJS.ProcessEnv = { ...process.env };
      for (const [k, v] of Object.entries(context)) {
        envVars[`OMS_${k.toUpperCase()}`] = v;
      }
      await execFileAsync('/bin/sh', ['-c', hook.command], { env: envVars });
    } catch (err) {
      process.stderr.write(
        `[oms hooks] Warning: hook for ${event} failed: ${(err as Error).message}\n`
      );
    }
  }
}

export const HOOKS_SECURITY_WARNING = `
SECURITY WARNING: OMS hooks execute shell commands.
Only enable hooks from sources you trust.
Review .oms/hooks.json before enabling.
`;
