/**
 * Upstage Document Parse integration.
 * API docs: https://developers.upstage.ai/docs/apis/document-parse
 *
 * Uploads a document file, receives markdown/html output,
 * saves to .oms/parsed/<safe-name>.md
 */

import { readFileSync, mkdirSync, existsSync } from 'fs';
import { basename, join } from 'path';
import { getUpstageApiKey, getUpstageBaseUrl } from './config.js';
import { writeAtomic } from './state.js';

export type ParseOutputFormat = 'markdown' | 'html' | 'text';

export interface DocumentParseOptions {
  filePath: string;
  outputFormat?: ParseOutputFormat;
  omsDir?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface DocumentParseResult {
  content: string;
  savedPath?: string;
  /** Model used, if returned by API */
  model?: string;
}

const SUPPORTED_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.heic',
  '.docx', '.pptx', '.xlsx',
]);

export function isSupportedFile(filePath: string): boolean {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
  return SUPPORTED_EXTENSIONS.has(ext);
}

function safeName(filePath: string): string {
  return basename(filePath)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\s+/g, '_');
}

export async function parseDocument(opts: DocumentParseOptions): Promise<DocumentParseResult> {
  const apiKey = opts.apiKey ?? getUpstageApiKey();
  if (!apiKey) {
    throw new Error(
      'UPSTAGE_API_KEY is required for document parsing. Run `oms setup` or export UPSTAGE_API_KEY="up_..."'
    );
  }

  if (!existsSync(opts.filePath)) {
    throw new Error(`File not found: ${opts.filePath}`);
  }

  if (!isSupportedFile(opts.filePath)) {
    const ext = opts.filePath.slice(opts.filePath.lastIndexOf('.'));
    throw new Error(
      `Unsupported file type: ${ext}. Supported: ${Array.from(SUPPORTED_EXTENSIONS).join(', ')}`
    );
  }

  const baseUrl = (opts.baseUrl ?? getUpstageBaseUrl()).replace(/\/$/, '');
  const fileContent = readFileSync(opts.filePath);
  const fileName = basename(opts.filePath);

  // Build multipart form
  const boundary = `----OMSBoundary${Date.now()}`;
  const CRLF = '\r\n';

  function buildMultipart(): Buffer {
    const parts: Buffer[] = [];

    // document field
    parts.push(
      Buffer.from(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="document"; filename="${fileName}"${CRLF}` +
          `Content-Type: application/octet-stream${CRLF}${CRLF}`
      )
    );
    parts.push(fileContent);
    parts.push(Buffer.from(CRLF));

    // output_formats field
    const format = opts.outputFormat ?? 'markdown';
    parts.push(
      Buffer.from(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="output_formats"${CRLF}${CRLF}` +
          `["${format}"]${CRLF}`
      )
    );

    parts.push(Buffer.from(`--${boundary}--${CRLF}`));
    return Buffer.concat(parts);
  }

  const body = buildMultipart();

  const resp = await fetch(`${baseUrl}/document-digitization`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(body.byteLength),
      'User-Agent': 'solar-code/0.1.0',
    },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Document Parse API error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as {
    content?: {
      markdown?: string;
      html?: string;
      text?: string;
    };
    model?: string;
    elements?: unknown[];
  };

  const format = opts.outputFormat ?? 'markdown';
  const content =
    data.content?.[format as keyof typeof data.content] ??
    data.content?.markdown ??
    data.content?.text ??
    JSON.stringify(data, null, 2);

  let savedPath: string | undefined;
  if (opts.omsDir) {
    const parsedDir = join(opts.omsDir, 'parsed');
    mkdirSync(parsedDir, { recursive: true });
    const outFile = join(parsedDir, `${safeName(opts.filePath)}.${format === 'html' ? 'html' : 'md'}`);
    writeAtomic(outFile, content);
    savedPath = outFile;
  }

  return { content, savedPath, model: data.model };
}
