/**
 * oms hud — live session/team status dashboard.
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { getOmsDir, loadConfig, getLastSession, getLastTeamSession } from '@solar-code/core';

export async function cmdHud(
  _args: string[],
  _flags: Record<string, string | boolean>
): Promise<number> {
  const cwd = process.cwd();
  const omsDir = getOmsDir(cwd);
  const config = loadConfig(cwd);

  process.stdout.write('\n=== Solar Code HUD ===\n\n');

  // Config
  process.stdout.write(`Config:\n`);
  process.stdout.write(`  Provider: ${config.provider}\n`);
  process.stdout.write(`  Model:    ${config.model}\n`);
  process.stdout.write(`  Language: ${config.language}\n`);
  process.stdout.write(`  Backend:  ${config.backend}\n\n`);

  // Last session
  const session = getLastSession(omsDir);
  if (session) {
    process.stdout.write(`Last Session:\n`);
    process.stdout.write(`  ID:      ${session.id}\n`);
    process.stdout.write(`  Command: ${session.command}\n`);
    process.stdout.write(`  Model:   ${session.model}\n`);
    process.stdout.write(`  Updated: ${session.updatedAt}\n\n`);
  }

  // Last team session
  const team = getLastTeamSession(omsDir);
  if (team) {
    process.stdout.write(`Last Team Session:\n`);
    process.stdout.write(`  ID:      ${team.id}\n`);
    process.stdout.write(`  Goal:    ${team.goal}\n`);
    process.stdout.write(`  Workers: ${team.workers.length}\n`);
    process.stdout.write(`  Status:  ${team.status}\n\n`);

    // Check tmux
    const tmuxSession = `oms-team-${team.id}`;
    const check = spawnSync('tmux', ['has-session', '-t', tmuxSession], { encoding: 'utf-8' });
    if (check.status === 0) {
      process.stdout.write(`  tmux: ACTIVE — tmux attach -t ${tmuxSession}\n\n`);
    }
  }

  // Recent plans
  const plansDir = join(omsDir, 'plans');
  if (existsSync(plansDir)) {
    const plans = readdirSync(plansDir)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .slice(-3)
      .reverse();
    if (plans.length > 0) {
      process.stdout.write(`Recent Plans:\n`);
      for (const plan of plans) {
        const stat = statSync(join(plansDir, plan));
        process.stdout.write(`  ${plan} (${formatDate(stat.mtime)})\n`);
      }
      process.stdout.write('\n');
    }
  }

  // Recent parsed files
  const parsedDir = join(omsDir, 'parsed');
  if (existsSync(parsedDir)) {
    const parsed = readdirSync(parsedDir).sort().slice(-3).reverse();
    if (parsed.length > 0) {
      process.stdout.write(`Recent Parsed Files:\n`);
      for (const f of parsed) {
        const stat = statSync(join(parsedDir, f));
        process.stdout.write(`  ${f} (${formatDate(stat.mtime)})\n`);
      }
      process.stdout.write('\n');
    }
  }

  // State summary
  process.stdout.write(`State Directory: ${omsDir}\n\n`);

  return 0;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 16).replace('T', ' ');
}
