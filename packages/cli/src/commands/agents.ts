/**
 * oms agents — list/show/install agent profiles.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { getOmsDir } from '@solar-code/core';

interface AgentManifest {
  name: string;
  description: string;
  model?: string;
  tools?: string[];
  outputContract?: string;
}

export async function cmdAgents(
  args: string[],
  _flags: Record<string, string | boolean>
): Promise<number> {
  const cwd = process.cwd();
  const omsDir = getOmsDir(cwd);
  const agentsDir = join(omsDir, 'agents');

  const sub = args[0];

  if (sub === 'show' && args[1]) {
    return showAgent(agentsDir, args[1]);
  }

  // Default: list
  return listAgents(agentsDir);
}

function listAgents(agentsDir: string): number {
  if (!existsSync(agentsDir)) {
    process.stdout.write(
      '[oms agents] No agents directory found. Run `oms setup` first.\n'
    );
    return 0;
  }

  const entries = readdirSync(agentsDir);
  if (entries.length === 0) {
    process.stdout.write('[oms agents] No agents installed. Run `oms setup` to install defaults.\n');
    return 0;
  }

  process.stdout.write('\nInstalled Agents:\n\n');
  for (const entry of entries) {
    const manifestPath = join(agentsDir, entry, 'manifest.json');
    if (existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as AgentManifest;
        process.stdout.write(`  ${manifest.name.padEnd(20)} ${manifest.description}\n`);
      } catch {
        process.stdout.write(`  ${entry}\n`);
      }
    }
  }
  process.stdout.write('\nRun `oms agents show <name>` for details.\n\n');
  return 0;
}

function showAgent(agentsDir: string, name: string): number {
  const manifestPath = join(agentsDir, name, 'manifest.json');
  const promptPath = join(agentsDir, name, 'prompt.md');

  if (!existsSync(manifestPath)) {
    process.stderr.write(`Agent not found: ${name}\n`);
    return 1;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as AgentManifest;
  process.stdout.write(`\nAgent: ${manifest.name}\n`);
  process.stdout.write(`Description: ${manifest.description}\n`);
  if (manifest.model) process.stdout.write(`Model: ${manifest.model}\n`);
  if (manifest.tools) process.stdout.write(`Tools: ${manifest.tools.join(', ')}\n`);
  if (manifest.outputContract) process.stdout.write(`Output: ${manifest.outputContract}\n`);

  if (existsSync(promptPath)) {
    process.stdout.write('\nPrompt template:\n');
    process.stdout.write(readFileSync(promptPath, 'utf-8'));
  }
  process.stdout.write('\n');
  return 0;
}
