/**
 * oms skills — list/show/install workflow skills.
 */

import { existsSync, readdirSync, readFileSync, copyFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getOmsDir } from '@solar-code/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '../../../../templates');

interface SkillManifest {
  name: string;
  description: string;
  trigger?: string;
  usage?: string;
}

export async function cmdSkills(
  args: string[],
  _flags: Record<string, string | boolean>
): Promise<number> {
  const cwd = process.cwd();
  const omsDir = getOmsDir(cwd);
  const skillsDir = join(omsDir, 'skills');

  const sub = args[0];

  if (sub === 'show' && args[1]) {
    return showSkill(skillsDir, args[1]);
  }

  if (sub === 'install' && args[1]) {
    return installSkill(skillsDir, args[1]);
  }

  return listSkills(skillsDir);
}

function listSkills(skillsDir: string): number {
  if (!existsSync(skillsDir)) {
    process.stdout.write('[oms skills] No skills directory. Run `oms setup` first.\n');
    return 0;
  }

  const entries = readdirSync(skillsDir).filter(
    (e) => existsSync(join(skillsDir, e, 'manifest.json'))
  );

  if (entries.length === 0) {
    process.stdout.write('[oms skills] No skills installed. Run `oms setup` to install defaults.\n');
    return 0;
  }

  process.stdout.write('\nInstalled Skills:\n\n');
  for (const entry of entries) {
    const manifestPath = join(skillsDir, entry, 'manifest.json');
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as SkillManifest;
      const trigger = manifest.trigger ?? `$${manifest.name}`;
      process.stdout.write(`  ${trigger.padEnd(22)} ${manifest.description}\n`);
    } catch {
      process.stdout.write(`  ${entry}\n`);
    }
  }
  process.stdout.write('\nRun `oms skills show <name>` for details.\n\n');
  return 0;
}

function showSkill(skillsDir: string, name: string): number {
  const dir = join(skillsDir, name);
  const manifestPath = join(dir, 'manifest.json');

  if (!existsSync(manifestPath)) {
    process.stderr.write(`Skill not found: ${name}\n`);
    return 1;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as SkillManifest;
  process.stdout.write(`\nSkill: ${manifest.name}\n`);
  process.stdout.write(`Description: ${manifest.description}\n`);
  if (manifest.trigger) process.stdout.write(`Trigger: ${manifest.trigger}\n`);
  if (manifest.usage) process.stdout.write(`Usage: ${manifest.usage}\n`);

  const promptPath = join(dir, 'prompt.md');
  if (existsSync(promptPath)) {
    process.stdout.write('\nPrompt:\n');
    process.stdout.write(readFileSync(promptPath, 'utf-8'));
  }
  process.stdout.write('\n');
  return 0;
}

function installSkill(skillsDir: string, skillPath: string): number {
  // Install from a local path (skills template dir or user-supplied path)
  const templatePath = existsSync(skillPath)
    ? skillPath
    : join(TEMPLATES_DIR, 'skills', skillPath);

  if (!existsSync(templatePath)) {
    process.stderr.write(`Skill not found at: ${templatePath}\n`);
    return 1;
  }

  const name = skillPath.replace(/\//g, '_').replace(/^.*\//, '');
  const destDir = join(skillsDir, name);
  mkdirSync(destDir, { recursive: true });

  for (const file of readdirSync(templatePath)) {
    copyFileSync(join(templatePath, file), join(destDir, file));
  }

  process.stdout.write(`[oms skills] Installed: ${name}\n`);
  return 0;
}
