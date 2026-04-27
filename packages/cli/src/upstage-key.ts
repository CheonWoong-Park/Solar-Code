import * as readline from 'readline';
import {
  getSolarCodeAuthPath,
  getUpstageApiKey,
  saveUpstageApiKey,
} from '@solar-code/core';

const GETTING_STARTED_URL = 'https://console.upstage.ai/docs/getting-started';

export function normalizePastedUpstageApiKey(input: string): string {
  const trimmed = input.trim();
  const assignment = trimmed.match(/(?:export\s+)?UPSTAGE_API_KEY\s*=\s*(.+)$/);
  const raw = assignment ? assignment[1].trim() : trimmed;
  return raw.replace(/^['"]|['"]$/g, '').trim();
}

export async function ensureUpstageApiKey(options: { forcePrompt?: boolean } = {}): Promise<boolean> {
  const existing = getUpstageApiKey();
  if (existing && !options.forcePrompt) return true;

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write(
      `No Solar Code API key found. Get one at ${GETTING_STARTED_URL}\n`
    );
    return false;
  }

  process.stdout.write(`
Solar Code — Solar-native terminal coding agent

${options.forcePrompt ? 'Replace the saved Solar Code API key.' : 'No Solar Code API key found.'}

Get your Upstage API key:
  ${GETTING_STARTED_URL}

Paste your API key and press Enter.
Press Ctrl+C to cancel.

UPSTAGE_API_KEY: `);

  const pasted = await readSecretLine();
  const apiKey = pasted ? normalizePastedUpstageApiKey(pasted) : '';
  if (!apiKey) {
    process.stdout.write('No API key entered. Run `solar` again when ready.\n');
    return false;
  }

  saveUpstageApiKey(apiKey);
  process.env['UPSTAGE_API_KEY'] = apiKey;
  process.stdout.write(`API key saved to ${getSolarCodeAuthPath()}\n\n`);
  return true;
}

function readSecretLine(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = process.stdin;
    const output = process.stdout;
    const wasRaw = input.isRaw;
    let value = '';
    let done = false;

    const cleanup = (): void => {
      input.off('keypress', onKeypress);
      if (input.isTTY) input.setRawMode(wasRaw);
      input.pause();
    };

    const finish = (result: string | null): void => {
      if (done) return;
      done = true;
      output.write('\n');
      cleanup();
      resolve(result);
    };

    const clearVisibleInput = (): void => {
      if (!value) return;
      output.write('\b \b'.repeat([...value].length));
      value = '';
    };

    const onKeypress = (str: string, key: readline.Key): void => {
      if (key.ctrl && key.name === 'c') {
        finish(null);
        return;
      }
      if (key.name === 'return' || key.name === 'enter') {
        finish(value);
        return;
      }
      if (key.name === 'backspace') {
        if (value) {
          value = value.slice(0, -1);
          output.write('\b \b');
        }
        return;
      }
      if (key.ctrl && key.name === 'u') {
        clearVisibleInput();
        return;
      }
      if (!str || key.ctrl || key.meta) return;

      value += str;
      output.write('*'.repeat([...str].length));
    };

    readline.emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    input.on('keypress', onKeypress);
  });
}
