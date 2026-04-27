import { existsSync, chmodSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';
import { writeAtomic } from './state.js';

export interface SolarCodeAuth {
  auth_mode: 'api_key';
  UPSTAGE_API_KEY?: string;
  last_updated?: string;
}

export function getSolarCodeHome(): string {
  return process.env['SOLAR_CODE_HOME']?.trim() || join(homedir(), '.solar-code');
}

export function getSolarCodeAuthPath(): string {
  return join(getSolarCodeHome(), 'auth.json');
}

export function readSolarCodeAuth(): SolarCodeAuth | null {
  const path = getSolarCodeAuthPath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SolarCodeAuth;
  } catch {
    return null;
  }
}

export function getStoredUpstageApiKey(): string | undefined {
  return readSolarCodeAuth()?.UPSTAGE_API_KEY?.trim() || undefined;
}

export function saveUpstageApiKey(apiKey: string): void {
  const home = getSolarCodeHome();
  const path = getSolarCodeAuthPath();
  mkdirSync(home, { recursive: true, mode: 0o700 });
  try {
    chmodSync(home, 0o700);
  } catch {
    // Best effort on filesystems that do not support POSIX permissions.
  }

  writeAtomic(path, JSON.stringify({
    auth_mode: 'api_key',
    UPSTAGE_API_KEY: apiKey,
    last_updated: new Date().toISOString(),
  } satisfies SolarCodeAuth, null, 2));

  try {
    chmodSync(path, 0o600);
  } catch {
    // Best effort on filesystems that do not support POSIX permissions.
  }
}

export function clearSolarCodeAuth(): void {
  rmSync(getSolarCodeAuthPath(), { force: true });
}

export function clearSolarCodeHome(): void {
  rmSync(assertSafeSolarCodeHomePath(getSolarCodeHome()), { recursive: true, force: true });
}

function assertSafeSolarCodeHomePath(home: string): string {
  const resolved = resolve(home);
  const userHome = resolve(homedir());
  if (resolved === '/' || resolved === userHome || resolved.length < 6) {
    throw new Error(`Refusing to remove unsafe Solar Code home path: ${resolved}`);
  }
  return resolved;
}
