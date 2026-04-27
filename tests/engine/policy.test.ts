import { describe, expect, it } from 'vitest';
import { directResponseForPrompt, suppressReasonForToolCall } from '../../packages/engine/src/agent/policy.js';
import type { AgentToolCall } from '../../packages/engine/src/tools/index.js';

const cwd = '/mnt/d/DEV/OhMySolar';

function toolCall(name: string, args: Record<string, unknown>): AgentToolCall {
  return {
    id: 'call_1',
    name,
    arguments: args,
    rawArguments: JSON.stringify(args),
  };
}

describe('agent policy', () => {
  it('answers identity prompts locally instead of relying on tools', () => {
    const response = directResponseForPrompt('who are you', { cwd });

    expect(response?.content).toContain('Solar Code');
    expect(response?.content).toContain('도구를 쓰지 않고');
  });

  it('does not classify greeting plus coding work as casual chat', () => {
    const response = directResponseForPrompt('ㅎㅇ test/tetris.html 만들어줘', { cwd });

    expect(response).toBeUndefined();
  });

  it('explains workspace boundaries before an outside file write reaches the model', () => {
    const response = directResponseForPrompt('/mnt/d/DEV/test 에 테트리스.html을 만들어줘', { cwd });

    expect(response?.content).toContain('/mnt/d/DEV/test');
    expect(response?.content).toContain('workspace');
    expect(response?.content).toContain('cd /mnt/d/DEV/test');
  });

  it('suppresses shell inspection for casual prompts', () => {
    const reason = suppressReasonForToolCall(toolCall('bash', { command: 'whoami' }), '너는 누구니');

    expect(reason).toContain('casual prompt');
    expect(reason).toContain('whoami');
  });

  it('allows tools for real coding prompts', () => {
    const reason = suppressReasonForToolCall(toolCall('bash', { command: 'npm test' }), '테스트 실행해줘');

    expect(reason).toBeUndefined();
  });
});
