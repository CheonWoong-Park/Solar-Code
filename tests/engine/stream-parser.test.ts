import { describe, it, expect } from 'vitest';
import { SolarStreamParser } from '../../packages/engine/src/agent/stream-parser.js';

describe('SolarStreamParser', () => {
  it('accumulates streamed content', () => {
    const parser = new SolarStreamParser();
    parser.push({ choices: [{ delta: { content: '<|content|>안녕' }, finish_reason: null }] });
    parser.push({ choices: [{ delta: { content: '하세요' }, finish_reason: 'stop' }] });

    const result = parser.finish();
    expect(result.content).toBe('안녕하세요');
    expect(result.finishReason).toBe('stop');
    expect(result.toolCalls).toEqual([]);
  });

  it('accumulates tool call arguments by index', () => {
    const parser = new SolarStreamParser();
    parser.push({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: 'call_1',
            type: 'function',
            function: { name: 'read_file', arguments: '{"path":"' },
          }],
        },
        finish_reason: null,
      }],
    });
    parser.push({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            function: { arguments: 'README.md"}' },
          }],
        },
        finish_reason: 'tool_calls',
      }],
    });

    const result = parser.finish();
    expect(result.finishReason).toBe('tool_calls');
    expect(result.toolCalls[0]).toMatchObject({
      id: 'call_1',
      name: 'read_file',
      arguments: { path: 'README.md' },
    });
    expect(result.assistantToolCalls[0]?.function.arguments).toBe('{"path":"README.md"}');
  });
});
