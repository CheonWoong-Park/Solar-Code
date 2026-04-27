import type { AgentMessage, ChatToolCall } from './messages.js';
import type { AgentToolCall } from '../tools/index.js';

export interface MockStreamResult {
  content: string;
  finishReason: string | null;
  toolCalls: AgentToolCall[];
  assistantToolCalls: ChatToolCall[];
}

function lastUser(messages: AgentMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === 'user') return message.content;
  }
  return '';
}

export async function mockStreamChatCompletion(
  messages: AgentMessage[],
  onContent?: (text: string) => void
): Promise<MockStreamResult> {
  const prompt = lastUser(messages);
  const content = `mock solar: ${prompt || 'ready'}`;
  for (const chunk of content.match(/.{1,16}/g) ?? [content]) {
    onContent?.(chunk);
    await Promise.resolve();
  }
  return {
    content,
    finishReason: 'stop',
    toolCalls: [],
    assistantToolCalls: [],
  };
}
