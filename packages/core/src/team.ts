/**
 * Team runtime — spawns N workers using tmux + git worktrees.
 * Falls back to sequential mode if tmux is unavailable.
 */

import { spawnSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { writeJsonFile, readJsonFile, appendLog } from './state.js';

export type WorkerRole = 'planner' | 'architect' | 'executor' | 'reviewer' | 'researcher';

export interface WorkerSpec {
  id: number;
  role: WorkerRole;
  goal: string;
  branch: string;
  worktreePath: string;
  sessionId: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  output?: string;
}

export interface TeamSession {
  id: string;
  startedAt: string;
  goal: string;
  workers: WorkerSpec[];
  status: 'running' | 'done' | 'stopped';
  summaryPath?: string;
}

const ROLES: WorkerRole[] = ['planner', 'architect', 'executor', 'reviewer', 'researcher'];

function isTmuxAvailable(): boolean {
  const result = spawnSync('tmux', ['-V'], { encoding: 'utf-8' });
  return result.status === 0;
}

function isGitAvailable(): boolean {
  const result = spawnSync('git', ['--version'], { encoding: 'utf-8' });
  return result.status === 0;
}

function safeBranch(role: WorkerRole, sessionId: string, idx: number): string {
  return `oms-team-${sessionId}-${idx + 1}-${role}`.slice(0, 60);
}

export async function createTeamSession(
  omsDir: string,
  goal: string,
  workerCount: number,
  cwd: string
): Promise<TeamSession> {
  const sessionId = randomBytes(4).toString('hex');
  const sessionDir = join(omsDir, 'team', sessionId);
  const worktreesDir = join(sessionDir, 'worktrees');
  mkdirSync(worktreesDir, { recursive: true });

  const workers: WorkerSpec[] = [];
  const count = Math.min(workerCount, 8);
  const gitAvail = isGitAvailable();

  for (let i = 0; i < count; i++) {
    const role = ROLES[i % ROLES.length];
    const branch = safeBranch(role, sessionId, i);
    const wtPath = join(worktreesDir, `worker-${i + 1}`);

    if (gitAvail && existsSync(join(cwd, '.git'))) {
      const wtResult = spawnSync('git', ['worktree', 'add', '-b', branch, wtPath], {
        cwd,
        encoding: 'utf-8',
      });
      if (wtResult.status !== 0) {
        process.stderr.write(`[oms team] Warning: could not create worktree for worker ${i + 1}: ${wtResult.stderr}\n`);
      }
    }

    workers.push({
      id: i + 1,
      role,
      goal,
      branch,
      worktreePath: wtPath,
      sessionId,
      status: 'pending',
    });
  }

  const session: TeamSession = {
    id: sessionId,
    startedAt: new Date().toISOString(),
    goal,
    workers,
    status: 'running',
  };

  writeJsonFile(join(sessionDir, 'session.json'), session);
  writeJsonFile(join(omsDir, 'state', 'last-team-session.json'), { id: sessionId });

  return session;
}

export async function runTeamSession(
  session: TeamSession,
  omsDir: string,
  model: string,
  _apiKey: string | undefined
): Promise<void> {
  const useTmux = isTmuxAvailable();
  const sessionDir = join(omsDir, 'team', session.id);
  const logFile = join(sessionDir, 'team.log');

  if (!useTmux) {
    process.stdout.write(
      `\n[oms team] tmux not found — running workers sequentially.\n` +
        `Install tmux for parallel execution: https://github.com/tmux/tmux\n\n`
    );
  }

  const tmuxSession = `oms-team-${session.id}`;
  if (useTmux) {
    spawnSync('tmux', ['new-session', '-d', '-s', tmuxSession, '-x', '220', '-y', '50'], {
      encoding: 'utf-8',
    });
  }

  for (let i = 0; i < session.workers.length; i++) {
    const worker = session.workers[i];
    const windowName = `worker-${worker.id}-${worker.role}`;
    const workerPrompt = buildWorkerPrompt(worker);

    appendLog(logFile, `[worker ${worker.id}] Starting role=${worker.role}`);

    if (useTmux) {
      if (i === 0) {
        // Rename first window
        spawnSync('tmux', ['rename-window', '-t', `${tmuxSession}:0`, windowName], {
          encoding: 'utf-8',
        });
      } else {
        spawnSync('tmux', ['new-window', '-t', tmuxSession, '-n', windowName], {
          encoding: 'utf-8',
        });
      }
      // Run Solar Code in the tmux pane; auth is resolved by the child CLI.
      const workerCmd = buildSolarWorkerCmd(model, workerPrompt);
      spawnSync(
        'tmux',
        ['send-keys', '-t', `${tmuxSession}:${windowName}`, `cd ${shellQuote(worker.worktreePath)} && ${workerCmd}`, 'Enter'],
        { encoding: 'utf-8' }
      );
    } else {
      // Sequential fallback
      process.stdout.write(`\n--- Worker ${worker.id} [${worker.role}] ---\n`);
      const { ClawBackend } = await import('./backend/claw.js');
      const backend = new ClawBackend();
      const available = await backend.isAvailable();
      if (available) {
        const result = await backend.run({
          model,
          prompt: workerPrompt,
          cwd: worker.worktreePath,
          omsDir,
          stream: true,
        });
        session.workers[i].status = result.exitCode === 0 ? 'done' : 'failed';
        session.workers[i].output = result.output.slice(0, 2000);
      } else {
        process.stdout.write(`[oms team] claw not available — skipping worker ${worker.id}\n`);
        session.workers[i].status = 'failed';
      }
    }
  }

  if (useTmux) {
    process.stdout.write(
      `\n[oms team] Team spawned in tmux session: ${tmuxSession}\n` +
        `  Attach: tmux attach -t ${tmuxSession}\n` +
        `  Status: oms team status\n` +
        `  Stop:   oms team stop\n\n`
    );
  }
}

function buildWorkerPrompt(worker: WorkerSpec): string {
  const roleInstructions: Record<WorkerRole, string> = {
    planner: `You are the Planner. Break down the goal into clear sub-tasks and write a plan.md in the worktree.`,
    architect: `You are the Architect. Design the system structure, API boundaries, and write architecture.md.`,
    executor: `You are the Executor. Implement the plan. Focus on clean, working code.`,
    reviewer: `You are the Reviewer. Review the changes, find issues, security concerns, and write review.md.`,
    researcher: `You are the Researcher. Research relevant patterns, APIs, and write research.md with your findings.`,
  };
  return `${roleInstructions[worker.role]}\n\nGoal: ${worker.goal}`;
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function buildSolarWorkerCmd(model: string, prompt: string): string {
  return `solar --yes --model ${shellQuote(model)} ${shellQuote(prompt)}`;
}

export function getLastTeamSession(omsDir: string): TeamSession | null {
  const lastPath = join(omsDir, 'state', 'last-team-session.json');
  const ref = readJsonFile<{ id?: string }>(lastPath, {});
  if (!ref.id) return null;
  return readJsonFile<TeamSession | null>(
    join(omsDir, 'team', ref.id, 'session.json'),
    null
  );
}
