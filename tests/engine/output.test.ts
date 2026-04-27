import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAssistantTextRenderer, renderInputBuffer } from '../../packages/engine/src/agent/output.js';

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
});
