import type { AgentMessage } from './messages.js';

const LARGE_RESPONSE_CHARS = 1_800;
const LARGE_CODE_BLOCK_CHARS = 600;

function lastUserPrompt(messages: AgentMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === 'user') return message.content;
  }
  return '';
}

function explicitCodeOutputRequested(prompt: string): boolean {
  return /(전체\s*코드|코드\s*(보여|출력|붙여|줘)|source\s*code|print\s+the\s+code|show\s+.*code|paste\s+.*code)/i.test(prompt);
}

function trailingToolMessages(messages: AgentMessage[]): AgentMessage[] {
  const tools: AgentMessage[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== 'tool') break;
    tools.unshift(message);
  }
  return tools;
}

function modifiedFiles(messages: AgentMessage[]): string[] {
  const files: string[] = [];
  for (const message of trailingToolMessages(messages)) {
    if (message.role !== 'tool') continue;
    if (message.name === 'write_file') {
      const match = message.content.match(/Wrote\s+\d+\s+chars\s+to\s+(.+)$/);
      if (match?.[1]) files.push(match[1].trim());
    }
    if (message.name === 'edit_file') {
      const match = message.content.match(/Edited\s+(.+?);/);
      if (match?.[1]) files.push(match[1].trim());
    }
  }
  return [...new Set(files)];
}

function hasLargeCodeBlock(content: string): boolean {
  const codeBlockPattern = /```[\s\S]*?```/g;
  for (const match of content.matchAll(codeBlockPattern)) {
    if (match[0].length >= LARGE_CODE_BLOCK_CHARS) return true;
  }
  return false;
}

export function shouldConstrainPostToolResponse(messages: AgentMessage[]): boolean {
  if (explicitCodeOutputRequested(lastUserPrompt(messages))) return false;
  return modifiedFiles(messages).length > 0;
}

export function sanitizePostToolAssistantResponse(content: string, messages: AgentMessage[]): string {
  if (!shouldConstrainPostToolResponse(messages)) return content;
  const files = modifiedFiles(messages);
  if (files.length === 0) return content;

  const shouldReplace = content.length >= LARGE_RESPONSE_CHARS || hasLargeCodeBlock(content);
  if (!shouldReplace) return content;

  const fileList = files.map((file) => `\`${file}\``).join(', ');
  return [
    `반영 완료: ${fileList}`,
    '전체 코드는 출력하지 않았습니다.',
    '변경 요약은 `/diff`, 세션 내역은 `/session`으로 확인할 수 있습니다.',
  ].join('\n');
}
