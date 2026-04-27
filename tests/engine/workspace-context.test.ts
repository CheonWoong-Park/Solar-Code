import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { buildWorkspaceContext } from '../../packages/engine/src/agent/workspace-context.js';
import { buildSystemPrompt } from '../../packages/engine/src/agent/system-prompt.js';

describe('workspace context', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `solar-context-test-${randomBytes(4).toString('hex')}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('summarizes package scripts and project guidance', () => {
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({
      name: 'demo-app',
      version: '1.2.3',
      type: 'module',
      scripts: {
        build: 'tsc',
        test: 'vitest run',
      },
      dependencies: {
        react: '^19.0.0',
      },
    }, null, 2));
    writeFileSync(join(tmpDir, 'SOLAR.md'), 'Prefer small edits.\n', 'utf-8');
    writeFileSync(join(tmpDir, 'README.md'), '# Demo\n\nRun tests before finishing.\n', 'utf-8');

    const context = buildWorkspaceContext(tmpDir);

    expect(context).toContain('name: demo-app');
    expect(context).toContain('build: tsc');
    expect(context).toContain('test: vitest run');
    expect(context).toContain('Prefer small edits.');
    expect(context).toContain('README excerpt');
  });

  it('includes workspace context in the system prompt', () => {
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ scripts: { lint: 'eslint .' } }), 'utf-8');

    const prompt = buildSystemPrompt(tmpDir);

    expect(prompt).toContain('Project context captured at session start');
    expect(prompt).toContain('lint: eslint .');
    expect(prompt).toContain('Current date:');
  });
});
