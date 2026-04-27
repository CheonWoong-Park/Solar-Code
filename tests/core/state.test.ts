import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { writeAtomic, appendLog, readJsonFile, writeJsonFile, ensureOmsDirs } from '../../packages/core/src/state.js';

describe('writeAtomic', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `oms-test-${randomBytes(4).toString('hex')}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes file content atomically', () => {
    const path = join(tmpDir, 'test.json');
    writeAtomic(path, '{"hello": "world"}');
    expect(readFileSync(path, 'utf-8')).toBe('{"hello": "world"}');
  });

  it('creates parent directories', () => {
    const path = join(tmpDir, 'deep', 'dir', 'file.txt');
    writeAtomic(path, 'content');
    expect(readFileSync(path, 'utf-8')).toBe('content');
  });

  it('overwrites existing file', () => {
    const path = join(tmpDir, 'overwrite.txt');
    writeAtomic(path, 'first');
    writeAtomic(path, 'second');
    expect(readFileSync(path, 'utf-8')).toBe('second');
  });
});

describe('appendLog', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `oms-test-${randomBytes(4).toString('hex')}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('appends lines to log file', () => {
    const path = join(tmpDir, 'test.log');
    appendLog(path, 'line 1');
    appendLog(path, 'line 2');
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('line 1');
    expect(content).toContain('line 2');
  });
});

describe('readJsonFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `oms-test-${randomBytes(4).toString('hex')}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns fallback for missing file', () => {
    const result = readJsonFile(join(tmpDir, 'missing.json'), { default: true });
    expect(result).toEqual({ default: true });
  });

  it('reads valid JSON', () => {
    const path = join(tmpDir, 'data.json');
    writeJsonFile(path, { key: 'value' });
    expect(readJsonFile(path, {})).toEqual({ key: 'value' });
  });

  it('returns fallback for invalid JSON', () => {
    const path = join(tmpDir, 'bad.json');
    writeAtomic(path, 'not json');
    expect(readJsonFile(path, { fallback: true })).toEqual({ fallback: true });
  });
});

describe('ensureOmsDirs', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `oms-test-${randomBytes(4).toString('hex')}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates all required subdirectories', () => {
    ensureOmsDirs(tmpDir);
    const { existsSync } = require('fs');
    const required = ['state', 'logs', 'plans', 'memory', 'sessions', 'parsed', 'team', 'hooks', 'agents', 'skills'];
    for (const dir of required) {
      expect(existsSync(join(tmpDir, dir))).toBe(true);
    }
  });
});
