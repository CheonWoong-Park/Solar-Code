import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import {
  clearSolarCodeAuth,
  clearSolarCodeHome,
  getSolarCodeAuthPath,
  getSolarCodeHome,
  getStoredUpstageApiKey,
  getUpstageApiKey,
  saveUpstageApiKey,
} from '../../packages/core/src/index.js';

describe('Solar Code auth', () => {
  let tmpHome: string;
  let originalSolarCodeHome: string | undefined;
  let originalApiKey: string | undefined;

  beforeEach(() => {
    originalSolarCodeHome = process.env['SOLAR_CODE_HOME'];
    originalApiKey = process.env['UPSTAGE_API_KEY'];
    tmpHome = join(tmpdir(), `solar-code-auth-test-${randomBytes(4).toString('hex')}`);
    process.env['SOLAR_CODE_HOME'] = tmpHome;
    delete process.env['UPSTAGE_API_KEY'];
    mkdirSync(tmpHome, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpHome, { recursive: true, force: true });
    if (originalSolarCodeHome === undefined) delete process.env['SOLAR_CODE_HOME'];
    else process.env['SOLAR_CODE_HOME'] = originalSolarCodeHome;
    if (originalApiKey === undefined) delete process.env['UPSTAGE_API_KEY'];
    else process.env['UPSTAGE_API_KEY'] = originalApiKey;
  });

  it('stores the Upstage API key in auth.json', () => {
    saveUpstageApiKey('up_test_file_key');

    expect(getSolarCodeHome()).toBe(tmpHome);
    expect(getSolarCodeAuthPath()).toBe(join(tmpHome, 'auth.json'));
    expect(getStoredUpstageApiKey()).toBe('up_test_file_key');
    expect(getUpstageApiKey()).toBe('up_test_file_key');

    const auth = JSON.parse(readFileSync(getSolarCodeAuthPath(), 'utf-8')) as {
      auth_mode: string;
      UPSTAGE_API_KEY: string;
    };
    expect(auth.auth_mode).toBe('api_key');
    expect(auth.UPSTAGE_API_KEY).toBe('up_test_file_key');
  });

  it('prefers the environment variable over saved auth', () => {
    saveUpstageApiKey('up_test_file_key');
    process.env['UPSTAGE_API_KEY'] = 'up_test_env_key';
    expect(getUpstageApiKey()).toBe('up_test_env_key');
  });

  it('removes auth and user home data', () => {
    saveUpstageApiKey('up_test_file_key');
    clearSolarCodeAuth();
    expect(existsSync(getSolarCodeAuthPath())).toBe(false);

    saveUpstageApiKey('up_test_file_key');
    clearSolarCodeHome();
    expect(existsSync(tmpHome)).toBe(false);
  });

  it('uses private permissions where supported', () => {
    saveUpstageApiKey('up_test_file_key');
    if (process.platform === 'win32') return;
    expect(statSync(getSolarCodeHome()).mode & 0o777).toBe(0o700);
    expect(statSync(getSolarCodeAuthPath()).mode & 0o777).toBe(0o600);
  });

  it('refuses to clear unsafe home paths', () => {
    process.env['SOLAR_CODE_HOME'] = '/';
    expect(() => clearSolarCodeHome()).toThrow('Refusing to remove unsafe');
  });
});
