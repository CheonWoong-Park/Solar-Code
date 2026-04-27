import { afterEach, describe, expect, it } from 'vitest';
import { streamChatCompletion } from '../../packages/engine/src/agent/stream-parser.js';

describe('mock parity provider', () => {
  afterEach(() => {
    delete process.env['SOLAR_MOCK'];
  });

  it('streams deterministic responses without network or API keys', async () => {
    delete process.env['UPSTAGE_API_KEY'];
    process.env['SOLAR_MOCK'] = '1';
    let streamed = '';

    const result = await streamChatCompletion({
      model: 'solar-pro3',
      messages: [{ role: 'user', content: 'parity ping' }],
      tools: [],
      onContent: (text) => {
        streamed += text;
      },
    });

    expect(result.content).toBe('mock solar: parity ping');
    expect(streamed).toBe(result.content);
    expect(result.toolCalls).toEqual([]);
  });
});
