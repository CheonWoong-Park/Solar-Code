import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAssistantTextRenderer,
  finishInputPrompt,
  printInputPlaceholder,
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

  it('places the cursor relative to the full input card width', () => {
    const descriptor = Object.getOwnPropertyDescriptor(process.stdout, 'columns');
    Object.defineProperty(process.stdout, 'columns', { configurable: true, value: 80 });
    let output = '';
    try {
      output = captureStdout(() => {
        renderInputBuffer('abcd', 2);
      });
    } finally {
      if (descriptor) Object.defineProperty(process.stdout, 'columns', descriptor);
      else Reflect.deleteProperty(process.stdout, 'columns');
    }

    expect(output).toContain('› abcd');
    expect(output.endsWith('\x1b[76D')).toBe(true);
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
