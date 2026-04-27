import { getUpstageApiKey, getUpstageBaseUrl, resolveModel } from '@solar-code/core';
import type { ToolDefinition } from '@solar-code/core';
import type { AgentToolCall } from '../tools/index.js';
import type { AgentMessage, ChatToolCall } from './messages.js';
import { mockStreamChatCompletion } from './mock-provider.js';

interface ChatCompletionChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string | null;
  }>;
}

interface PartialToolCall {
  id: string;
  type: 'function';
  name: string;
  arguments: string;
}

function cleanContent(text: string): string {
  return text
    .replace(/<\|content\|>/g, '')
    .replace(/<\|end\|>/g, '');
}

export interface StreamChatOptions {
  model: string;
  messages: AgentMessage[];
  tools: ToolDefinition[];
  onContent?: (text: string) => void;
  temperature?: number;
  signal?: AbortSignal;
}

export interface StreamChatResult {
  content: string;
  finishReason: string | null;
  toolCalls: AgentToolCall[];
  assistantToolCalls: ChatToolCall[];
}

export class SolarStreamParser {
  private content = '';
  private finishReason: string | null = null;
  private toolCalls = new Map<number, PartialToolCall>();

  push(chunk: ChatCompletionChunk): void {
    const choice = chunk.choices?.[0];
    if (!choice) return;
    if (choice.finish_reason !== undefined) this.finishReason = choice.finish_reason;

    const delta = choice.delta;
    if (!delta) return;
    if (delta.content) this.content += cleanContent(delta.content);

    for (const partial of delta.tool_calls ?? []) {
      const current = this.toolCalls.get(partial.index) ?? {
        id: partial.id ?? `call_${partial.index}`,
        type: 'function' as const,
        name: '',
        arguments: '',
      };
      if (partial.id) current.id = partial.id;
      if (partial.type) current.type = partial.type;
      if (partial.function?.name) current.name += partial.function.name;
      if (partial.function?.arguments) current.arguments += partial.function.arguments;
      this.toolCalls.set(partial.index, current);
    }
  }

  getContent(): string {
    return this.content;
  }

  finish(): StreamChatResult {
    const ordered = [...this.toolCalls.entries()].sort(([a], [b]) => a - b).map(([, call]) => call);
    const assistantToolCalls: ChatToolCall[] = ordered.map((call) => ({
      id: call.id,
      type: 'function',
      function: { name: call.name, arguments: call.arguments },
    }));
    const toolCalls: AgentToolCall[] = ordered.map((call) => {
      let parsed: Record<string, unknown>;
      try {
        parsed = call.arguments ? JSON.parse(call.arguments) as Record<string, unknown> : {};
      } catch {
        parsed = { __parse_error: `Invalid JSON arguments: ${call.arguments}` };
      }
      return {
        id: call.id,
        name: call.name,
        arguments: parsed,
        rawArguments: call.arguments,
      };
    });
    return {
      content: this.content,
      finishReason: this.finishReason,
      toolCalls,
      assistantToolCalls,
    };
  }
}

function getHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': 'solar-code-engine/0.1.0',
  };
}

export async function streamChatCompletion(options: StreamChatOptions): Promise<StreamChatResult> {
  if (process.env['SOLAR_MOCK'] === '1') {
    return mockStreamChatCompletion(options.messages, options.onContent);
  }

  const apiKey = getUpstageApiKey();
  if (!apiKey) {
    throw new Error('UPSTAGE_API_KEY is not set. export UPSTAGE_API_KEY="up_..."');
  }

  const baseUrl = getUpstageBaseUrl().replace(/\/$/, '');
  const resolved = resolveModel(options.model);
  if (resolved.provider !== 'upstage') {
    throw new Error(`Native engine currently supports Upstage Solar models only; got provider=${resolved.provider}`);
  }

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: getHeaders(apiKey),
    signal: options.signal,
    body: JSON.stringify({
      model: resolved.model,
      messages: options.messages,
      stream: true,
      tools: options.tools,
      tool_choice: 'auto',
      temperature: options.temperature ?? 0.2,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Upstage API error ${resp.status}: ${text}`);
  }
  if (!resp.body) throw new Error('No response body for streaming');

  const parser = new SolarStreamParser();
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice('data: '.length);
        if (payload === '[DONE]') continue;
        let chunk: ChatCompletionChunk;
        try {
          chunk = JSON.parse(payload) as ChatCompletionChunk;
        } catch {
          continue;
        }
        const before = parser.getContent();
        parser.push(chunk);
        const after = parser.getContent();
        if (after.length > before.length) {
          options.onContent?.(after.slice(before.length));
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return parser.finish();
}
