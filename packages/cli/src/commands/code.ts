/**
 * solar code [prompt] — native Solar Code agent.
 */

import { loadConfig, getOmsDir } from '@solar-code/core';
import { permissionModeFromFlags, permissionProfileFromFlags, runAgent } from '@solar-code/engine';
import { runSlashCommand } from '../slash.js';
import { ensureUpstageApiKey } from '../upstage-key.js';

export async function cmdCode(
  args: string[],
  flags: Record<string, string | boolean>
): Promise<number> {
  const mockMode = process.env['SOLAR_MOCK'] === '1';
  if (!mockMode && !(await ensureUpstageApiKey())) {
    return 1;
  }

  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const model = (flags['model'] as string) ?? config.model ?? 'solar-pro3';
  const omsDir = getOmsDir(cwd);
  const prompt = args.join(' ').trim() || (flags['prompt'] as string | undefined);
  const maxTurns = typeof flags['max-turns'] === 'string' ? Number(flags['max-turns']) : undefined;

  const result = await runAgent({
    model,
    prompt,
    cwd,
    omsDir,
    maxTurns,
    permissionMode: permissionModeFromFlags(flags),
    permissionProfile: permissionProfileFromFlags(flags, config.agent.permissionProfile),
    resume: flags['resume'] === true,
    command: 'code',
    slashCommandHandler: runSlashCommand,
  });

  return result.exitCode;
}
