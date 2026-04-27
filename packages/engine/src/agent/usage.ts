import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { writeAtomic } from '@solar-code/core';
import type { AgentMessage } from './messages.js';
import type { AgentToolCall } from '../tools/index.js';

export interface UsageRecord {
  sessionId: string;
  updatedAt: string;
  modelRequests: number;
  toolExecutions: number;
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  estimatedToolTokens: number;
}

export interface ModelUsageInput {
  messages: AgentMessage[];
  content: string;
  toolCalls: AgentToolCall[];
}

function usagePath(omsDir: string, sessionId: string): string {
  return join(omsDir, 'sessions', `${sessionId}.usage.json`);
}

function estimateTokens(text: string): number {
  return Math.max(0, Math.ceil(text.length / 4));
}

function messageText(message: AgentMessage): string {
  if (message.role === 'assistant') {
    return [message.content ?? '', JSON.stringify(message.tool_calls ?? [])].join('\n');
  }
  if (message.role === 'tool') return `${message.name}\n${message.content}`;
  return message.content;
}

function emptyUsage(sessionId: string): UsageRecord {
  return {
    sessionId,
    updatedAt: new Date().toISOString(),
    modelRequests: 0,
    toolExecutions: 0,
    estimatedPromptTokens: 0,
    estimatedCompletionTokens: 0,
    estimatedToolTokens: 0,
  };
}

export function loadUsage(omsDir: string, sessionId: string): UsageRecord {
  const file = usagePath(omsDir, sessionId);
  if (!existsSync(file)) return emptyUsage(sessionId);
  try {
    return { ...emptyUsage(sessionId), ...JSON.parse(readFileSync(file, 'utf-8')) as Partial<UsageRecord> };
  } catch {
    return emptyUsage(sessionId);
  }
}

export function saveUsage(omsDir: string, usage: UsageRecord): void {
  writeAtomic(usagePath(omsDir, usage.sessionId), JSON.stringify({ ...usage, updatedAt: new Date().toISOString() }, null, 2));
}

export function recordModelUsage(omsDir: string, sessionId: string, input: ModelUsageInput): UsageRecord {
  const usage = loadUsage(omsDir, sessionId);
  usage.modelRequests += 1;
  usage.estimatedPromptTokens += estimateTokens(input.messages.map(messageText).join('\n'));
  usage.estimatedCompletionTokens += estimateTokens([
    input.content,
    input.toolCalls.map((call) => `${call.name} ${call.rawArguments}`).join('\n'),
  ].join('\n'));
  saveUsage(omsDir, usage);
  return usage;
}

export function recordToolUsage(omsDir: string, sessionId: string, toolName: string, content: string): UsageRecord {
  const usage = loadUsage(omsDir, sessionId);
  usage.toolExecutions += 1;
  usage.estimatedToolTokens += estimateTokens(`${toolName}\n${content}`);
  saveUsage(omsDir, usage);
  return usage;
}
