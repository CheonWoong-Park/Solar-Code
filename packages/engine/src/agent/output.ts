import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { userInfo } from 'os';
import type { PermissionMode } from './permissions.js';
import type { ToolResult } from '../tools/index.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';
const PURPLE = '\x1b[38;5;141m';
const WHITE = '\x1b[38;5;255m';
const INPUT_BG = '\x1b[48;5;236m';
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const SOLAR_CODE_BANNER = [
  '███████╗ ██████╗ ██╗      █████╗ ██████╗      ██████╗ ██████╗ ██████╗ ███████╗',
  '██╔════╝██╔═══██╗██║     ██╔══██╗██╔══██╗    ██╔════╝██╔═══██╗██╔══██╗██╔════╝',
  '███████╗██║   ██║██║     ███████║██████╔╝    ██║     ██║   ██║██║  ██║█████╗  ',
  '╚════██║██║   ██║██║     ██╔══██║██╔══██╗    ██║     ██║   ██║██║  ██║██╔══╝  ',
  '███████║╚██████╔╝███████╗██║  ██║██║  ██║    ╚██████╗╚██████╔╝██████╔╝███████╗',
  '╚══════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝     ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝',
].join('\n');

const BANNER_COLORS = ['#F29BFF', '#C9B8FF', '#93A7FF', '#4D7CFF', '#245BFF'];
const SUBTITLE_COLORS = ['#B58CFF', '#6F8CFF'];

function useColor(): boolean {
  return process.stdout.isTTY && !process.env['NO_COLOR'];
}

function paint(value: string, color: string): string {
  return useColor() ? `${color}${value}${RESET}` : value;
}

function paintInputLine(raw: string, color = WHITE): string {
  const width = terminalWidth();
  const clipped = displayWidth(raw) > width ? truncate(raw, width) : raw;
  const padding = Math.max(0, width - displayWidth(clipped));
  if (!useColor()) return `${clipped}${' '.repeat(padding)}`;
  return `${INPUT_BG}${color}${clipped}${' '.repeat(padding)}${RESET}`;
}

function trueColor(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(c1: RgbColor, c2: RgbColor, t: number): RgbColor {
  return {
    r: Math.round(lerp(c1.r, c2.r, t)),
    g: Math.round(lerp(c1.g, c2.g, t)),
    b: Math.round(lerp(c1.b, c2.b, t)),
  };
}

function gradientTextMultiline(text: string, hexColors: string[]): string {
  if (!useColor()) return text;
  const palette = hexColors.map(hexToRgb);
  const chars = [...text].filter((ch) => ch !== '\n' && ch !== ' ');
  const total = Math.max(chars.length - 1, 1);
  let visibleIndex = 0;
  let out = '';

  for (const ch of text) {
    if (ch === '\n') {
      out += '\n';
      continue;
    }
    if (ch === ' ') {
      out += ' ';
      continue;
    }

    const t = visibleIndex / total;
    const scaled = t * (palette.length - 1);
    const seg = Math.min(Math.floor(scaled), palette.length - 2);
    const localT = scaled - seg;
    const c = lerpColor(palette[seg], palette[seg + 1], localT);
    out += `${trueColor(c.r, c.g, c.b)}${ch}${RESET}`;
    visibleIndex++;
  }
  return out;
}

function terminalWidth(): number {
  return Math.max(68, Math.min(process.stdout.columns ?? 112, 128));
}

function charWidth(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (code === 0) return 0;
  if (code < 32 || (code >= 0x7f && code < 0xa0)) return 0;
  if (code >= 0x300 && code <= 0x36f) return 0;
  if (
    code >= 0x1100 && (
      code <= 0x115f ||
      code === 0x2329 ||
      code === 0x232a ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6)
    )
  ) {
    return 2;
  }
  return 1;
}

function displayWidth(value: string): number {
  return Array.from(stripAnsi(value)).reduce((width, char) => width + charWidth(char), 0);
}

function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, '');
}

