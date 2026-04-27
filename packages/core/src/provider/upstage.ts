/**
 * Upstage Solar provider — OpenAI-compatible Chat Completions.
 * Base URL: https://api.upstage.ai/v1
 * Auth:     Bearer UPSTAGE_API_KEY
 *
 * Solar model aliases:
 *   solar | solar3 | solar-pro3  -> solar-pro3
 *   solar-pro2                   -> solar-pro2
 *   solar-mini                   -> solar-mini
 *   upstage/<model>              -> <model>
 */

import { getUpstageApiKey, getUpstageBaseUrl } from '../config.js';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  StreamCallbacks,
  ProviderClient,
} from './types.js';

const SOLAR_ALIAS_MAP: Record<string, string> = {
  solar: 'solar-pro3',
  solar3: 'solar-pro3',
  'solar-pro3': 'solar-pro3',
  'solar-pro2': 'solar-pro2',
  'solar-pro': 'solar-pro3',
  'solar-mini': 'solar-mini',
};

function resolveModel(model: string): string {
  const lower = model.toLowerCase();
  if (lower.startsWith('upstage/')) return model.slice('upstage/'.length);
  return SOLAR_ALIAS_MAP[lower] ?? model;
}

function getHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': 'solar-code/0.1.0',
  };
}

export class UpstageProvider implements ProviderClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    const key = apiKey ?? getUpstageApiKey();
    if (!key) {
      throw new Error(
        'UPSTAGE_API_KEY is not set. Run `oms setup` or export UPSTAGE_API_KEY="up_..."'
      );
    }
    this.apiKey = key;
    this.baseUrl = (baseUrl ?? getUpstageBaseUrl()).replace(/\/$/, '');
  }

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const body = { ...req, model: resolveModel(req.model), stream: false };
    const resp = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: getHeaders(this.apiKey),
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Upstage API error ${resp.status}: ${text}`);
    }
    return resp.json() as Promise<ChatCompletionResponse>;
  }

  async stream(req: ChatCompletionRequest, callbacks: StreamCallbacks): Promise<void> {
    const body = { ...req, model: resolveModel(req.model), stream: true };
    let resp: Response;
    try {
      resp = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: getHeaders(this.apiKey),
        body: JSON.stringify(body),
      });
    } catch (err) {
      callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      const err = new Error(`Upstage API error ${resp.status}: ${text}`);
      callbacks.onError?.(err);
      return;
    }
    if (!resp.body) {
      callbacks.onError?.(new Error('No response body for streaming'));
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

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
          try {
            const chunk = JSON.parse(payload) as ChatCompletionChunk;
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              callbacks.onChunk?.(delta);
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    callbacks.onDone?.(fullText);
  }
}

export function createUpstageProvider(apiKey?: string, baseUrl?: string): UpstageProvider {
  return new UpstageProvider(apiKey, baseUrl);
}
