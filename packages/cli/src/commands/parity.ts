/**
 * solar parity — deterministic mock-engine smoke check.
 */

import { getOmsDir } from '@solar-code/core';
import { runAgent } from '@solar-code/engine';

export async function cmdParity(
  args: string[],
  flags: Record<string, string | boolean>
): Promise<number> {
  const cwd = process.cwd();
  const previous = process.env['SOLAR_MOCK'];
  process.env['SOLAR_MOCK'] = '1';
  try {
    const prompt = args.join(' ').trim() || 'parity ping';
    const result = await runAgent({
      model: (flags['model'] as string) ?? 'solar-pro3',
      prompt,
      cwd,
      omsDir: getOmsDir(cwd),
      maxTurns: 3,
      permissionMode: 'readonly',
      permissionProfile: 'locked',
      command: 'parity',
    });
    process.stdout.write(`\n[solar parity] ok session=${result.sessionId}\n`);
    return result.exitCode;
  } finally {
    if (previous === undefined) delete process.env['SOLAR_MOCK'];
    else process.env['SOLAR_MOCK'] = previous;
  }
}
