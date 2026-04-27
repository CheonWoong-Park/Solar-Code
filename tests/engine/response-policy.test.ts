import { describe, expect, it } from 'vitest';
import {
  sanitizePostToolAssistantResponse,
  shouldConstrainPostToolResponse,
} from '../../packages/engine/src/agent/response-policy.js';
import type { AgentMessage } from '../../packages/engine/src/agent/messages.js';
import { buildSystemPrompt } from '../../packages/engine/src/agent/system-prompt.js';

function writeContext(userPrompt = 'test/tetris.html 만들어줘'): AgentMessage[] {
  return [
    { role: 'system', content: 'system' },
    { role: 'user', content: userPrompt },
    {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'write_file', arguments: '{}' } }],
    },
    { role: 'tool', tool_call_id: 'call_1', name: 'write_file', content: 'Wrote 12000 chars to test/tetris.html' },
  ];
}

describe('post-edit response policy', () => {
  it('constrains assistant output after file writes', () => {
    expect(shouldConstrainPostToolResponse(writeContext())).toBe(true);
  });

  it('does not constrain when user explicitly asks for code output', () => {
    expect(shouldConstrainPostToolResponse(writeContext('test/tetris.html 만들고 전체 코드 보여줘'))).toBe(false);
  });

  it('replaces large code dumps with a concise completion summary', () => {
    const content = [
      '파일이 생성되었습니다.',
      '```html',
      '<!doctype html>',
      '<div>tetris</div>'.repeat(100),
      '```',
    ].join('\n');

    const sanitized = sanitizePostToolAssistantResponse(content, writeContext());

    expect(sanitized).toContain('반영 완료');
    expect(sanitized).toContain('`test/tetris.html`');
    expect(sanitized).toContain('전체 코드는 출력하지 않았습니다');
    expect(sanitized).not.toContain('<!doctype html>');
  });

  it('keeps concise summaries as-is', () => {
    const content = '반영 완료: `test/tetris.html`';

    expect(sanitizePostToolAssistantResponse(content, writeContext())).toBe(content);
  });

  it('instructs the model not to paste full files after edits', () => {
    const prompt = buildSystemPrompt(process.cwd());

    expect(prompt).toContain('do not paste the full file contents');
    expect(prompt).toContain('Do not tell the user to copy code from the chat');
  });
});
