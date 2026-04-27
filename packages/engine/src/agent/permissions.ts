import * as readline from 'readline';
import { formatApprovalPrompt } from './output.js';
import type { ToolExecutor } from '../tools/index.js';

export type PermissionMode = 'ask' | 'auto' | 'readonly';
export type PermissionProfile = 'standard' | 'trusted' | 'locked';

export interface PermissionDecision {
  allowed: boolean;
  reason?: string;
}

function askApproval(question: string): Promise<boolean> {
  process.stdout.write(question);
  if (!process.stdin.isTTY || !process.stdout.isTTY) return Promise.resolve(false);

  return new Promise((resolve) => {
    const input = process.stdin;
    const previousRawMode = input.isRaw;
    let resolved = false;

    const finish = (allowed: boolean): void => {
      if (resolved) return;
      resolved = true;
      input.off('keypress', onKeypress);
      if (typeof input.setRawMode === 'function') input.setRawMode(previousRawMode);
      process.stdout.write(`${allowed ? 'approved' : 'denied'}\n`);
      resolve(allowed);
    };

    const onKeypress = (str: string, key: readline.Key): void => {
      const value = str.toLowerCase();
      if (value === 'y') {
        finish(true);
        return;
      }
      if (value === 'n' || key.name === 'return' || key.name === 'enter' || key.name === 'escape') {
        finish(false);
        return;
      }
      if (key.ctrl && (key.name === 'c' || key.name === 'd')) {
        finish(false);
        return;
      }
      process.stdout.write('\x07');
    };

    readline.emitKeypressEvents(input);
    input.on('keypress', onKeypress);
    if (typeof input.setRawMode === 'function') input.setRawMode(true);
    input.resume();
  });
}

export async function confirmToolExecution(
  mode: PermissionMode,
  tool: ToolExecutor,
  description: string,
  profile: PermissionProfile = 'standard'
): Promise<PermissionDecision> {
  if (profile === 'locked' && tool.permission !== 'read') {
    return { allowed: false, reason: `locked profile blocks ${tool.name}` };
  }
  if (mode === 'readonly' && tool.permission !== 'read') {
    return { allowed: false, reason: `readonly mode blocks ${tool.name}` };
  }
  if (tool.permission === 'read' || mode === 'auto') {
    return { allowed: true };
  }
  if (profile === 'trusted' && tool.permission === 'write') {
    return { allowed: true };
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return { allowed: false, reason: `approval required for ${tool.name}; rerun with --yes to auto-approve` };
  }
  const approved = await askApproval(formatApprovalPrompt(tool.name, description));
  if (approved) {
    return { allowed: true };
  }
  return { allowed: false, reason: `denied by user: ${tool.name}` };
}

export function permissionModeFromFlags(flags: Record<string, string | boolean>): PermissionMode {
  const explicit = flags['permission'];
  if (explicit === 'auto' || explicit === 'ask' || explicit === 'readonly') return explicit;
  if (flags['yes'] === true || flags['y'] === true) return 'auto';
  if (flags['readonly'] === true) return 'readonly';
  return 'ask';
}

export function permissionProfileFromFlags(
  flags: Record<string, string | boolean>,
  fallback: PermissionProfile = 'standard'
): PermissionProfile {
  const explicit = flags['profile'] ?? flags['permission-profile'];
  if (explicit === 'standard' || explicit === 'trusted' || explicit === 'locked') return explicit;
  if (flags['readonly'] === true) return 'locked';
  return fallback;
}
