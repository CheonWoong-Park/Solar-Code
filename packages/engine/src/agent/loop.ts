import * as readline from 'readline';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fireHooks, getOmsDir, loadConfig, loadHooks, type HooksConfig } from '@solar-code/core';
import {
  executeToolCall,
  getToolDefinitions,
  getToolExecutor,
  type AgentToolCall,
  type ToolResult,
} from '../tools/index.js';
import { validateBashCommand } from '../tools/bash-policy.js';
import type { AgentMessage, AgentSessionState } from './messages.js';
import {
  clearInputTail,
  createAssistantTextRenderer,
  eraseInputSuffix,
  finishAssistantLine,
  finishInputPrompt,
  moveInputCursorLeft,
  moveInputCursorRight,
  printAssistantPrefix,
  printHistory,
  printInputPlaceholder,
  printNotice,
  printProgressStep,
  renderInputAppend,
  renderInputBuffer,
  printSessionBanner,
  printSlashHelp,
  printStatusPanel,
  printToolBlocked,
  printToolError,
  printToolResult,
  printToolStart,
  printUserPrompt,
  startWorkingIndicator,
  type PromptStatusOptions,
} from './output.js';
import { compactSessionMessages } from './compaction.js';
import { exportSession, formatCostSummary, formatSessionSummary, getGitDiffSummary, listSessionSummaries } from './diagnostics.js';
import { confirmToolExecution, type PermissionMode, type PermissionProfile } from './permissions.js';
import { directResponseForPrompt, suppressReasonForToolCall } from './policy.js';
import { sanitizePostToolAssistantResponse, shouldConstrainPostToolResponse } from './response-policy.js';
import { appendSessionMessage, openAgentSession, rewriteSessionMessages, updateAgentSessionTurns } from './session.js';
import { streamChatCompletion } from './stream-parser.js';
import { buildSystemPrompt } from './system-prompt.js';
import { recordModelUsage, recordToolUsage } from './usage.js';

export interface RunAgentOptions {
  prompt?: string;
  cwd?: string;
  omsDir?: string;
  model?: string;
  maxTurns?: number;
  permissionMode?: PermissionMode;
  permissionProfile?: PermissionProfile;
  resume?: boolean;
  command?: string;
  slashCommandHandler?: SlashCommandHandler;
}

export interface AgentRunResult {
  exitCode: number;
  sessionId: string;
}

export type SlashCommandHandler = (
  command: string,
  args: string[],
  flags: Record<string, string | boolean>
) => Promise<number | void>;

const ENGINE_SLASH_COMMANDS = new Set([
  'exit',
  'quit',
  'help',
  'status',
  'session',
  'sessions',
  'cost',
  'diff',
  'compact',
  'export',
  'model',
  'agents',
  'history',
  'init',
  'clear',
  'oms',
  'solar',
]);

const FORWARDED_SLASH_COMMANDS = new Set([
  'chat',
  'doctor',
  'hud',
  'parse',
  'plan',
  'review',
  'setup',
  'skills',
  'tdd',
  'team',
  'version',
]);

function addMessage(session: AgentSessionState, omsDir: string, message: AgentMessage): void {
  session.messages.push(message);
  appendSessionMessage(omsDir, session.id, message);
}

function ensureSystemMessage(session: AgentSessionState, omsDir: string, cwd: string): void {
  if (session.messages.some((message) => message.role === 'system')) return;
  addMessage(session, omsDir, { role: 'system', content: buildSystemPrompt(cwd) });
}

function parseMaxTurns(value: number | undefined): number {
  if (!value || !Number.isFinite(value) || value <= 0) return 50;
  return Math.min(Math.floor(value), 100);
}

function formatToolContent(result: ToolResult): string {
  if (result.ok) return result.output || '(ok)';
  return `ERROR: ${result.error ?? result.output}`;
}

function formatToolSummary(call: AgentToolCall): string {
  const tool = getToolExecutor(call.name);
  let detail = '';
  try {
    detail = tool?.describe(call.arguments) ?? '';
  } catch {
    detail = call.rawArguments;
  }
  const compact = detail.replace(/\s+/g, ' ').trim();
  return compact ? `${call.name} ${compact}` : call.name;
}

