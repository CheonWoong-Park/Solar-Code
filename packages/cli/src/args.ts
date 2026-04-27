export interface ParsedArgs {
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0) {
    return { command: 'default', args: [], flags: {} };
  }

  const [first, ...rest] = argv;

  // Handle --version / -v at root level
  if (first === '--version' || first === '-v') {
    return { command: 'version', args: [], flags: {} };
  }
  if (first === '--help' || first === '-h') {
    return { command: 'help', args: [], flags: {} };
  }

  const KNOWN_COMMANDS = new Set([
    'setup', 'doctor', 'chat', 'code', 'plan', 'review', 'tdd',
    'parse', 'team', 'hud', 'resume', 'agents', 'skills',
    'version', 'help',
  ]);

  const command = KNOWN_COMMANDS.has(first ?? '') ? (first ?? 'default') : 'default';
  const remaining = KNOWN_COMMANDS.has(first ?? '') ? rest : argv;

  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};
  const BOOLEAN_FLAGS = new Set(['debug', 'implement', 'readonly', 'resume', 'yes', 'y']);

  for (let i = 0; i < remaining.length; i++) {
    const token = remaining[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      if (BOOLEAN_FLAGS.has(key)) {
        flags[key] = true;
        continue;
      }
      const next = remaining[i + 1];
      if (next && !next.startsWith('--') && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (token.startsWith('-') && token.length === 2) {
      const key = token.slice(1);
      if (BOOLEAN_FLAGS.has(key)) {
        flags[key] = true;
        continue;
      }
      const next = remaining[i + 1];
      if (next && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      args.push(token);
    }
  }

  return { command, args, flags };
}
