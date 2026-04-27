import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearInputTail,
  createAssistantTextRenderer,
  eraseInputSuffix,
  finishInputPrompt,
  moveInputCursorLeft,
  moveInputCursorRight,
  printInputPlaceholder,
  renderInputAppend,
  renderInputBuffer,
} from '../../packages/engine/src/agent/output.js';

function captureStdout(fn: () => void): string {
  const originalWrite = process.stdout.write.bind(process.stdout);
  let output = '';
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output += String(chunk);
    return true;
  }) as typeof process.stdout.write;
  try {
    fn();
  } finally {
    process.stdout.write = originalWrite;
  }
  return output;
}

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;]*m/g, '');
}

describe('agent output rendering', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders streamed markdown bold markers as styled text without leaking markers', () => {
    const output = captureStdout(() => {
      const renderer = createAssistantTextRenderer();
      renderer.write('Hello **Sol');
      renderer.write('ar Code**!');
      renderer.flush();
    });

    expect(output).toBe('Hello Solar Code!');
  });

  it('keeps standalone stars that are not markdown bold delimiters', () => {
    const output = captureStdout(() => {
      const renderer = createAssistantTextRenderer();
      renderer.write('* item');
      renderer.flush();
    });

    expect(output).toBe('* item');
  });

  it('places the cursor relative to the rendered input text', () => {
    const columnsDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'columns');
    const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    Object.defineProperty(process.stdout, 'columns', { configurable: true, value: 80 });
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
    let output = '';
    try {
      output = captureStdout(() => {
        renderInputBuffer('abcd', 2);
      });
    } finally {
      if (columnsDescriptor) Object.defineProperty(process.stdout, 'columns', columnsDescriptor);
      else Reflect.deleteProperty(process.stdout, 'columns');
      if (ttyDescriptor) Object.defineProperty(process.stdout, 'isTTY', ttyDescriptor);
      else Reflect.deleteProperty(process.stdout, 'isTTY');
    }

    expect(output).toContain('› abcd');
    expect(output.endsWith('\x1b[76D')).toBe(true);
  });

  it('appends plain input on the grey input bar without redrawing the whole card', () => {
    const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
    let output = '';
    try {
      output = captureStdout(() => {
        renderInputAppend('abc');
      });
    } finally {
      if (ttyDescriptor) Object.defineProperty(process.stdout, 'isTTY', ttyDescriptor);
      else Reflect.deleteProperty(process.stdout, 'isTTY');
    }

    expect(stripAnsi(output)).toBe('abc');
    expect(output).not.toContain('\x1b[2K');
  });

  it('moves and erases input using display columns', () => {
    const output = captureStdout(() => {
      moveInputCursorLeft('한a');
      moveInputCursorRight('ab');
      eraseInputSuffix('나');
      clearInputTail();
    });

    expect(output).toBe('\x1b[3D\x1b[2C\x1b[2D  \x1b[2D\x1b[K');
  });

  it('renders the input placeholder as a three-line card', () => {
    const descriptor = Object.getOwnPropertyDescriptor(process.stdout, 'columns');
    Object.defineProperty(process.stdout, 'columns', { configurable: true, value: 40 });
    let output = '';
    try {
      output = captureStdout(() => {
        printInputPlaceholder({ model: 'solar-pro3', permissionMode: 'ask', cwd: '/tmp/project' });
      });
    } finally {
      if (descriptor) Object.defineProperty(process.stdout, 'columns', descriptor);
      else Reflect.deleteProperty(process.stdout, 'columns');
    }

    const visible = stripAnsi(output);
    const lines = visible.split('\n');
    expect(lines[0]).toBe('');
    expect(lines[1].length).toBe(68);
    expect(lines[1]).toBe(' '.repeat(68));
    expect(lines[2]).toContain('› Ask Solar Code or type /help');
    expect(lines[2].length).toBe(68);
    expect(lines[3]).toBe(' '.repeat(68));
    expect(visible).toContain('✦ Solar Code solar-pro3 ask');
    expect(visible).toContain('workspace /tmp/project');
    expect(output).toContain('\x1b[5A\r');
  });

  it('clears the transient status block after input is submitted', () => {
    const output = captureStdout(() => {
      finishInputPrompt();
    });

    expect(output).toBe('\x1b[1B\r\x1b[J');
  });
});