function describeToolPlan(toolCalls: AgentToolCall[]): string {
  const first = toolCalls[0];
  if (!first) return 'no tools';
  if (toolCalls.length === 1) return formatToolSummary(first);
  return toolCalls.map(formatToolSummary).join(' → ');
}

function lastUserContent(session: AgentSessionState): string {
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const message = session.messages[i];
    if (message.role === 'user') return message.content;
  }
  return '';
}

function printAssistantText(content: string): void {
  printAssistantPrefix();
  const renderer = createAssistantTextRenderer();
  renderer.write(content);
  renderer.flush();
  finishAssistantLine();
}

function printBlock(label: string, body: string): void {
  printProgressStep(label);
  process.stdout.write(`${body.split('\n').map((line) => `  ${line}`).join('\n')}\n`);
}

function compactSession(
  session: AgentSessionState,
  omsDir: string,
  force = false
): ReturnType<typeof compactSessionMessages> {
  const result = compactSessionMessages(session.messages, { force });
  if (result.compacted) {
    session.messages = result.messages;
    rewriteSessionMessages(omsDir, session.id, session.messages);
  }
  return result;
}

async function runTool(
  call: AgentToolCall,
  session: AgentSessionState,
  omsDir: string,
  cwd: string,
  permissionMode: PermissionMode,
  permissionProfile: PermissionProfile,
  hooksConfig: HooksConfig,
  userContent: string
): Promise<'ok' | 'blocked'> {
  if ('__parse_error' in call.arguments) {
    const content = String(call.arguments['__parse_error']);
    addMessage(session, omsDir, { role: 'tool', tool_call_id: call.id, name: call.name || 'unknown', content });
    printToolError(content);
    return 'ok';
  }

  const tool = getToolExecutor(call.name);
  if (!tool) {
    const content = `Unknown tool: ${call.name}`;
    addMessage(session, omsDir, { role: 'tool', tool_call_id: call.id, name: call.name, content });
    printToolError(content);
    return 'ok';
  }

  const suppressed = suppressReasonForToolCall(call, userContent);
  if (suppressed) {
    const content = `BLOCKED: ${suppressed}`;
    addMessage(session, omsDir, { role: 'tool', tool_call_id: call.id, name: tool.name, content });
    printProgressStep('Skipped', suppressed);
    return 'blocked';
  }

  if (tool.name === 'bash') {
    const command = typeof call.arguments['command'] === 'string' ? call.arguments['command'] : '';
    const denial = validateBashCommand(command);
    if (denial) {
      const content = `BLOCKED: ${denial.reason}`;
      addMessage(session, omsDir, { role: 'tool', tool_call_id: call.id, name: tool.name, content });
      printProgressStep('Blocked', denial.reason);
      return 'blocked';
    }
  }

  let description: string;
  try {
    description = tool.describe(call.arguments);
  } catch {
    description = call.rawArguments;
  }
  await fireHooks(hooksConfig, 'BeforeToolUse', {
    session: session.id,
    cwd,
    tool: tool.name,
    description,
  });
  printToolStart(tool.name, description);
  const decision = await confirmToolExecution(permissionMode, tool, description, permissionProfile);
  if (!decision.allowed) {
    const content = `BLOCKED: ${decision.reason ?? 'permission denied'}`;
    addMessage(session, omsDir, { role: 'tool', tool_call_id: call.id, name: tool.name, content });
    printToolBlocked(content);
    return 'blocked';
  }

  const result = await executeToolCall(call, { cwd });
  printToolResult(result, tool.name);
  const content = formatToolContent(result);
  addMessage(session, omsDir, {
    role: 'tool',
    tool_call_id: call.id,
    name: tool.name,
    content,
  });
  recordToolUsage(omsDir, session.id, tool.name, content);
  await fireHooks(hooksConfig, 'AfterToolUse', {
    session: session.id,
    cwd,
    tool: tool.name,
    ok: result.ok ? 'true' : 'false',
  });
  return 'ok';
}