function truncate(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (displayWidth(compact) <= maxLength) return compact;
  const suffix = '...';
  const limit = Math.max(0, maxLength - displayWidth(suffix));
  let width = 0;
  let result = '';
  for (const char of Array.from(compact)) {
    const nextWidth = width + charWidth(char);
    if (nextWidth > limit) break;
    result += char;
    width = nextWidth;
  }
  return `${result}${suffix}`;
}

function pad(value: string, width: number): string {
  const next = value.length > width ? truncate(value, width) : value;
  const nextWidth = displayWidth(next);
  if (nextWidth >= width) return truncate(next, width);
  return `${next}${' '.repeat(width - nextWidth)}`;
}

function indent(value: string, prefix = '  '): string {
  return value
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}

function rule(label?: string): string {
  const width = terminalWidth();
  if (!label) return paint('-'.repeat(width), GRAY);
  const text = ` ${label} `;
  const remaining = Math.max(4, width - text.length);
  return paint(`${text}${'-'.repeat(remaining)}`, GRAY);
}

function boxTop(width: number, label: string): string {
  const inner = width - 2;
  const title = `─ ${label} `;
  const line = title + '─'.repeat(Math.max(0, inner - title.length));
  return paint(`╭${line}╮`, PURPLE);
}

function boxBottom(width: number): string {
  return paint(`╰${'─'.repeat(width - 2)}╯`, PURPLE);
}

function boxRow(width: number, content = ''): string {
  return `${paint('│', PURPLE)}${pad(content, width - 2)}${paint('│', PURPLE)}`;
}

function boxRawRow(width: number, raw: string, rendered = raw): string {
  const rawWidth = displayWidth(raw);
  const inner = width - 2;
  const clippedRaw = rawWidth > inner ? truncate(raw, inner) : raw;
  const clippedRendered = rawWidth > inner ? clippedRaw : rendered;
  const padding = Math.max(0, inner - displayWidth(clippedRaw));
  return `${paint('│', PURPLE)}${clippedRendered}${' '.repeat(padding)}${paint('│', PURPLE)}`;
}

function boxGradientRow(width: number, raw: string, colors: string[]): string {
  return boxRawRow(width, raw, gradientTextMultiline(raw, colors));
}

function modeText(mode: PermissionMode): string {
  if (mode === 'auto') return 'auto';
  if (mode === 'readonly') return 'readonly';
  return 'ask';
}

function displayCwd(cwd: string): string {
  const rel = relative(process.cwd(), cwd);
  return rel || cwd;
}

function recentActivity(omsDir: string, limit = 5): string[] {
  const sessionsDir = join(omsDir, 'sessions');
  if (!existsSync(sessionsDir)) return ['no previous sessions yet'];
  const jsonlFiles = readdirSync(sessionsDir)
    .filter((file) => file.endsWith('.jsonl'))
    .map((file) => join(sessionsDir, file))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

  const activities: string[] = [];
  for (const file of jsonlFiles) {
    if (activities.length >= limit) break;
    const lines = readFileSync(file, 'utf-8').split(/\r?\n/).filter(Boolean).slice(-20).reverse();
    for (const line of lines) {
      if (activities.length >= limit) break;
      try {
        const parsed = JSON.parse(line) as { role?: string; content?: string; name?: string };
        if (parsed.role === 'user' && parsed.content) {
          activities.push(`asked: ${truncate(parsed.content, 44)}`);
        } else if (parsed.role === 'tool' && parsed.name) {
          activities.push(`used tool: ${parsed.name}`);
        } else if (parsed.role === 'assistant') {
          activities.push('assistant response');
        }
      } catch {
        // Ignore malformed session lines.
      }
    }
  }
  return activities.length ? activities : ['no previous sessions yet'];
}

export interface SessionBannerOptions {
  model: string;
  sessionId: string;
  cwd: string;
  omsDir: string;
  permissionMode: PermissionMode;
  maxTurns: number;
  resumed: boolean;
  interactive: boolean;
}

