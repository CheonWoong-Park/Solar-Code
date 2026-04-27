/**
 * Claw Code backend adapter.
 * Locates the `claw` binary, passes Solar model flags, streams output,
 * preserves exit codes, and collects logs into .solar-code/logs/.
 */

import { spawnSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { appendLog } from '../state.js';
import { getUpstageApiKey, getUpstageBaseUrl } from '../config.js';
import type { Backend, BackendRunOptions, BackendRunResult } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Platform-specific optional binary package names */
const PLATFORM_PACKAGE_MAP: Record<string, string> = {
  'linux-x64': '@solar-code/claw-linux-x64-gnu',
  'linux-arm64': '@solar-code/claw-linux-arm64-gnu',
  'darwin-arm64': '@solar-code/claw-darwin-arm64',
  'darwin-x64': '@solar-code/claw-darwin-x64',
  'win32-x64': '@solar-code/claw-win32-x64-msvc',
  'win32-arm64': '@solar-code/claw-win32-arm64-msvc',
};

function getPlatformKey(): string {
  const plat = process.platform === 'win32' ? 'win32' : process.platform;
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  return `${plat}-${arch}`;
}

/** Try to resolve claw binary path in order:
 *  1. PATH (globally installed)
 *  2. Optional platform npm package
 *  3. Common dev paths
 */
export function resolveClawBinary(): string | null {
  // 1. PATH
  const which = spawnSync('which', ['claw'], { encoding: 'utf-8' });
  if (which.status === 0 && which.stdout.trim()) {
    return which.stdout.trim();
  }

  // Windows: where.exe
  if (process.platform === 'win32') {
    const where = spawnSync('where', ['claw'], { encoding: 'utf-8' });
    if (where.status === 0 && where.stdout.trim()) {
      return where.stdout.trim().split('\n')[0].trim();
    }
  }

  // 2. Optional platform package
  const pkgKey = getPlatformKey();
  const pkgName = PLATFORM_PACKAGE_MAP[pkgKey];
  if (pkgName) {
    try {
      // Try resolving the package relative to the CLI package
      const resolved = join(__dirname, '../../../../node_modules', pkgName, 'claw');
      if (existsSync(resolved)) return resolved;
      const resolvedExe = resolved + '.exe';
      if (existsSync(resolvedExe)) return resolvedExe;
    } catch {
      // package not installed
    }
  }

  // 3. Common dev paths
  const devPaths = [
    join(process.cwd(), 'rust/target/release/claw'),
    join(process.cwd(), 'rust/target/debug/claw'),
    '/usr/local/bin/claw',
    '/usr/bin/claw',
  ];
  for (const p of devPaths) {
    if (existsSync(p)) return p;
  }

  return null;
}

export class ClawBackend implements Backend {
  readonly name = 'claw';

  async isAvailable(): Promise<boolean> {
    return resolveClawBinary() !== null;
  }

  async run(opts: BackendRunOptions): Promise<BackendRunResult> {
    const binaryPath = resolveClawBinary();
    if (!binaryPath) {
      const pkgKey = getPlatformKey();
      const pkgName = PLATFORM_PACKAGE_MAP[pkgKey];
      const installHint = pkgName
        ? `\nnpm install -g ${pkgName}`
        : '\nBuild from source: git clone https://github.com/ultraworkers/claw-code && cd claw-code/rust && cargo build --release';
      throw new Error(
        `Claw Code binary not found.\n\nInstall options:\n  npm install -g solar-code${installHint}\n  Or install claw manually and ensure it is on PATH.`
      );
    }

    const args: string[] = [];
    if (opts.prompt) {
      args.push('prompt', opts.prompt);
    }
    // Pass Solar model via --model flag
    if (opts.model) {
      args.push('--model', opts.model);
    }

    const apiKey = getUpstageApiKey();
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...(opts.env ?? {}),
      // Wire Upstage Solar through OpenAI-compat in claw
      ...(apiKey && !opts.env?.['OPENAI_API_KEY']
        ? {
            OPENAI_API_KEY: apiKey,
            OPENAI_BASE_URL: getUpstageBaseUrl(),
          }
        : {}),
    };

    const logFile = opts.omsDir
      ? join(opts.omsDir, 'logs', `claw-${Date.now()}.log`)
      : undefined;

    return new Promise((resolve) => {
      const child = spawn(binaryPath, args, {
        cwd: opts.cwd ?? process.cwd(),
        env,
        stdio: opts.stream ? ['inherit', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe'],
      });

      let output = '';

      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        output += text;
        if (opts.stream !== false) process.stdout.write(text);
        opts.onOutput?.(text);
        if (logFile) appendLog(logFile, text.trimEnd());
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        if (opts.stream !== false) process.stderr.write(text);
        if (logFile) appendLog(logFile, `[stderr] ${text.trimEnd()}`);
      });

      child.on('close', (code) => {
        resolve({ exitCode: code ?? 1, output });
      });

      child.on('error', (err) => {
        resolve({ exitCode: 1, output: err.message });
      });
    });
  }
}

export function createClawBackend(): ClawBackend {
  return new ClawBackend();
}
