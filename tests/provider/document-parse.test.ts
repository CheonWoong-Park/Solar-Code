import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { parseDocument, isSupportedFile } from '../../packages/core/src/document-parse.js';

describe('isSupportedFile', () => {
  it('accepts PDF', () => expect(isSupportedFile('file.pdf')).toBe(true));
  it('accepts PNG', () => expect(isSupportedFile('img.PNG')).toBe(true));
  it('accepts DOCX', () => expect(isSupportedFile('doc.docx')).toBe(true));
  it('rejects TXT', () => expect(isSupportedFile('file.txt')).toBe(false));
  it('rejects MP3', () => expect(isSupportedFile('audio.mp3')).toBe(false));
});

describe('parseDocument (mocked API)', () => {
  let tmpDir: string;
  let tmpHome: string;
  let testFile: string;
  let originalFetch: typeof global.fetch;
  let originalSolarCodeHome: string | undefined;
  let originalApiKey: string | undefined;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalSolarCodeHome = process.env['SOLAR_CODE_HOME'];
    originalApiKey = process.env['UPSTAGE_API_KEY'];
    tmpDir = join(tmpdir(), `oms-parse-test-${randomBytes(4).toString('hex')}`);
    tmpHome = join(tmpdir(), `solar-code-parse-test-${randomBytes(4).toString('hex')}`);
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(tmpHome, { recursive: true });
    process.env['SOLAR_CODE_HOME'] = tmpHome;
    delete process.env['UPSTAGE_API_KEY'];
    testFile = join(tmpDir, 'test.pdf');
    writeFileSync(testFile, Buffer.from('%PDF-1.4 fake'));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
    if (originalSolarCodeHome === undefined) delete process.env['SOLAR_CODE_HOME'];
    else process.env['SOLAR_CODE_HOME'] = originalSolarCodeHome;
    if (originalApiKey === undefined) delete process.env['UPSTAGE_API_KEY'];
    else process.env['UPSTAGE_API_KEY'] = originalApiKey;
  });

  it('throws without API key', async () => {
    await expect(
      parseDocument({ filePath: testFile, apiKey: undefined })
    ).rejects.toThrow('Solar Code auth');
  });

  it('throws for missing file', async () => {
    await expect(
      parseDocument({ filePath: '/nonexistent/file.pdf', apiKey: 'up_test' })
    ).rejects.toThrow('File not found');
  });

  it('throws for unsupported file type', async () => {
    const txtFile = join(tmpDir, 'test.txt');
    writeFileSync(txtFile, 'hello');
    await expect(
      parseDocument({ filePath: txtFile, apiKey: 'up_test' })
    ).rejects.toThrow('Unsupported file type');
  });

  it('sends Authorization header in multipart upload', async () => {
    const apiKey = 'up_test_key_parse';
    let capturedAuthHeader = '';

    global.fetch = vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      capturedAuthHeader = (opts.headers as Record<string, string>)['Authorization'];
      return Promise.resolve({
        ok: true,
        json: async () => ({
          content: { markdown: '# Parsed Document\n\nHello World' },
          model: 'upstage-document-parse-v1',
        }),
      });
    }) as unknown as typeof fetch;

    const result = await parseDocument({ filePath: testFile, apiKey, omsDir: tmpDir });
    expect(capturedAuthHeader).toBe(`Bearer ${apiKey}`);
    expect(result.content).toContain('Hello World');
  });

  it('saves output to .solar-code/parsed/', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: { markdown: '# Test\nContent here' } }),
    }) as unknown as typeof fetch;

    const omsDir = join(tmpDir, '.solar-code');
    mkdirSync(join(omsDir, 'parsed'), { recursive: true });

    const result = await parseDocument({ filePath: testFile, apiKey: 'up_key', omsDir });
    expect(result.savedPath).toBeDefined();
    expect(existsSync(result.savedPath!)).toBe(true);
  });

  it('handles API error response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'Unprocessable Entity',
    }) as unknown as typeof fetch;

    await expect(
      parseDocument({ filePath: testFile, apiKey: 'up_test' })
    ).rejects.toThrow('422');
  });

  it('never leaks API key in error messages', async () => {
    const apiKey = 'up_very_secret_key_do_not_leak';
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    }) as unknown as typeof fetch;

    try {
      await parseDocument({ filePath: testFile, apiKey });
    } catch (err) {
      expect((err as Error).message).not.toContain(apiKey);
    }
  });
});
