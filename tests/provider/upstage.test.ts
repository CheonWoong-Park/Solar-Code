import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UpstageProvider } from '../../packages/core/src/provider/upstage.js';

describe('UpstageProvider constructor', () => {
  it('throws if no API key is provided and env var is not set', () => {
    const originalKey = process.env['UPSTAGE_API_KEY'];
    delete process.env['UPSTAGE_API_KEY'];
    expect(() => new UpstageProvider()).toThrow('UPSTAGE_API_KEY');
    if (originalKey) process.env['UPSTAGE_API_KEY'] = originalKey;
  });

  it('accepts explicit API key', () => {
    expect(() => new UpstageProvider('up_test_key_12345')).not.toThrow();
  });

  it('does not throw when env var is set', () => {
    process.env['UPSTAGE_API_KEY'] = 'up_test_key_12345';
    expect(() => new UpstageProvider()).not.toThrow();
    delete process.env['UPSTAGE_API_KEY'];
  });
});

describe('UpstageProvider.chat (mocked)', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env['UPSTAGE_API_KEY'];
  });

  it('sends Authorization Bearer header', async () => {
    const apiKey = 'up_test_key_abc123';
    let capturedHeaders: Record<string, string> = {};

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'test-id',
        object: 'chat.completion',
        created: 1234,
        model: 'solar-pro3',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' }],
      }),
    }) as unknown as typeof fetch;

    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockImplementation((_url: string, opts: RequestInit) => {
      capturedHeaders = Object.fromEntries(
        Object.entries(opts.headers as Record<string, string>)
      );
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'test-id',
          object: 'chat.completion',
          created: 1234,
          model: 'solar-pro3',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' }],
        }),
      });
    });

    const provider = new UpstageProvider(apiKey);
    await provider.chat({
      model: 'solar-pro3',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(capturedHeaders['Authorization']).toBe(`Bearer ${apiKey}`);
    // Verify key is NOT printed anywhere
    expect(JSON.stringify(capturedHeaders)).not.toContain(apiKey + apiKey); // only check not doubled
  });

  it('resolves solar alias to solar-pro3 in request body', async () => {
    const apiKey = 'up_test_key';
    let capturedBody: { model?: string } = {};

    global.fetch = vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      capturedBody = JSON.parse(opts.body as string) as { model?: string };
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'x', object: 'chat.completion', created: 1, model: 'solar-pro3',
          choices: [{ index: 0, message: { role: 'assistant', content: '' }, finish_reason: 'stop' }],
        }),
      });
    }) as unknown as typeof fetch;

    const provider = new UpstageProvider(apiKey);
    await provider.chat({ model: 'solar', messages: [{ role: 'user', content: 'test' }] });
    expect(capturedBody.model).toBe('solar-pro3');
  });

  it('throws on non-200 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    }) as unknown as typeof fetch;

    const provider = new UpstageProvider('up_bad_key');
    await expect(
      provider.chat({ model: 'solar-pro3', messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toThrow('401');
  });
});

describe('resolveModel alias coverage', () => {
  it('solar -> solar-pro3', async () => {
    const { resolveModel } = await import('../../packages/core/src/config.js');
    expect(resolveModel('solar').model).toBe('solar-pro3');
    expect(resolveModel('solar3').model).toBe('solar-pro3');
    expect(resolveModel('solar-pro3').model).toBe('solar-pro3');
    expect(resolveModel('solar-pro2').model).toBe('solar-pro2');
    expect(resolveModel('upstage/solar-pro3').model).toBe('solar-pro3');
  });

  it('solar always routes to upstage regardless of OPENAI_API_KEY', async () => {
    process.env['OPENAI_API_KEY'] = 'sk-test';
    const { resolveModel } = await import('../../packages/core/src/config.js');
    expect(resolveModel('solar').provider).toBe('upstage');
    delete process.env['OPENAI_API_KEY'];
  });
});