async function runAgentLoop(
  session: AgentSessionState,
  options: Required<Pick<RunAgentOptions, 'cwd' | 'omsDir' | 'model' | 'permissionMode' | 'permissionProfile'>> & {
    maxTurns: number;
    interactive: boolean;
    hooksConfig: HooksConfig;
  }
): Promise<void> {
  while (session.turns < options.maxTurns) {
    session.turns += 1;
    updateAgentSessionTurns(options.omsDir, session);
    const compacted = compactSession(session, options.omsDir);
    if (options.interactive && compacted.compacted) {
      printProgressStep('Compacted', `${compacted.archivedMessages} messages · ${compacted.before.approxTokens} → ${compacted.after.approxTokens} tokens`);
    }

    const stopWorking = options.interactive ? startWorkingIndicator('Thinking') : () => undefined;
    const controller = new AbortController();
    const cleanupInterrupt = options.interactive ? installEscInterrupt(controller) : () => undefined;
    const assistantRenderer = createAssistantTextRenderer();
    let printedAssistantPrefix = false;
    let result: Awaited<ReturnType<typeof streamChatCompletion>>;
    const constrainAssistantOutput = shouldConstrainPostToolResponse(session.messages);
    try {
      const messagesBeforeRequest = [...session.messages];
      result = await streamChatCompletion({
        model: options.model,
        messages: session.messages,
        tools: getToolDefinitions(),
        signal: controller.signal,
        onContent: (text) => {
          if (constrainAssistantOutput) return;
          if (!printedAssistantPrefix) {
            stopWorking();
            printAssistantPrefix();
            printedAssistantPrefix = true;
          }
          assistantRenderer.write(text);
        },
      });
      recordModelUsage(options.omsDir, session.id, {
        messages: messagesBeforeRequest,
        content: result.content,
        toolCalls: result.toolCalls,
      });
    } catch (err) {
      stopWorking();
      if (controller.signal.aborted) {
        if (printedAssistantPrefix) {
          assistantRenderer.flush();
          finishAssistantLine();
        }
        printNotice('interrupted');
        return;
      }
      if (printedAssistantPrefix) assistantRenderer.flush();
      throw err;
    } finally {
      cleanupInterrupt();
    }
    if (printedAssistantPrefix) {
      assistantRenderer.flush();
      finishAssistantLine();
    }
    else stopWorking();

    const assistantContent = constrainAssistantOutput
      ? sanitizePostToolAssistantResponse(result.content, session.messages)
      : result.content;
    if (constrainAssistantOutput && assistantContent.trim()) {
      printAssistantText(assistantContent);
    }

    const assistantMessage: AgentMessage = result.assistantToolCalls.length > 0
      ? { role: 'assistant', content: assistantContent || null, tool_calls: result.assistantToolCalls }
      : { role: 'assistant', content: assistantContent };
    addMessage(session, options.omsDir, assistantMessage);

    if (result.toolCalls.length === 0 || result.finishReason !== 'tool_calls') {
      return;
    }
    if (options.interactive) {
      printProgressStep('Plan', describeToolPlan(result.toolCalls));
    }
    const userContent = lastUserContent(session);
    for (const call of result.toolCalls) {
      const toolStatus = await runTool(
        call,
        session,
        options.omsDir,
        options.cwd,
        options.permissionMode,
        options.permissionProfile,
        options.hooksConfig,
        userContent
      );
      if (toolStatus === 'blocked') return;
    }
    if (options.interactive) {
      printProgressStep('Next', 'read tool result and continue');
    }
  }
  process.stderr.write(`\n[solar] Stopped after max turns (${options.maxTurns}).\n`);
}

function createSolarMd(cwd: string): string {
  const path = join(cwd, 'SOLAR.md');
  if (existsSync(path)) return 'SOLAR.md already exists.';
  const content = [
    '# SOLAR.md',
    '',
    'Project guidance for Solar Code agents.',
    '',
    '## Build and Test',
    '',
    '- Run the smallest useful verification command after changes.',
    '- Keep edits scoped to the requested task.',
    '',
    '## Coding Style',
    '',
    '- Follow the existing project structure and naming.',
    '- Prefer readable, maintainable changes over broad rewrites.',
    '',
  ].join('\n');
  writeFileSync(path, content, 'utf-8');
  return 'Created SOLAR.md.';
}