export type PromptStatusOptions = Pick<SessionBannerOptions, 'model' | 'cwd' | 'permissionMode'>;

export function printSessionBanner(options: SessionBannerOptions): void {
  if (!options.interactive) {
    printCompactBanner(options);
    return;
  }
  printWelcomeDashboard(options);
}

function printCompactBanner(options: SessionBannerOptions): void {
  process.stdout.write('\n');
  process.stdout.write(`${rule('solar')}\n`);
  process.stdout.write(`${paint('✦', PURPLE)} ${paint(options.model, PURPLE)}  `);
  process.stdout.write(`${paint('session', BOLD)} ${options.sessionId}  `);
  process.stdout.write(`${paint('mode', BOLD)} ${modeText(options.permissionMode)}  `);
  process.stdout.write(`${paint('cwd', BOLD)} ${displayCwd(options.cwd)}\n`);
  process.stdout.write(`${rule()}\n`);
}

function printWelcomeDashboard(options: SessionBannerOptions): void {
  const width = terminalWidth();
  const user = process.env['USER'] ?? userInfo().username ?? 'dev';
  const bannerLines = SOLAR_CODE_BANNER.split('\n');
  const subtitle = '> AI coding agent';

  process.stdout.write('\n');
  process.stdout.write(`${paint('›', GREEN)} ${paint('solar', BOLD)}\n\n`);
  process.stdout.write(`${boxTop(width, 'Solar Code v0.1.0')}\n`);
  process.stdout.write(`${boxRow(width, '')}\n`);
  process.stdout.write(`${boxRow(width, `Welcome back ${user}!`)}\n`);
  process.stdout.write(`${boxRow(width, '')}\n`);
  for (const line of bannerLines) {
    process.stdout.write(`${boxGradientRow(width, line, BANNER_COLORS)}\n`);
  }
  process.stdout.write(`${boxRow(width, '')}\n`);
  process.stdout.write(`${boxGradientRow(width, subtitle, SUBTITLE_COLORS)}\n`);
  process.stdout.write(`${boxRow(width, '')}\n`);
  process.stdout.write(`${boxRow(width, `model:     ${options.model}    /model`)}\n`);
  process.stdout.write(`${boxRow(width, `directory: ${options.cwd}`)}\n`);
  process.stdout.write(`${boxRow(width, '')}\n`);
  process.stdout.write(`${boxRow(width, 'Tips: /init  /agents  /model  /help  /status')}\n`);
  process.stdout.write(`${boxRow(width, 'Commands: /doctor  /setup  /oms <legacy-command>')}\n`);
  process.stdout.write(`${boxRow(width, '')}\n`);

  process.stdout.write(`${boxBottom(width)}\n\n`);
}

export function printUserPrompt(): string {
  return `${paint('›', PURPLE)} `;
}

export function printInputPlaceholder(options: PromptStatusOptions): void {
  const width = terminalWidth();
  const placeholder = truncate('› Ask Solar Code or type /help', width);
  const status = truncate(`${options.model} ${modeText(options.permissionMode)} · ${options.cwd}`, width - 4);
  process.stdout.write(`${paintInputLine(placeholder, GRAY)}\n\n  ${paint(status, GRAY)}\n`);
  process.stdout.write('\x1b[3A\r');
}

export function finishInputPrompt(): void {
  process.stdout.write('\x1b[3B\r');
}

export function renderInputBuffer(buffer: string, cursor = Array.from(buffer).length): void {
  const chars = Array.from(buffer);
  const safeCursor = Math.max(0, Math.min(cursor, chars.length));
  const beforeCursor = chars.slice(0, safeCursor).join('');
  const prompt = '› ';
  const cursorColumn = displayWidth(prompt) + displayWidth(beforeCursor);
  const lineWidth = terminalWidth();

  process.stdout.write(`\r\x1b[2K${paintInputLine(`${prompt}${buffer}`, WHITE)}`);
  const rewind = Math.max(0, lineWidth - cursorColumn);
  if (rewind > 0) process.stdout.write(`\x1b[${rewind}D`);
}

