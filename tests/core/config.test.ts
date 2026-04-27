import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

// Dynamic import to test after temp dir creation
let loadConfig: typeof import('../../packages/core/src/config.js').loadConfig;
let saveConfig: typeof import('../../packages/core/src/config.js').saveConfig;
let resolveModel: typeof import('../../packages/core/src/config.js').resolveModel;
let DEFAULT_CONFIG: typeof import('../../packages/core/src/config.js').DEFAULT_CONFIG;

async function importConfig() {
  const mod = await import('../../packages/core/src/config.js');
  loadConfig = mod.loadConfig;
  saveConfig = mod.saveConfig;
  resolveModel = mod.resolveModel;
  DEFAULT_CONFIG = mod.DEFAULT_CONFIG;
}

describe('config', () => {
  let tmpDir: string;

  beforeEach(async () => {
    await importConfig();
    tmpDir = join(tmpdir(), `oms-test-${randomBytes(4).toString('hex')}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns default config when no .oms/ exists', () => {
    const config = loadConfig(tmpDir);
    expect(config.provider).toBe('upstage');
    expect(config.model).toBe('solar-pro3');
    expect(config.language).toBe('ko');
    expect(config.backend).toBe('native');
  });

  it('saves and loads config', () => {
    const custom = { ...DEFAULT_CONFIG, model: 'solar-pro2', language: 'en' as const };
    saveConfig(custom, tmpDir);
    const loaded = loadConfig(tmpDir);
    expect(loaded.model).toBe('solar-pro2');
    expect(loaded.language).toBe('en');
  });

  it('merges partial config with defaults', () => {
    saveConfig({ ...DEFAULT_CONFIG, model: 'solar-mini' }, tmpDir);
    const loaded = loadConfig(tmpDir);
    expect(loaded.documentParse.outputFormat).toBe('markdown'); // default preserved
  });
});

describe('resolveModel', () => {
  beforeEach(async () => { await importConfig(); });

  it('resolves solar alias to solar-pro3', () => {
    expect(resolveModel('solar')).toEqual({ provider: 'upstage', model: 'solar-pro3' });
    expect(resolveModel('solar3')).toEqual({ provider: 'upstage', model: 'solar-pro3' });
    expect(resolveModel('solar-pro3')).toEqual({ provider: 'upstage', model: 'solar-pro3' });
  });

  it('resolves solar-pro2', () => {
    expect(resolveModel('solar-pro2')).toEqual({ provider: 'upstage', model: 'solar-pro2' });
  });

  it('resolves upstage/ prefix', () => {
    expect(resolveModel('upstage/solar-pro3')).toEqual({ provider: 'upstage', model: 'solar-pro3' });
  });

  it('routes claude models to anthropic', () => {
    const result = resolveModel('claude-opus-4-6');
    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe('claude-opus-4-6');
  });

  it('routes gpt models to openai', () => {
    const result = resolveModel('gpt-4o');
    expect(result.provider).toBe('openai');
  });

  it('routes grok models to xai', () => {
    const result = resolveModel('grok-3');
    expect(result.provider).toBe('xai');
  });
});
