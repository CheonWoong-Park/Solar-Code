export interface BashPolicyDenial {
  reason: string;
}

const DANGEROUS_COMMANDS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /(^|[;&|]\s*)sudo\b/, reason: 'sudo is not allowed from the agent runtime' },
  { pattern: /\brm\s+-[A-Za-z]*r[A-Za-z]*f[A-Za-z]*\b|\brm\s+-[A-Za-z]*f[A-Za-z]*r[A-Za-z]*\b/, reason: 'recursive force removal is blocked' },
  { pattern: /\bgit\s+reset\s+--hard\b/, reason: 'destructive git reset is blocked' },
  { pattern: /\bgit\s+clean\s+-[A-Za-z]*[fd][A-Za-z]*\b/, reason: 'destructive git clean is blocked' },
  { pattern: /\b(?:mkfs|shutdown|reboot|poweroff|halt)\b/, reason: 'system-level destructive command is blocked' },
  { pattern: /\bdd\b[\s\S]*\bof=/, reason: 'raw disk writes are blocked' },
  { pattern: /\bchmod\s+-R\s+777\b/, reason: 'recursive world-writable chmod is blocked' },
  { pattern: /\b(?:curl|wget)\b[\s\S]*\|\s*(?:sh|bash|zsh)\b/, reason: 'downloaded shell execution is blocked' },
  { pattern: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*;\s*\}/, reason: 'fork bomb pattern is blocked' },
];

export function validateBashCommand(command: string): BashPolicyDenial | undefined {
  const normalized = command.trim();
  if (!normalized) return { reason: 'empty command is not allowed' };
  for (const rule of DANGEROUS_COMMANDS) {
    if (rule.pattern.test(normalized)) return { reason: rule.reason };
  }
  return undefined;
}