export function printAssistantPrefix(): void {
  process.stdout.write(`${paint('solar', PURPLE)} ${paint('›', PURPLE)} `);
}

export interface AssistantTextRenderer {
  write(text: string): void;
  flush(): void;
}

export function createAssistantTextRenderer(): AssistantTextRenderer {
  let bold = false;
  let pendingStar = false;

  const writeChar = (char: string): void => {
    process.stdout.write(bold ? paint(char, PURPLE) : char);
  };

  return {
    write(text: string): void {
      for (const char of Array.from(text)) {
        if (pendingStar) {
          if (char === '*') {
            bold = !bold;
            pendingStar = false;
            continue;
          }
          writeChar('*');
          pendingStar = false;
        }

        if (char === '*') {
          pendingStar = true;
          continue;
        }

        writeChar(char);
      }
    },
    flush(): void {
      if (pendingStar) {
        writeChar('*');
        pendingStar = false;
      }
      bold = false;
    },
  };
}

export function finishAssistantLine(): void {
  process.stdout.write('\n');
}

export function startWorkingIndicator(label = 'Working'): () => void {
  if (!process.stdout.isTTY) {
    process.stdout.write(`${paint('•', BLUE)} ${paint(label, BLUE)}...\n`);
    return () => undefined;
  }

  const startedAt = Date.now();
  let active = true;
  let stopped = false;
  const render = (): void => {
    if (!active) return;
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    process.stdout.write(`\r\x1b[2K${paint('•', BLUE)} ${paint(label, BLUE)} ${paint(`(${seconds}s • esc to interrupt)`, GRAY)}`);
  };
  render();
  const timer = setInterval(render, 1000);
  return () => {
    if (stopped) return;
    stopped = true;
    active = false;
    clearInterval(timer);
    process.stdout.write('\r\x1b[2K');
  };
}

export function printProgressStep(label: string, detail?: string): void {
  const color = label === 'Plan' ? CYAN : label === 'Next' ? GRAY : BLUE;
  const suffix = detail ? ` ${paint(truncate(detail, 110), GRAY)}` : '';
  process.stdout.write(`${paint('•', color)} ${paint(label, color)}${suffix}\n`);
}

function toolActivity(name: string, description: string): { label: string; detail: string; color: string } {
  const compact = truncate(description, 104);
  switch (name) {
    case 'read_file':
      return { label: 'Explored', detail: `Read ${compact}`, color: BLUE };
    case 'grep':
      return { label: 'Explored', detail: `Search ${compact}`, color: BLUE };
    case 'glob':
    case 'list_files':
      return { label: 'Explored', detail: `List ${compact}`, color: BLUE };
    case 'write_file':
      return { label: 'Modified', detail: `Write ${compact}`, color: GREEN };
    case 'edit_file':
      return { label: 'Modified', detail: `Edit ${compact}`, color: GREEN };
    case 'bash':
      return { label: 'Ran', detail: compact, color: YELLOW };
    default:
      return { label: 'Tool', detail: `${name} ${compact}`.trim(), color: PURPLE };
  }
}

export function printToolStart(name: string, description: string): void {
  const activity = toolActivity(name, description);
  process.stdout.write(`${paint('•', activity.color)} ${paint(activity.label, activity.color)}\n`);
  if (activity.detail) process.stdout.write(`  ${paint(activity.detail, activity.color)}\n`);
}

export function printToolBlocked(reason: string): void {
  process.stdout.write(`  ${paint('denied', YELLOW)} ${reason}\n`);
}

export function printToolError(message: string): void {
  process.stdout.write(`  ${paint('error', RED)} ${message}\n`);
}

