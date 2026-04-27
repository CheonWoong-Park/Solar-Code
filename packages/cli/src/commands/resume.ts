/**
 * solar resume — resume last Solar Code session.
 */

import {
  getOmsDir,
  loadConfig,
  getUpstageApiKey,
  getLastSession,
} from '@solar-code/core';
import { permissionModeFromFlags, runAgent } from '@solar-code/engine';
import { runSlashCommand } from '../slash.js';

export async function cmdResume(
  args: string[],
  flags: Record<string, string | boolean>
): Promise<number> {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const omsDir = getOmsDir(cwd);

  const session = getLastSession(omsDir);
  if (!session) {
    process.stdout.write('[solar resume] No previous session found. Start one with: solar\n');
    return 1;
  }

  const apiKey = getUpstageApiKey();
  if (!apiKey) {
    process.stderr.write('UPSTAGE_API_KEY not set.\n');
    return 1;
  }

  const model = (flags['model'] as string) ?? session.model ?? config.model ?? 'solar-pro3';
  const prompt = args.join(' ').trim() || (flags['prompt'] as string | undefined);
  const maxTurns = typeof flags['max-turns'] === 'string' ? Number(flags['max-turns']) : undefined;
  const result = await runAgent({
    model,
    prompt,
    cwd,
    omsDir,
    maxTurns,
    permissionMode: permissionModeFromFlags(flags),
    resume: true,
    command: session.command,
    slashCommandHandler: runSlashCommand,
  });

  return result.exitCode;
}
