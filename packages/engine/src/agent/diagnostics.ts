import { execFileSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { writeAtomic } from '@solar-code/core';
import type { AgentSessionState } from './messages.js';
import { calculateSessionStats } from './compaction.js';
import { loadUsage } from './usage.js';

export interface DiffSummary {
  ok: boolean;
  output: string;
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1024 * 1024,
  }).trim();
}

export function getGitDiffSummary(cwd: string): DiffSummary {
  try {
    git(cwd, ['rev-parse', '--is-inside-work-tree']);
  } catch {
    return { ok: false, output: 'not a git repository' };
  }

  const sections: string[] = [];
  const status = git(cwd, ['status', '--short']);
  const unstaged = git(cwd, ['diff', '--stat']);
  const staged = git(cwd, ['diff', '--cached', '--stat']);
  const shortstat = [
    git(cwd, ['diff', '--shortstat']),
    git(cwd, ['diff', '--cached', '--shortstat']),
  ].filter(Boolean).join('\n');

  if (status) sections.push(`status:\n${status}`);
  if (staged) sections.push(`staged diff:\n${staged}`);
  if (unstaged) sections.push(`unstaged diff:\n${unstaged}`);
  if (shortstat) sections.push(`summary:\n${shortstat}`);
  return { ok: true, output: sections.length ? sections.join('\n\n') : 'no working tree changes' };
}

export function formatSessionSummary(session: AgentSessionState, omsDir: string): string {
  const stats = calculateSessionStats(session.messages);
  return [
    `session: ${session.id}`,
    `file: ${join(omsDir, 'sessions', `${session.id}.jsonl`)}`,
    `turns: ${session.turns}`,
    `messages: ${stats.messages} (${stats.userMessages} user, ${stats.assistantMessages} assistant, ${stats.toolMessages} tool, ${stats.systemMessages} system)`,
    `tool calls: ${stats.toolCalls}`,
    `approx tokens: ${stats.approxTokens}`,
  ].join('\n');
}

export function formatCostSummary(session: AgentSessionState, omsDir: string): string {
  const stats = calculateSessionStats(session.messages);
  const usage = loadUsage(omsDir, session.id);
  return [
    `approx input context: ${stats.approxTokens} tokens (${stats.chars} chars)`,
    `estimated model prompt tokens: ${usage.estimatedPromptTokens}`,
    `estimated model completion tokens: ${usage.estimatedCompletionTokens}`,
    `estimated tool-result tokens: ${usage.estimatedToolTokens}`,
    `model requests: ${usage.modelRequests}`,
    `messages: ${stats.messages}`,
    `tool calls: ${stats.toolCalls} (${usage.toolExecutions} executed)`,
    'provider billing: not available from the current streaming response',
  ].join('\n');
}

export function exportSession(session: AgentSessionState, omsDir: string, format: 'json' | 'md'): string {
  const file = join(omsDir, 'sessions', `${session.id}.${format === 'json' ? 'export.json' : 'md'}`);
  if (format === 'json') {
    const usage = loadUsage(omsDir, session.id);
    const body = JSON.stringify({ sessionId: session.id, turns: session.turns, usage, messages: session.messages }, null, 2);
    return writeExport(file, body);
  }
  const body = [
    `# Solar Code Session ${session.id}`,
    '',
    `Turns: ${session.turns}`,
    '',
    ...session.messages.map((message, index) => {
      if (message.role === 'tool') return `## ${index + 1}. tool:${message.name}\n\n\`\`\`text\n${message.content}\n\`\`\``;
      if (message.role === 'assistant') return `## ${index + 1}. assistant\n\n${message.content ?? '[tool call]'}${message.tool_calls ? `\n\nTool calls: ${message.tool_calls.map((call) => call.function.name).join(', ')}` : ''}`;
      return `## ${index + 1}. ${message.role}\n\n${message.content}`;
    }),
    '',
  ].join('\n');
  return writeExport(file, body);
}

function writeExport(file: string, body: string): string {
  writeAtomic(file, body);
  return file;
}

export function listSessionSummaries(omsDir: string, limit = 10): string {
  const sessionsDir = join(omsDir, 'sessions');
  if (!existsSync(sessionsDir)) return 'no sessions found';
  const records = readdirSync(sessionsDir)
    .filter((file) => file.endsWith('.json') && !file.endsWith('.usage.json') && !file.endsWith('.export.json'))
    .map((file) => {
      const path = join(sessionsDir, file);
      return { path, file, mtime: statSync(path).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit)
    .map(({ path }) => {
      try {
        const parsed = JSON.parse(readFileSync(path, 'utf-8')) as { id?: string; model?: string; command?: string; turns?: number; updatedAt?: string };
        return `${parsed.id ?? 'unknown'}  ${parsed.model ?? '-'}  turns:${parsed.turns ?? 0}  ${parsed.command ?? '-'}  ${parsed.updatedAt ?? ''}`.trim();
      } catch {
        return path;
      }
    });
  return records.length ? records.join('\n') : 'no sessions found';
}
