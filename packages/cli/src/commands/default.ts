/**
 * solar (no subcommand) — launch Solar Code agent session.
 * If no UPSTAGE_API_KEY, show setup instructions.
 */

import { loadConfig, getOmsDir, getUpstageApiKey } from '@solar-code/core';
import { permissionModeFromFlags, runAgent } from '@solar-code/engine';
import { runSlashCommand } from '../slash.js';

export async function cmdDefault(
  args: string[],
  flags: Record<string, string | boolean>
): Promise<number> {
  const apiKey = getUpstageApiKey();
  if (!apiKey) {
    process.stdout.write(`
Solar Code — Solar-native terminal coding agent

UPSTAGE_API_KEY is not set.

To get started:
  1. Get your API key at https://console.upstage.ai
  2. export UPSTAGE_API_KEY="up_..."
  3. solar
  4. inside Solar Code: /setup
  5. inside Solar Code: /doctor

`);
    return 1;
  }

  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const model = (flags['model'] as string) ?? config.model ?? 'solar-pro3';
  const prompt = args.join(' ').trim() || (flags['prompt'] as string | undefined);
  const maxTurns = typeof flags['max-turns'] === 'string' ? Number(flags['max-turns']) : undefined;

  const result = await runAgent({
    model,
    prompt,
    cwd,
    omsDir: getOmsDir(cwd),
    maxTurns,
    permissionMode: permissionModeFromFlags(flags),
    resume: flags['resume'] === true,
    command: 'default',
    slashCommandHandler: runSlashCommand,
  });
  return result.exitCode;
}
