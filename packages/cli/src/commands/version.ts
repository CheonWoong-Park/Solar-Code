import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function cmdVersion(_args: string[], _flags: Record<string, string | boolean>): Promise<number> {
  const pkgPath = join(__dirname, '../../package.json');
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string; name: string };
    process.stdout.write(`${pkg.name} v${pkg.version}\n`);
  } catch {
    process.stdout.write('solar-code v0.1.0\n');
  }
  return 0;
}
