import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { loadUsage, recordModelUsage, recordToolUsage } from '../../packages/engine/src/agent/usage.js';

describe('usage accounting', () => {
  let omsDir: string;

  beforeEach(() => {
    omsDir = join(tmpdir(), `solar-usage-test-${randomBytes(4).toString('hex')}`, '.oms');
    mkdirSync(omsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(omsDir, { recursive: true, force: true });
  });

  it('persists estimated model and tool usage', () => {
    recordModelUsage(omsDir, 's1', {
      messages: [{ role: 'user', content: 'hello world' }],
      content: 'answer',
      toolCalls: [],
    });
    recordToolUsage(omsDir, 's1', 'bash', 'exit_code: 0');

    const usage = loadUsage(omsDir, 's1');

    expect(usage.modelRequests).toBe(1);
    expect(usage.toolExecutions).toBe(1);
    expect(usage.estimatedPromptTokens).toBeGreaterThan(0);
    expect(usage.estimatedCompletionTokens).toBeGreaterThan(0);
    expect(usage.estimatedToolTokens).toBeGreaterThan(0);
  });
});