async function handleSlashCommand(
  input: string,
  session: AgentSessionState,
  options: Required<Pick<RunAgentOptions, 'cwd' | 'omsDir' | 'model' | 'permissionMode'>> & {
    permissionProfile: PermissionProfile;
    maxTurns: number;
    hooksConfig: HooksConfig;
    slashCommandHandler?: SlashCommandHandler;
  }
): Promise<'handled' | 'exit' | 'agent'> {
  if (!input.startsWith('/')) return 'agent';
  const tokens = splitCommandLine(input.slice(1));
  const command = tokens[0] ? `/${tokens[0]}` : '/help';
  const forwardedTokens = command === '/oms' || command === '/solar'
    ? tokens.slice(1)
    : [command.slice(1), ...tokens.slice(1)];
  const arg = tokens[1];
  switch (command) {
    case '/exit':
    case '/quit':
      return 'exit';
    case '/help':
      printSlashHelp();
      return 'handled';
    case '/status':
      printStatusPanel({
        model: options.model,
        sessionId: session.id,
        cwd: options.cwd,
        omsDir: options.omsDir,
        permissionMode: options.permissionMode,
        maxTurns: options.maxTurns,
        resumed: false,
        interactive: true,
        turns: session.turns,
        messageCount: session.messages.length,
      });
      return 'handled';
    case '/session':
      printBlock('Session', formatSessionSummary(session, options.omsDir));
      return 'handled';
    case '/sessions':
      printBlock('Sessions', listSessionSummaries(options.omsDir));
      return 'handled';
    case '/cost':
      printBlock('Cost', formatCostSummary(session, options.omsDir));
      return 'handled';
    case '/diff': {
      const diff = getGitDiffSummary(options.cwd);
      printBlock(diff.ok ? 'Diff' : 'Diff unavailable', diff.output);
      return 'handled';
    }
    case '/compact': {
      const result = compactSession(session, options.omsDir, true);
      if (result.compacted) {
        printBlock('Compacted', `${result.archivedMessages} messages archived\n${result.before.approxTokens} → ${result.after.approxTokens} approx tokens`);
      } else {
        printNotice('nothing to compact yet');
      }
      return 'handled';
    }
    case '/export': {
      const format = arg === 'json' ? 'json' : 'md';
      const file = exportSession(session, options.omsDir, format);
      printNotice(`exported session: ${file}`);
      return 'handled';
    }
    case '/model':
      if (arg) {
        printNotice(`model switching is per process for now. Restart with: solar --model ${arg}`);
      } else {
        printNotice(`active model: ${options.model}. Use: solar --model solar-pro3`);
      }
      return 'handled';
    case '/agents':
      if (!options.slashCommandHandler) {
        printNotice('agent profiles are available through: /oms agents');
        return 'handled';
      }
      break;
    case '/history':
      printHistory(options.omsDir);
      return 'handled';
    case '/init':
      printNotice(createSolarMd(options.cwd));
      return 'handled';
    case '/clear':
      process.stdout.write('\x1Bc');
      printSessionBanner({
        model: options.model,
        sessionId: session.id,
        cwd: options.cwd,
        omsDir: options.omsDir,
        permissionMode: options.permissionMode,
        maxTurns: options.maxTurns,
        resumed: false,
        interactive: true,
      });
      return 'handled';
    case '/oms':
    case '/solar':
      if (forwardedTokens.length === 0) {
        printSlashHelp();
        return 'handled';
      }
      break;
    default:
      break;
  }

  if (!options.slashCommandHandler) {
    printNotice(`unknown command: ${command}. Use /help.`);
    return 'handled';
  }
  const parsed = parseForwardedCommand(forwardedTokens);
  if (!parsed.command) {
    printSlashHelp();
    return 'handled';
  }
  try {
    await fireHooks(options.hooksConfig, 'BeforeCommand', {
      session: session.id,
      cwd: options.cwd,
      command: parsed.command,
      args: parsed.args.join(' '),
    });
    await options.slashCommandHandler(parsed.command, parsed.args, parsed.flags);
    await fireHooks(options.hooksConfig, 'AfterCommand', {
      session: session.id,
      cwd: options.cwd,
      command: parsed.command,
      ok: 'true',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\nCommand failed: ${message}\n`);
    await fireHooks(options.hooksConfig, 'AfterCommand', {
      session: session.id,
      cwd: options.cwd,
      command: parsed.command,
      ok: 'false',
    });
  }
  return 'handled';
}

async function runInteractive(
  session: AgentSessionState,
  options: Required<Pick<RunAgentOptions, 'cwd' | 'omsDir' | 'model' | 'permissionMode'>> & {
    permissionProfile: PermissionProfile;
    maxTurns: number;
    hooksConfig: HooksConfig;
    slashCommandHandler?: SlashCommandHandler;
  }
): Promise<number> {
  if (!process.stdin.isTTY) {
    return runBatchInput(session, options);
  }

  const inputHistory: string[] = [];
  const promptStatus = {
    model: options.model,
    cwd: options.cwd,
    permissionMode: options.permissionMode,
  };
  while (true) {
    const line = await readPromptLine(inputHistory, promptStatus);
    if (line === null) {
      process.stdout.write('\n');
      return 0;
    }

    const userInput = line.trim();
    if (!userInput) continue;

    rememberInput(inputHistory, userInput);

    if (isSlashCommand(userInput)) {
      const slash = await handleSlashCommand(userInput, session, options);
      if (slash === 'exit') return 0;
      continue;
    }

    addMessage(session, options.omsDir, { role: 'user', content: userInput });
    await fireHooks(options.hooksConfig, 'UserPromptSubmit', {
      session: session.id,
      cwd: options.cwd,
      prompt: userInput,
    });
    const direct = directResponseForPrompt(userInput, { cwd: options.cwd });
    if (direct) {
      printAssistantText(direct.content);
      addMessage(session, options.omsDir, { role: 'assistant', content: direct.content });
      continue;
    }

    try {
      await runAgentLoop(session, { ...options, interactive: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`\nError: ${message}\n`);
    }
  }
}

async function runBatchInput(
  session: AgentSessionState,
  options: Required<Pick<RunAgentOptions, 'cwd' | 'omsDir' | 'model' | 'permissionMode'>> & {
    permissionProfile: PermissionProfile;
    maxTurns: number;
    hooksConfig: HooksConfig;
    slashCommandHandler?: SlashCommandHandler;
  }
): Promise<number> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  const lines = Buffer.concat(chunks)
    .toString('utf-8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const userInput of lines) {
    process.stdout.write(`${printUserPrompt()}${userInput}\n`);
    if (isSlashCommand(userInput)) {
      const slash = await handleSlashCommand(userInput, session, options);
      if (slash === 'exit') return 0;
      continue;
    }

    addMessage(session, options.omsDir, { role: 'user', content: userInput });
    await fireHooks(options.hooksConfig, 'UserPromptSubmit', {
      session: session.id,
      cwd: options.cwd,
      prompt: userInput,
    });
    const direct = directResponseForPrompt(userInput, { cwd: options.cwd });
    if (direct) {
      printAssistantText(direct.content);
      addMessage(session, options.omsDir, { role: 'assistant', content: direct.content });
      continue;
    }

    try {
      await runAgentLoop(session, { ...options, interactive: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`\nError: ${message}\n`);
      return 1;
    }
  }
  return 0;
}

export async function runAgent(options: RunAgentOptions = {}): Promise<AgentRunResult> {
  const cwd = options.cwd ?? process.cwd();
  const config = loadConfig(cwd);
  const model = options.model ?? config.model ?? 'solar-pro3';
  const omsDir = options.omsDir ?? getOmsDir(cwd);
  const permissionMode = options.permissionMode ?? 'ask';
  const permissionProfile = options.permissionProfile ?? config.agent.permissionProfile ?? 'standard';
  const maxTurns = parseMaxTurns(options.maxTurns);
  const hooksConfig = loadHooks(omsDir);
  const session = openAgentSession({
    omsDir,
    model,
    command: options.command ?? 'code',
    resume: options.resume,
  });

  ensureSystemMessage(session, omsDir, cwd);
  await fireHooks(hooksConfig, 'SessionStart', {
    session: session.id,
    cwd,
    model,
    command: options.command ?? 'code',
  });
  printSessionBanner({
    model,
    sessionId: session.id,
    cwd,
    omsDir,
    permissionMode,
    maxTurns,
    resumed: options.resume === true,
    interactive: !options.prompt?.trim() && process.stdin.isTTY && process.stdout.isTTY,
  });

  if (options.prompt?.trim()) {
    const prompt = options.prompt.trim();
    addMessage(session, omsDir, { role: 'user', content: prompt });
    await fireHooks(hooksConfig, 'UserPromptSubmit', {
      session: session.id,
      cwd,
      prompt,
    });
    const direct = directResponseForPrompt(prompt, { cwd });
    if (direct) {
      printAssistantText(direct.content);
      addMessage(session, omsDir, { role: 'assistant', content: direct.content });
      await fireHooks(hooksConfig, 'Stop', { session: session.id, cwd, exitCode: '0' });
      return { exitCode: 0, sessionId: session.id };
    }
    await runAgentLoop(session, {
      cwd,
      omsDir,
      model,
      permissionMode,
      permissionProfile,
      maxTurns,
      interactive: false,
      hooksConfig,
    });
    await fireHooks(hooksConfig, 'Stop', { session: session.id, cwd, exitCode: '0' });
    return { exitCode: 0, sessionId: session.id };
  }

  const exitCode = await runInteractive(session, {
    cwd,
    omsDir,
    model,
    permissionMode,
    permissionProfile,
    maxTurns,
    hooksConfig,
    slashCommandHandler: options.slashCommandHandler,
  });
  await fireHooks(hooksConfig, 'Stop', { session: session.id, cwd, exitCode: String(exitCode) });
  printNotice(`session saved: ${session.id}`);
  return { exitCode, sessionId: session.id };
}

function splitCommandLine(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaping = false;

  for (const char of input.trim()) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === '\\') {
      escaping = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

function parseForwardedCommand(tokens: string[]): {
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
} {
  const [command = '', ...rest] = tokens;
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};
  const booleanFlags = new Set(['debug', 'implement', 'readonly', 'resume', 'yes', 'y']);

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      if (booleanFlags.has(key)) {
        flags[key] = true;
        continue;
      }
      const next = rest[i + 1];
      if (next && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (token.startsWith('-') && token.length === 2) {
      const key = token.slice(1);
      if (booleanFlags.has(key)) {
        flags[key] = true;
        continue;
      }
      const next = rest[i + 1];
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

function installEscInterrupt(controller: AbortController): () => void {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return () => undefined;
  const input = process.stdin;
  const previousRawMode = input.isRaw;
  let cleaned = false;
  let cleanup = (): void => undefined;

  const onKeypress = (_str: string, key: readline.Key): void => {
    if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
      controller.abort();
      cleanup();
    }
  };

  cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    input.off('keypress', onKeypress);
    if (typeof input.setRawMode === 'function') input.setRawMode(previousRawMode);
  };

  readline.emitKeypressEvents(input);
  input.on('keypress', onKeypress);
  if (typeof input.setRawMode === 'function') input.setRawMode(true);
  input.resume();
  return cleanup;
}

function rememberInput(history: string[], value: string): void {
  if (history[history.length - 1] === value) return;
  history.push(value);
  if (history.length > 200) history.splice(0, history.length - 200);
}

function isSlashCommand(input: string): boolean {
  if (!input.startsWith('/')) return false;
  const [first = ''] = splitCommandLine(input.slice(1));
  if (!first) return true;
  return ENGINE_SLASH_COMMANDS.has(first) || FORWARDED_SLASH_COMMANDS.has(first);
}

function readPromptLine(history: string[] = [], promptStatus?: PromptStatusOptions): Promise<string | null> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: printUserPrompt(),
      terminal: true,
    });
    rl.prompt();
    return new Promise((resolve) => {
      rl.once('line', (line) => {
        rl.close();
        resolve(line);
      });
      rl.once('close', () => resolve(null));
    });
  }

  printInputPlaceholder(promptStatus ?? { model: 'solar-pro3', cwd: process.cwd(), permissionMode: 'ask' });

  return new Promise((resolve) => {
    const input = process.stdin;
    const previousRawMode = input.isRaw;
    let buffer: string[] = [];
    let cursor = 0;
    let historyIndex = history.length;
    let draft = '';
    let rendered = false;
    let resolved = false;

    const cleanup = (): void => {
      input.off('keypress', onKeypress);
      if (typeof input.setRawMode === 'function') input.setRawMode(previousRawMode);
      if (!resolved) resolved = true;
    };

    const draw = (): void => {
      renderInputBuffer(buffer.join(''), cursor);
      rendered = true;
    };

    const setBuffer = (value: string): void => {
      buffer = Array.from(value);
      cursor = buffer.length;
      draw();
    };

    const resetHistoryCursor = (): void => {
      historyIndex = history.length;
      draft = '';
    };

    const finish = (line: string | null): void => {
      if (resolved) return;
      if (!rendered) draw();
      finishInputPrompt();
      cleanup();
      resolve(line);
    };

    const onKeypress = (str: string, key: readline.Key): void => {
      if (key.ctrl && (key.name === 'c' || key.name === 'd')) {
        finish(null);
        return;
      }
      if (key.name === 'return' || key.name === 'enter') {
        finish(buffer.join(''));
        return;
      }
      if (key.name === 'up') {
        if (history.length === 0) return;
        if (historyIndex === history.length) draft = buffer.join('');
        historyIndex = Math.max(0, historyIndex - 1);
        setBuffer(history[historyIndex] ?? '');
        return;
      }
      if (key.name === 'down') {
        if (historyIndex >= history.length) return;
        historyIndex++;
        setBuffer(historyIndex === history.length ? draft : history[historyIndex] ?? '');
        return;
      }
      if (key.name === 'left') {
        if (cursor > 0) {
          const char = buffer[cursor - 1] ?? '';
          cursor--;
          if (rendered) moveInputCursorLeft(char);
          else draw();
        }
        return;
      }
      if (key.name === 'right') {
        if (cursor < buffer.length) {
          const char = buffer[cursor] ?? '';
          cursor++;
          if (rendered) moveInputCursorRight(char);
          else draw();
        }
        return;
      }
      if (key.name === 'home' || (key.ctrl && key.name === 'a')) {
        if (cursor > 0) {
          const prefix = buffer.slice(0, cursor).join('');
          cursor = 0;
          if (rendered) moveInputCursorLeft(prefix);
          else draw();
        }
        return;
      }
      if (key.name === 'end' || (key.ctrl && key.name === 'e')) {
        if (cursor < buffer.length) {
          const suffix = buffer.slice(cursor).join('');
          cursor = buffer.length;
          if (rendered) moveInputCursorRight(suffix);
          else draw();
        }
        return;
      }
      if (key.name === 'backspace') {
        if (cursor > 0) {
          const deleted = buffer[cursor - 1] ?? '';
          const removingAtEnd = cursor === buffer.length;
          buffer.splice(cursor - 1, 1);
          cursor--;
          resetHistoryCursor();
          if (rendered && removingAtEnd) eraseInputSuffix(deleted);
          else draw();
        }
        return;
      }
      if (key.name === 'delete') {
        if (cursor < buffer.length) {
          buffer.splice(cursor, 1);
          resetHistoryCursor();
          draw();
        }
        return;
      }
      if (key.ctrl && key.name === 'u') {
        if (cursor > 0) {
          buffer.splice(0, cursor);
          cursor = 0;
          resetHistoryCursor();
          draw();
        }
        return;
      }
      if (key.ctrl && key.name === 'k') {
        if (cursor < buffer.length) {
          buffer.splice(cursor);
          resetHistoryCursor();
          if (rendered) clearInputTail();
          else draw();
        }
        return;
      }
      if (str && !key.ctrl && !key.meta && str >= ' ') {
        const chars = Array.from(str);
        const appending = cursor === buffer.length;
        buffer.splice(cursor, 0, ...chars);
        cursor += chars.length;
        resetHistoryCursor();
        if (appending && rendered) renderInputAppend(str);
        else draw();
        return;
      }
    };

    readline.emitKeypressEvents(input);
    input.on('keypress', onKeypress);
    if (typeof input.setRawMode === 'function') input.setRawMode(true);
    input.resume();
  });
}
