import type { AgentMessage } from './messages.js';

const MEMORY_MARKER = '[Solar Code session memory]';
const DEFAULT_MAX_CHARS = 70_000;
const DEFAULT_MAX_MESSAGES = 90;
const DEFAULT_KEEP_MESSAGES = 28;

export interface SessionStats {
  messages: number;
  systemMessages: number;
  userMessages: number;
  assistantMessages: number;
  toolMessages: number;
  toolCalls: number;
  chars: number;
  approxTokens: number;
}

export interface CompactionOptions {
  force?: boolean;
  maxChars?: number;
  maxMessages?: number;
  keepMessages?: number;
}

export interface CompactionResult {
  compacted: boolean;
  messages: AgentMessage[];
  archivedMessages: number;
  before: SessionStats;
  after: SessionStats;
}

function isMemoryMessage(message: AgentMessage): boolean {
  return message.role === 'system' && message.content.startsWith(MEMORY_MARKER);
}

function messageContent(message: AgentMessage): string {
  if (message.role === 'assistant') {
    const toolCalls = message.tool_calls?.map((call) => call.function.name).join(', ');
    return [message.content ?? '', toolCalls ? `tool_calls: ${toolCalls}` : ''].filter(Boolean).join('\n');
  }
  if (message.role === 'tool') return `${message.name}: ${message.content}`;
  return message.content;
}

function compactLine(value: string, maxLength = 180): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

export function calculateSessionStats(messages: AgentMessage[]): SessionStats {
  let toolCalls = 0;
  let chars = 0;
  for (const message of messages) {
    chars += messageContent(message).length;
    if (message.role === 'assistant') toolCalls += message.tool_calls?.length ?? 0;
  }
  return {
    messages: messages.length,
    systemMessages: messages.filter((message) => message.role === 'system').length,
    userMessages: messages.filter((message) => message.role === 'user').length,
    assistantMessages: messages.filter((message) => message.role === 'assistant').length,
    toolMessages: messages.filter((message) => message.role === 'tool').length,
    toolCalls,
    chars,
    approxTokens: Math.ceil(chars / 4),
  };
}

function tailStartIndex(nonSystem: AgentMessage[], keepMessages: number): number {
  let start = Math.max(0, nonSystem.length - keepMessages);
  while (start > 0 && nonSystem[start]?.role === 'tool') start--;
  return start;
}

function summarizeArchivedMessages(messages: AgentMessage[]): string {
  const userRequests = messages
    .filter((message) => message.role === 'user')
    .slice(-12)
    .map((message) => `- ${compactLine(message.content)}`);
  const tools = new Map<string, number>();
  const modifiedPaths: string[] = [];

  for (const message of messages) {
    if (message.role !== 'tool') continue;
    tools.set(message.name, (tools.get(message.name) ?? 0) + 1);
    if (message.name === 'write_file' || message.name === 'edit_file') {
      const match = message.content.match(/\b(?:to|Wrote|Edited)\s+([^\s]+)/i);
      if (match?.[1]) modifiedPaths.push(match[1]);
    }
  }

  const toolSummary = [...tools.entries()].map(([name, count]) => `- ${name}: ${count}`).join('\n');
  const pathSummary = [...new Set(modifiedPaths)].slice(-12).map((path) => `- ${path}`).join('\n');

  return [
    MEMORY_MARKER,
    `Compacted ${messages.length} earlier messages. Keep this memory as durable session context.`,
    userRequests.length ? `Earlier user requests:\n${userRequests.join('\n')}` : undefined,
    toolSummary ? `Tools used:\n${toolSummary}` : undefined,
    pathSummary ? `Files modified or created:\n${pathSummary}` : undefined,
  ].filter(Boolean).join('\n\n');
}

export function compactSessionMessages(
  messages: AgentMessage[],
  options: CompactionOptions = {}
): CompactionResult {
  const before = calculateSessionStats(messages);
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const maxMessages = options.maxMessages ?? DEFAULT_MAX_MESSAGES;
  const keepMessages = Math.max(8, options.keepMessages ?? DEFAULT_KEEP_MESSAGES);
  const shouldCompact = options.force === true || before.chars > maxChars || before.messages > maxMessages;

  if (!shouldCompact) {
    return { compacted: false, messages, archivedMessages: 0, before, after: before };
  }

  const baseSystem = messages.filter((message) => message.role === 'system' && !isMemoryMessage(message));
  const nonSystem = messages.filter((message) => message.role !== 'system');
  const start = tailStartIndex(nonSystem, keepMessages);
  const archived = nonSystem.slice(0, start);
  const tail = nonSystem.slice(start);

  if (archived.length === 0) {
    return { compacted: false, messages, archivedMessages: 0, before, after: before };
  }

  const memory: AgentMessage = {
    role: 'system',
    content: summarizeArchivedMessages(archived),
  };
  const compactedMessages = [...baseSystem, memory, ...tail];
  return {
    compacted: true,
    messages: compactedMessages,
    archivedMessages: archived.length,
    before,
    after: calculateSessionStats(compactedMessages),
  };
}
