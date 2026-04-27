/**
 * solar setup — initialize Solar Code state in the current project.
 */

import {
  existsSync, mkdirSync, readdirSync, statSync, readFileSync, copyFileSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  getOmsDir,
  saveConfig,
  DEFAULT_CONFIG,
  ensureOmsDirs,
  writeAtomic,
} from '@solar-code/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '../../../../templates');

const DEFAULT_HOOKS = {
  enabled: false,
  hooks: [
    {
      event: 'SessionStart',
      command: 'echo "[solar] Session started"',
      description: 'Example: log session start (disabled by default)',
    },
  ],
};

export async function cmdSetup(
  _args: string[],
  _flags: Record<string, string | boolean>
): Promise<number> {
  const cwd = process.cwd();
  const omsDir = getOmsDir(cwd);

  process.stdout.write(`\nSetting up Solar Code in ${cwd}\n\n`);

  // Create .solar-code/ directory structure
  ensureOmsDirs(omsDir);
  process.stdout.write(`  [OK] Created .solar-code/ directory structure\n`);

  // Write default config (do not overwrite if exists)
  const configPath = join(omsDir, 'config.json');
  if (!existsSync(configPath)) {
    saveConfig(DEFAULT_CONFIG, cwd);
    process.stdout.write(`  [OK] Created .solar-code/config.json\n`);
  } else {
    process.stdout.write(`  [--] .solar-code/config.json already exists — skipped\n`);
  }

  // Write default hooks.json
  const hooksPath = join(omsDir, 'hooks.json');
  if (!existsSync(hooksPath)) {
    writeAtomic(hooksPath, JSON.stringify(DEFAULT_HOOKS, null, 2));
    process.stdout.write(`  [OK] Created .solar-code/hooks.json\n`);
  } else {
    process.stdout.write(`  [--] .solar-code/hooks.json already exists — skipped\n`);
  }

  // Install built-in agent templates
  const agentsTemplateDir = join(TEMPLATES_DIR, 'agents');
  const agentsTargetDir = join(omsDir, 'agents');
  if (existsSync(agentsTemplateDir)) {
    installTemplates(agentsTemplateDir, agentsTargetDir, 'agents');
  }

  // Install built-in skill templates
  const skillsTemplateDir = join(TEMPLATES_DIR, 'skills');
  const skillsTargetDir = join(omsDir, 'skills');
  if (existsSync(skillsTemplateDir)) {
    installTemplates(skillsTemplateDir, skillsTargetDir, 'skills');
  }

  // Offer to add .solar-code/ to .gitignore
  const gitignorePath = join(cwd, '.gitignore');
  if (existsSync(gitignorePath)) {
    const current = readFileSync(gitignorePath, 'utf-8');
    if (!current.includes('.solar-code/')) {
      process.stdout.write(
        `\n  .solar-code/ is not in .gitignore. Adding it is recommended to avoid committing state.\n`
      );
      process.stdout.write(`  Run: echo '.solar-code/' >> .gitignore\n`);
    }
  }

  process.stdout.write(`
Setup complete!

Next steps:
  solar login
  solar
  /doctor

`);

  return 0;
}

function installTemplates(srcDir: string, destDir: string, label: string): void {
  mkdirSync(destDir, { recursive: true });
  let installed = 0;
  let skipped = 0;
  for (const entry of readdirSync(srcDir)) {
    const src = join(srcDir, entry);
    const dest = join(destDir, entry);
    if (statSync(src).isDirectory()) {
      if (!existsSync(dest)) {
        copyDirSync(src, dest);
        installed++;
      } else {
        skipped++;
      }
    } else {
      if (!existsSync(dest)) {
        copyFileSync(src, dest);
        installed++;
      } else {
        skipped++;
      }
    }
  }
  process.stdout.write(
    `  [OK] Installed ${installed} ${label} (${skipped} skipped — already present)\n`
  );
}

function copyDirSync(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const d = join(dest, entry);
    if (statSync(s).isDirectory()) {
      copyDirSync(s, d);
    } else {
      copyFileSync(s, d);
    }
  }
}
