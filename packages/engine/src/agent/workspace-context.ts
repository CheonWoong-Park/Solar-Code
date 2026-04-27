import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const MAX_GUIDANCE_CHARS = 4_000;
const MAX_README_CHARS = 2_500;
const MAX_CONTEXT_CHARS = 12_000;
const IGNORED_ROOT_ENTRIES = new Set([
  '.git',
  '.solar-code',
  '.solar',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.next',
]);

interface PackageJsonShape {
  name?: string;
  version?: string;
  type?: string;
  workspaces?: unknown;
  scripts?: Record<string, unknown>;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
}

function readTextIfExists(path: string, maxChars: number): string | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const stat = statSync(path);
    if (!stat.isFile() || stat.size > 2_000_000) return undefined;
    const text = readFileSync(path, 'utf-8').trim();
    if (!text) return undefined;
    return text.length > maxChars ? `${text.slice(0, maxChars)}\n[truncated]` : text;
  } catch {
    return undefined;
  }
}

function readPackageJson(cwd: string): PackageJsonShape | undefined {
  const text = readTextIfExists(join(cwd, 'package.json'), 100_000);
  if (!text) return undefined;
  try {
    return JSON.parse(text) as PackageJsonShape;
  } catch {
    return undefined;
  }
}

function summarizeWorkspaces(value: unknown): string | undefined {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string').join(', ') || undefined;
  if (value && typeof value === 'object' && Array.isArray((value as { packages?: unknown }).packages)) {
    return (value as { packages: unknown[] }).packages.filter((item) => typeof item === 'string').join(', ') || undefined;
  }
  return undefined;
}

function summarizeScripts(scripts: Record<string, unknown> | undefined): string | undefined {
  if (!scripts) return undefined;
  const preferred = ['build', 'typecheck', 'test', 'lint', 'dev', 'start', 'clean'];
  const names = Object.keys(scripts);
  const ordered = [
    ...preferred.filter((name) => names.includes(name)),
    ...names.filter((name) => !preferred.includes(name)).sort(),
  ].slice(0, 16);
  if (ordered.length === 0) return undefined;
  return ordered.map((name) => `${name}: ${String(scripts[name])}`).join('\n');
}

function summarizeDependencies(pkg: PackageJsonShape): string | undefined {
  const deps = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ].sort();
  if (deps.length === 0) return undefined;
  const selected = deps.slice(0, 24).join(', ');
  return deps.length > 24 ? `${selected}, ...` : selected;
}

function rootOverview(cwd: string): string | undefined {
  try {
    const entries = readdirSync(cwd, { withFileTypes: true })
      .filter((entry) => !IGNORED_ROOT_ENTRIES.has(entry.name))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 80)
      .map((entry) => `${entry.name}${entry.isDirectory() ? '/' : ''}`);
    return entries.length ? entries.join(', ') : undefined;
  } catch {
    return undefined;
  }
}

function appendSection(parts: string[], title: string, body: string | undefined): void {
  if (!body) return;
  parts.push(`${title}:\n${body}`);
}

export function buildWorkspaceContext(cwd: string): string {
  const parts: string[] = [];
  const pkg = readPackageJson(cwd);

  appendSection(parts, 'Root overview', rootOverview(cwd));

  if (pkg) {
    const packageLines = [
      pkg.name ? `name: ${pkg.name}` : undefined,
      pkg.version ? `version: ${pkg.version}` : undefined,
      pkg.type ? `type: ${pkg.type}` : undefined,
      summarizeWorkspaces(pkg.workspaces) ? `workspaces: ${summarizeWorkspaces(pkg.workspaces)}` : undefined,
      summarizeDependencies(pkg) ? `dependencies: ${summarizeDependencies(pkg)}` : undefined,
    ].filter(Boolean).join('\n');
    appendSection(parts, 'package.json summary', packageLines);
    appendSection(parts, 'package scripts', summarizeScripts(pkg.scripts));
  }

  for (const filename of ['SOLAR.md', 'AGENTS.md', 'CLAUDE.md']) {
    appendSection(parts, filename, readTextIfExists(join(cwd, filename), MAX_GUIDANCE_CHARS));
  }
  appendSection(parts, 'README excerpt', readTextIfExists(join(cwd, 'README.md'), MAX_README_CHARS));

  const context = parts.join('\n\n---\n\n').trim();
  if (!context) return 'No project files were detected at startup.';
  return context.length > MAX_CONTEXT_CHARS ? `${context.slice(0, MAX_CONTEXT_CHARS)}\n[workspace context truncated]` : context;
}
