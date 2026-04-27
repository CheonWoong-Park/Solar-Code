/**
 * oms team <n> [goal] — spawn N workers with tmux + git worktrees.
 * Subcommands: status, resume, stop, logs
 */

import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  loadConfig,
  getOmsDir,
  getUpstageApiKey,
  createTeamSession,
  runTeamSession,
  getLastTeamSession,
} from '@solar-code/core';

export async function cmdTeam(
  args: string[],
  flags: Record<string, string | boolean>
): Promise<number> {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const omsDir = getOmsDir(cwd);

  // Subcommands
  const sub = args[0];
  if (sub === 'status') return teamStatus(omsDir);
  if (sub === 'stop') return teamStop(omsDir);
  if (sub === 'logs') return teamLogs(omsDir);
  if (sub === 'resume') return teamResume(omsDir, config.model, getUpstageApiKey());

  // Main: oms team <n> [goal]
  const apiKey = getUpstageApiKey();
  if (!apiKey) {
    process.stderr.write('Error: UPSTAGE_API_KEY is not set.\n');
    return 1;
  }

  const nRaw = args[0];
  const nWorkers = parseInt(nRaw ?? '3', 10);
  if (isNaN(nWorkers) || nWorkers < 1) {
    process.stderr.write('Usage: oms team <n> [goal]\nExample: oms team 3 "결제 모듈 리팩토링"\n');
    return 1;
  }

  const goal = args.slice(1).join(' ').trim() || (flags['goal'] as string | undefined);
  if (!goal) {
    process.stderr.write('Usage: oms team <n> <goal>\nExample: oms team 3 "결제 모듈 리팩토링"\n');
    return 1;
  }

  const model = (flags['model'] as string) ?? config.model ?? 'solar-pro3';

  process.stdout.write(`\n[oms team] Creating team of ${nWorkers} for: ${goal}\n\n`);

  const session = await createTeamSession(omsDir, goal, nWorkers, cwd);
  process.stdout.write(`  Session ID: ${session.id}\n`);
  process.stdout.write(`  Workers: ${session.workers.map(w => `${w.id}:${w.role}`).join(', ')}\n\n`);

  await runTeamSession(session, omsDir, model, apiKey);

  return 0;
}

async function teamStatus(omsDir: string): Promise<number> {
  const session = getLastTeamSession(omsDir);
  if (!session) {
    process.stdout.write('[oms team status] No active team session.\n');
    return 0;
  }
  process.stdout.write(`\nTeam Session: ${session.id}\n`);
  process.stdout.write(`  Goal: ${session.goal}\n`);
  process.stdout.write(`  Started: ${session.startedAt}\n`);
  process.stdout.write(`  Status: ${session.status}\n`);
  process.stdout.write(`  Workers:\n`);
  for (const w of session.workers) {
    process.stdout.write(`    ${w.id}. [${w.role}] ${w.status}\n`);
  }
  process.stdout.write('\n');

  // Check if tmux session is running
  const tmuxSession = `oms-team-${session.id}`;
  const check = spawnSync('tmux', ['has-session', '-t', tmuxSession], { encoding: 'utf-8' });
  if (check.status === 0) {
    process.stdout.write(`  tmux session active: ${tmuxSession}\n`);
    process.stdout.write(`  Attach: tmux attach -t ${tmuxSession}\n\n`);
  }

  return 0;
}

async function teamStop(omsDir: string): Promise<number> {
  const session = getLastTeamSession(omsDir);
  if (!session) {
    process.stdout.write('[oms team stop] No active team session.\n');
    return 0;
  }
  const tmuxSession = `oms-team-${session.id}`;
  const kill = spawnSync('tmux', ['kill-session', '-t', tmuxSession], { encoding: 'utf-8' });
  if (kill.status === 0) {
    process.stdout.write(`[oms team stop] Stopped tmux session ${tmuxSession}\n`);
  } else {
    process.stdout.write(`[oms team stop] Session ${tmuxSession} not running or already stopped.\n`);
  }
  return 0;
}

async function teamLogs(omsDir: string): Promise<number> {
  const session = getLastTeamSession(omsDir);
  if (!session) {
    process.stdout.write('[oms team logs] No active team session.\n');
    return 0;
  }
  const logFile = join(omsDir, 'team', session.id, 'team.log');
  if (!existsSync(logFile)) {
    process.stdout.write('[oms team logs] No log file found.\n');
    return 0;
  }
  process.stdout.write(readFileSync(logFile, 'utf-8'));
  return 0;
}

async function teamResume(
  omsDir: string,
  model: string,
  apiKey: string | undefined
): Promise<number> {
  const session = getLastTeamSession(omsDir);
  if (!session) {
    process.stdout.write('[oms team resume] No team session to resume.\n');
    return 1;
  }
  process.stdout.write(`\n[oms team resume] Resuming session ${session.id}\n`);
  if (!apiKey) {
    process.stderr.write('Error: UPSTAGE_API_KEY is not set.\n');
    return 1;
  }
  await runTeamSession(session, omsDir, model, apiKey);
  return 0;
}
