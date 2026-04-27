import { existsSync, rmSync } from 'fs';
import { clearSolarCodeHome, getOmsDir, getSolarCodeHome } from '@solar-code/core';

export async function cmdUninstall(
  _args: string[],
  _flags: Record<string, string | boolean>
): Promise<number> {
  const home = getSolarCodeHome();
  const projectState = getOmsDir(process.cwd());

  clearSolarCodeHome();
  process.stdout.write(`Removed Solar Code user data: ${home}\n`);

  if (existsSync(projectState)) {
    rmSync(projectState, { recursive: true, force: true });
    process.stdout.write(`Removed project state: ${projectState}\n`);
  }

  process.stdout.write('To remove the global CLI package, run: npm uninstall -g solar-code\n');
  return 0;
}
