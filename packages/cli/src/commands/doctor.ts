/**
 * oms doctor — check environment and configuration.
 * NEVER prints actual API keys.
 */

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  getOmsDir,
  loadConfig,
  getSolarCodeAuthPath,
  getUpstageBaseUrl,
  getUpstageApiKey,
  resolveClawBinary,
} from '@solar-code/core';
import { readFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Check {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  message: string;
}

function checkNode(): Check {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  if (major >= 20) {
    return { name: 'Node.js version', status: 'ok', message: `${version} (>=20 required)` };
  }
  return { name: 'Node.js version', status: 'fail', message: `${version} — requires Node.js >=20` };
}

function checkPackageVersion(): Check {
  try {
    const pkgPath = join(__dirname, '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
    return { name: 'Solar Code version', status: 'ok', message: `v${pkg.version}` };
  } catch {
    return { name: 'Solar Code version', status: 'warn', message: 'Could not read version' };
  }
}

function checkUpstageApiKey(): Check {
  const key = getUpstageApiKey();
  if (!key) {
    return {
      name: 'Solar Code auth',
      status: 'fail',
      message: `Not set — run solar and paste a key (${getSolarCodeAuthPath()})`,
    };
  }
  if (!key.startsWith('up_')) {
    return {
      name: 'Solar Code auth',
      status: 'warn',
      message: 'Set (does not start with "up_" — double check your key)',
    };
  }
  return { name: 'Solar Code auth', status: 'ok', message: 'Set [REDACTED]' };
}

function checkUpstageBaseUrl(): Check {
  const url = getUpstageBaseUrl();
  return { name: 'UPSTAGE_BASE_URL', status: 'ok', message: url };
}

function checkClawBackend(): Check {
  const bin = resolveClawBinary();
  if (bin) {
    const result = spawnSync(bin, ['version'], { encoding: 'utf-8' });
    const ver = result.stdout?.trim() ?? 'unknown';
    return { name: 'Claw Code backend', status: 'ok', message: `Found at ${bin} (${ver}) for legacy/team workflows` };
  }
  return {
    name: 'Claw Code backend',
    status: 'warn',
    message: 'Not found — Solar Code works; install claw only for legacy/team workflows',
  };
}

function checkTool(name: string, cmd: string, args: string[]): Check {
  const result = spawnSync(cmd, args, { encoding: 'utf-8' });
  if (result.status === 0) {
    const ver = result.stdout?.trim().split('\n')[0] ?? '';
    return { name, status: 'ok', message: ver };
  }
  return { name, status: 'warn', message: `Not found — install ${cmd}` };
}

function checkOmsDir(): Check {
  const omsDir = getOmsDir(process.cwd());
  if (!existsSync(omsDir)) {
    return {
      name: '.solar-code/ state',
      status: 'warn',
      message: 'Not initialized — run `/setup` inside Solar Code or `solar setup`',
    };
  }
  const configPath = join(omsDir, 'config.json');
  if (!existsSync(configPath)) {
    return { name: '.solar-code/ state', status: 'warn', message: 'Missing config.json — run `/setup` inside Solar Code or `solar setup`' };
  }
  return { name: '.solar-code/ state', status: 'ok', message: omsDir };
}

function checkConfig(): Check {
  try {
    const config = loadConfig(process.cwd());
    return {
      name: 'Solar Code config',
      status: 'ok',
      message: `provider=${config.provider} model=${config.model} lang=${config.language}`,
    };
  } catch (err) {
    return { name: 'Solar Code config', status: 'warn', message: `Could not load: ${(err as Error).message}` };
  }
}

function checkDocumentParse(): Check {
  const key = getUpstageApiKey();
  const config = loadConfig(process.cwd());
  if (!key) {
    return { name: 'Document Parse', status: 'warn', message: 'Solar Code auth not set' };
  }
  if (!config.documentParse.enabled) {
    return { name: 'Document Parse', status: 'warn', message: 'Disabled in config' };
  }
  return { name: 'Document Parse', status: 'ok', message: `Enabled (format=${config.documentParse.outputFormat})` };
}

function statusIcon(status: Check['status']): string {
  return status === 'ok' ? 'OK  ' : status === 'warn' ? 'WARN' : 'FAIL';
}

export async function cmdDoctor(
  _args: string[],
  _flags: Record<string, string | boolean>
): Promise<number> {
  process.stdout.write('\nSolar Code — Doctor\n\n');

  const checks: Check[] = [
    checkNode(),
    checkPackageVersion(),
    checkUpstageApiKey(),
    checkUpstageBaseUrl(),
    checkClawBackend(),
    checkTool('tmux', 'tmux', ['-V']),
    checkTool('git', 'git', ['--version']),
    checkTool('ripgrep (rg)', 'rg', ['--version']),
    checkOmsDir(),
    checkConfig(),
    checkDocumentParse(),
  ];

  let hasFailure = false;
  let hasWarning = false;

  for (const check of checks) {
    const icon = statusIcon(check.status);
    process.stdout.write(`  [${icon}] ${check.name.padEnd(30)} ${check.message}\n`);
    if (check.status === 'fail') hasFailure = true;
    if (check.status === 'warn') hasWarning = true;
  }

  process.stdout.write('\n');

  if (hasFailure) {
    process.stdout.write('Doctor found issues that must be fixed before using Solar Code.\n\n');
    return 1;
  }
  if (hasWarning) {
    process.stdout.write('Doctor found warnings. Some features may be limited.\n\n');
    return 0;
  }
  process.stdout.write('All checks passed. Solar Code is ready.\n\n');
  return 0;
}
