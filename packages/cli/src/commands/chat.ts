/**
 * oms chat [prompt] — Solar streaming chat.
 */

import * as readline from 'readline';
import {
  loadConfig,
  getOmsDir,
  createUpstageProvider,
  getUpstageApiKey,
  appendLog,
} from '@solar-code/core';
import { join } from 'path';

export async function cmdChat(
  args: string[],
  flags: Record<string, string | boolean>
): Promise<number> {
  const apiKey = getUpstageApiKey();
  if (!apiKey) {
    process.stderr.write(
      'Error: Solar Code auth is not set. Run `solar login` and paste your Upstage API key.\n'
    );
    return 1;
  }

  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const omsDir = getOmsDir(cwd);
  const model = (flags['model'] as string) ?? config.model ?? 'solar-pro3';
  const provider = createUpstageProvider(apiKey);
  const logFile = join(omsDir, 'logs', 'chat.log');

  const inlinePrompt = args.join(' ').trim() || (flags['prompt'] as string | undefined);

  if (inlinePrompt) {
    // One-shot mode
    process.stdout.write(`\n`);
    appendLog(logFile, `[user] ${inlinePrompt}`);
    await provider.stream(
      {
        model,
        messages: [
          {
            role: 'system',
            content: config.language === 'ko'
              ? '당신은 Solar AI 어시스턴트입니다. 한국어로 답변해주세요.'
              : 'You are a Solar AI assistant.',
          },
          { role: 'user', content: inlinePrompt },
        ],
        stream: true,
      },
      {
        onChunk: (text) => process.stdout.write(text),
        onDone: (full) => {
          process.stdout.write('\n');
          appendLog(logFile, `[assistant] ${full}`);
        },
        onError: (err) => {
          process.stderr.write(`\nError: ${err.message}\n`);
        },
      }
    );
    return 0;
  }

  // Interactive REPL
  process.stdout.write(`\nSolar Code Chat (${model})\n`);
  process.stdout.write(`Type your message and press Enter. Ctrl+C to exit.\n\n`);

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: config.language === 'ko'
        ? '당신은 Solar AI 어시스턴트입니다. 도움이 필요하시면 말씀해주세요.'
        : 'You are a Solar AI assistant. How can I help you?',
    },
  ];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: config.language === 'ko' ? '\n사용자: ' : '\nYou: ',
    terminal: true,
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const userInput = line.trim();
    if (!userInput) {
      rl.prompt();
      return;
    }
    if (userInput === '/exit' || userInput === '/quit') {
      process.stdout.write('Goodbye!\n');
      rl.close();
      return;
    }

    messages.push({ role: 'user', content: userInput });
    appendLog(logFile, `[user] ${userInput}`);

    process.stdout.write(config.language === 'ko' ? '\nSolar: ' : '\nAssistant: ');
    rl.pause();
    try {
      await provider.stream(
        { model, messages, stream: true },
        {
          onChunk: (text) => {
            process.stdout.write(text);
          },
          onDone: (full) => {
            process.stdout.write('\n');
            messages.push({ role: 'assistant', content: full });
            appendLog(logFile, `[assistant] ${full}`);
          },
          onError: (err) => {
            process.stderr.write(`\nError: ${err.message}\n`);
          },
        }
      );
    } finally {
      rl.resume();
      rl.prompt();
    }
  });

  return new Promise((resolve) => {
    rl.on('close', () => resolve(0));
    process.on('SIGINT', () => {
      process.stdout.write('\n');
      rl.close();
    });
  });
}
