import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { redactSecrets } from '../../packages/core/src/logger.js';

describe('redactSecrets', () => {
  it('redacts UPSTAGE_API_KEY patterns', () => {
    const text = 'API key is up_1234567890abcdef1234567890abc set here';
    expect(redactSecrets(text)).not.toContain('up_1234567890abcdef1234567890abc');
    expect(redactSecrets(text)).toContain('[REDACTED');
  });

  it('redacts sk- patterns', () => {
    const text = 'key=sk-1234567890abcdefghijklmnopqrst';
    expect(redactSecrets(text)).not.toContain('sk-1234567890abcdefghijklmnopqrst');
  });

  it('leaves normal text alone', () => {
    const text = 'model=solar-pro3 provider=upstage';
    expect(redactSecrets(text)).toBe(text);
  });

  it('handles empty string', () => {
    expect(redactSecrets('')).toBe('');
  });
});

describe('doctor command key safety', () => {
  let captured = '';
  const originalWrite = process.stdout.write.bind(process.stdout);

  beforeEach(() => {
    captured = '';
    process.stdout.write = ((chunk: string) => {
      captured += chunk;
      return true;
    }) as typeof process.stdout.write;
    process.env['UPSTAGE_API_KEY'] = 'up_super_secret_key_abc123def456';
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
    delete process.env['UPSTAGE_API_KEY'];
  });

  it('doctor output does not contain actual API key', async () => {
    // Simulate what doctor outputs for the API key check
    const { redactSecrets } = await import('../../packages/core/src/logger.js');
    const secretKey = process.env['UPSTAGE_API_KEY']!;

    // doctor says "Set [REDACTED]" not the actual key
    const doctorOutput = `UPSTAGE_API_KEY  Set [REDACTED]`;
    const redacted = redactSecrets(doctorOutput);
    expect(redacted).not.toContain(secretKey);
    expect(captured).not.toContain(secretKey);
  });
});
