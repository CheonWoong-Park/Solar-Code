import { clearSolarCodeAuth, getSolarCodeAuthPath } from '@solar-code/core';

export async function cmdLogout(
  _args: string[],
  _flags: Record<string, string | boolean>
): Promise<number> {
  clearSolarCodeAuth();
  delete process.env['UPSTAGE_API_KEY'];
  process.stdout.write(`Removed Solar Code auth: ${getSolarCodeAuthPath()}\n`);
  return 0;
}
