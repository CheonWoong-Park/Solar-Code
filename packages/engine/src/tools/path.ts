import { isAbsolute, relative, resolve, sep } from 'path';

export function resolveWorkspacePath(cwd: string, inputPath = '.'): string {
  const root = resolve(cwd);
  const fullPath = isAbsolute(inputPath) ? resolve(inputPath) : resolve(root, inputPath);
  if (!isInsidePath(root, fullPath)) {
    throw new Error(`Path escapes workspace: ${inputPath}`);
  }
  return fullPath;
}

export function displayPath(cwd: string, fullPath: string): string {
  const rel = relative(resolve(cwd), resolve(fullPath));
  return rel ? rel.split(sep).join('/') : '.';
}

export function isInsidePath(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function normalizePathForMatch(path: string): string {
  return path.split(sep).join('/');
}
