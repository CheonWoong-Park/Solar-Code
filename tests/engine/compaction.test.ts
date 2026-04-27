import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { calculateSessionStats, compactSessionMessages } from '../../packages/engine/src/agent/compaction.js';
import { appendSessionMessage, rewriteSessionMessages } from '../../packages/engine/src/agent/session.js';
import type { AgentMessage } from '../../packages/engine/src/agent/messages.js';

function user(content: string): AgentMessage {
  return { role: 'user', content };
}

function assistant(content: string): AgentMessage {
  return { role: 'assistant', content };
}

describe('session compaction', () => {
  let tmpDir: string;
  let omsDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `solar-compaction-test-${randomBytes(4).toString('hex')}`);
    omsDir = join(tmpDir, '.oms');
    mkdirSync(omsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('calculates approximate session stats', () => {
    const stats = calculateSessionStats([
      { role: 'system', content: 'system' },
      user('hello'),
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'tool_1', type: 'function', function: { name: 'read_file', arguments: '{}' } }],
      },
      { role: 'tool', tool_call_id: 'tool_1', name: 'read_file', content: '1| hello' },
    ]);

    expect(stats.messages).toBe(4);
    expect(stats.toolCalls).toBe(1);
    expect(stats.toolMessages).toBe(1);
    expect(stats.approxTokens).toBeGreaterThan(0);
  });

  it('compacts older messages into durable memory while keeping recent turns', () => {
    const messages: AgentMessage[] = [
      { role: 'system', content: 'base system prompt' },
      ...Array.from({ length: 12 }, (_, index) => [
        user(`request ${index} ${'x'.repeat(100)}`),
        assistant(`answer ${index}`),
      ]).flat(),
    ];

    const result = compactSessionMessages(messages, { maxMessages: 8, keepMessages: 6 });

    expect(result.compacted).toBe(true);
    expect(result.archivedMessages).toBeGreaterThan(0);
    expect(result.messages[0]).toEqual({ role: 'system', content: 'base system prompt' });
    expect(result.messages[1]?.role).toBe('system');
    expect(result.messages[1]?.content).toContain('[Solar Code session memory]');
    expect(result.messages.at(-1)).toEqual(assistant('answer 11'));
    expect(result.after.messages).toBeLessThan(result.before.messages);
  });

  it('does not leave a dangling tool result at the start of the retained tail', () => {
    const messages: AgentMessage[] = [
      { role: 'system', content: 'base' },
      user('old request'),
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'tool_1', type: 'function', function: { name: 'bash', arguments: '{"command":"npm test"}' } }],
      },
      { role: 'tool', tool_call_id: 'tool_1', name: 'bash', content: 'ok' },
      assistant('done'),
      user('latest request'),
      assistant('latest answer'),
    ];

    const result = compactSessionMessages(messages, { force: true, keepMessages: 2 });
    const nonSystem = result.messages.filter((message) => message.role !== 'system');

    expect(nonSystem[0]?.role).not.toBe('tool');
  });

  it('rewrites compacted sessions as jsonl', () => {
    const sessionId = 'session-test';
    appendSessionMessage(omsDir, sessionId, user('before'));
    rewriteSessionMessages(omsDir, sessionId, [user('after'), assistant('done')]);

    const file = join(omsDir, 'sessions', `${sessionId}.jsonl`);
    const lines = readFileSync(file, 'utf-8').trim().split('\n');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('after');
    expect(lines[1]).toContain('done');
  });
});
