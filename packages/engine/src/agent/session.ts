import {
  createSession,
  ensureOmsDirs,
  getLastSession,
  updateSession,
  writeAtomic,
} from '@solar-code/core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { AgentMessage, AgentSessionState } from './messages.js';

export interface OpenSessionOptions {
  omsDir: string;
  model: string;
  command: string;
  resume?: boolean;
}

function sessionJsonlPath(omsDir: string, id: string): string {
  return join(omsDir, 'sessions', `${id}.jsonl`);
}

function isAgentMessage(value: unknown): value is AgentMessage {
  if (!value || typeof value !== 'object') return false;
  const role = (value as { role?: unknown }).role;
  return role === 'system' || role === 'user' || role === 'assistant' || role === 'tool';
}

export function appendSessionMessage(omsDir: string, sessionId: string, message: AgentMessage): void {
  const file = sessionJsonlPath(omsDir, sessionId);
  mkdirSync(join(omsDir, 'sessions'), { recursive: true });
  writeFileSync(file, `${JSON.stringify(message)}\n`, { flag: 'a', encoding: 'utf-8' });
}

export function loadSessionMessages(omsDir: string, sessionId: string): AgentMessage[] {
  const file = sessionJsonlPath(omsDir, sessionId);
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, 'utf-8').split(/\r?\n/).filter(Boolean);
  const messages: AgentMessage[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as unknown;
      if (isAgentMessage(parsed)) messages.push(parsed);
    } catch {
      // Ignore malformed historical lines.
    }
  }
  return messages;
}

export function openAgentSession(options: OpenSessionOptions): AgentSessionState {
  ensureOmsDirs(options.omsDir);
  if (options.resume) {
    const last = getLastSession(options.omsDir);
    if (!last) {
      throw new Error('No previous session found. Start one with: oms');
    }
    return {
      id: last.id,
      turns: last.turns ?? 0,
      messages: loadSessionMessages(options.omsDir, last.id),
    };
  }

  const session = createSession(options.omsDir, options.model, 'upstage', options.command);
  writeAtomic(sessionJsonlPath(options.omsDir, session.id), '');
  return { id: session.id, turns: 0, messages: [] };
}

export function updateAgentSessionTurns(omsDir: string, session: AgentSessionState): void {
  updateSession(omsDir, session.id, { turns: session.turns });
}