function compactToolBody(body: string, toolName?: string): string {
  if (!body || body === '(no output)') return '';
  if (toolName && ['read_file', 'grep', 'glob', 'list_files'].includes(toolName)) return '';
  const lines = body.split('\n');
  const selected = lines.slice(0, 12).join('\n');
  const suffix = lines.length > 12 ? `\n[${lines.length - 12} more lines hidden]` : '';
  return selected.length > 1600 ? `${selected.slice(0, 1600)}\n[output truncated]` : `${selected}${suffix}`;
}

export function printToolResult(result: ToolResult, toolName?: string): void {
  const status = result.ok ? paint('ok', GREEN) : paint('error', RED);
  const body = compactToolBody((result.ok ? result.output : result.error ?? result.output).trimEnd(), toolName);
  process.stdout.write(`  ${status}\n`);
  if (body && body !== '(no output)') process.stdout.write(`${indent(body, '    ')}\n`);
}

export function printNotice(message: string): void {
  process.stdout.write(`${paint('note', GRAY)} ${message}\n`);
}

export function formatApprovalPrompt(name: string, description: string): string {
  void name;
  void description;
  return `  ${paint('?', YELLOW)} approve? ${paint('y', GREEN)} yes · ${paint('n', GRAY)} no · ${paint('enter', GRAY)} deny `;
}

export function printSlashHelp(): void {
  process.stdout.write('\n');
  process.stdout.write(`${rule('commands')}\n`);
  process.stdout.write(`${paint('/init', PURPLE)}     Create SOLAR.md project guidance\n`);
  process.stdout.write(`${paint('/agents', PURPLE)}   Show agent profile hint\n`);
  process.stdout.write(`${paint('/model', PURPLE)}    Show active model and model switch usage\n`);
  process.stdout.write(`${paint('/status', PURPLE)}   Show session status\n`);
  process.stdout.write(`${paint('/session', PURPLE)}  Show session file and context stats\n`);
  process.stdout.write(`${paint('/sessions', PURPLE)} List recent sessions\n`);
  process.stdout.write(`${paint('/cost', PURPLE)}     Show approximate context usage\n`);
  process.stdout.write(`${paint('/diff', PURPLE)}     Show git working tree summary\n`);
  process.stdout.write(`${paint('/compact', PURPLE)}  Compact older session history\n`);
  process.stdout.write(`${paint('/export', PURPLE)}   Export current session as Markdown or JSON\n`);
  process.stdout.write(`${paint('/history', PURPLE)}  Show recent session activity\n`);
  process.stdout.write(`${paint('/clear', PURPLE)}    Redraw the dashboard\n`);
  process.stdout.write(`${paint('/oms <cmd>', PURPLE)} Run legacy commands inside Solar Code, e.g. /oms doctor\n`);
  process.stdout.write(`${paint('/doctor', PURPLE)}   Shortcut for /oms doctor\n`);
  process.stdout.write(`${paint('/setup', PURPLE)}    Shortcut for /oms setup\n`);
  process.stdout.write(`${paint('/exit', PURPLE)}     Exit and save the session\n`);
}

export function printStatusPanel(options: SessionBannerOptions & { turns: number; messageCount: number }): void {
  process.stdout.write('\n');
  process.stdout.write(`${rule('status')}\n`);
  process.stdout.write(`model:    ${options.model}\n`);
  process.stdout.write(`session:  ${options.sessionId}${options.resumed ? ' (resumed)' : ''}\n`);
  process.stdout.write(`cwd:      ${options.cwd}\n`);
  process.stdout.write(`mode:     ${modeText(options.permissionMode)}\n`);
  process.stdout.write(`turns:    ${options.turns}/${options.maxTurns}\n`);
  process.stdout.write(`messages: ${options.messageCount}\n`);
  process.stdout.write(`network:  ${process.env['UPSTAGE_API_KEY'] ? 'online' : 'offline - UPSTAGE_API_KEY not set'}\n`);
}

export function printHistory(omsDir: string): void {
  process.stdout.write('\n');
  process.stdout.write(`${rule('recent activity')}\n`);
  for (const item of recentActivity(omsDir, 12)) {
    process.stdout.write(`  ${item}\n`);
  }
}
