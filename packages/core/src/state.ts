import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { join, dirname, basename } from 'path';
import { randomBytes } from 'crypto';

/** Atomic write: write to tmp then rename to avoid partial reads. */
export function writeAtomic(filePath: string, content: string): void {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.${basename(filePath)}.${randomBytes(6).toString('hex')}.tmp`);
  writeFileSync(tmp, content, 'utf-8');
  renameSync(tmp, filePath);
}

/** Append-only log write. */
export function appendLog(filePath: string, line: string): void {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const entry = `${new Date().toISOString()} ${line}\n`;
  writeFileSync(filePath, entry, { flag: 'a', encoding: 'utf-8' });
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile(filePath: string, data: unknown): void {
  writeAtomic(filePath, JSON.stringify(data, null, 2));
}

export interface SessionRecord {
  id: string;
  startedAt: string;
  updatedAt: string;
  model: string;
  provider: string;
  command: string;
  turns: number;
}

export function createSession(
  omsDir: string,
  model: string,
  provider: string,
  command: string
): SessionRecord {
  const id = `${Date.now()}-${randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();
  const session: SessionRecord = {
    id,
    startedAt: now,
    updatedAt: now,
    model,
    provider,
    command,
    turns: 0,
  };
  const sessionDir = join(omsDir, 'sessions');
  mkdirSync(sessionDir, { recursive: true });
  writeJsonFile(join(sessionDir, `${id}.json`), session);
  writeAtomic(join(omsDir, 'state', 'last-session.json'), JSON.stringify({ id }, null, 2));
  return session;
}

export function updateSession(omsDir: string, sessionId: string, updates: Partial<SessionRecord>): void {
  const path = join(omsDir, 'sessions', `${sessionId}.json`);
  if (!existsSync(path)) return;
  const current = readJsonFile<SessionRecord>(path, {} as SessionRecord);
  writeJsonFile(path, { ...current, ...updates, updatedAt: new Date().toISOString() });
}

export function getLastSession(omsDir: string): SessionRecord | null {
  const lastPath = join(omsDir, 'state', 'last-session.json');
  const ref = readJsonFile<{ id?: string }>(lastPath, {});
  if (!ref.id) return null;
  const sessionPath = join(omsDir, 'sessions', `${ref.id}.json`);
  return readJsonFile<SessionRecord | null>(sessionPath, null);
}

export function ensureOmsDirs(omsDir: string): void {
  const dirs = [
    'state',
    'logs',
    'logs/reviews',
    'plans',
    'memory',
    'sessions',
    'parsed',
    'team',
    'hooks',
    'agents',
    'skills',
  ];
  for (const d of dirs) {
    mkdirSync(join(omsDir, d), { recursive: true });
  }
}
