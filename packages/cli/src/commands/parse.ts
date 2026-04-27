/**
 * oms parse <file> [--format markdown] [--ask "question"]
 * Upstage Document Parse integration.
 */

import {
  loadConfig,
  getOmsDir,
  getUpstageApiKey,
  parseDocument,
  createUpstageProvider,
  appendLog,
} from '@solar-code/core';
import { join } from 'path';

export async function cmdParse(
  args: string[],
  flags: Record<string, string | boolean>
): Promise<number> {
  const apiKey = getUpstageApiKey();
  if (!apiKey) {
    process.stderr.write('Error: UPSTAGE_API_KEY is not set.\n');
    return 1;
  }

  const filePath = args[0];
  if (!filePath) {
    process.stderr.write(
      'Usage: oms parse <file> [--format markdown|html|text] [--ask "question"]\n' +
        'Example: oms parse ./report.pdf --ask "핵심 내용을 요약해줘"\n'
    );
    return 1;
  }

  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const omsDir = getOmsDir(cwd);
  const format = (flags['format'] as string) ?? config.documentParse.outputFormat ?? 'markdown';
  const question = flags['ask'] as string | undefined;
  const model = (flags['model'] as string) ?? config.model ?? 'solar-pro3';
  const logFile = join(omsDir, 'logs', 'parse.log');

  process.stdout.write(`\n[oms parse] Parsing ${filePath} (format=${format})...\n`);
  appendLog(logFile, `[parse] file="${filePath}" format="${format}"`);

  let result;
  try {
    result = await parseDocument({
      filePath,
      outputFormat: format as 'markdown' | 'html' | 'text',
      omsDir,
      apiKey,
    });
  } catch (err) {
    process.stderr.write(`\nError: ${(err as Error).message}\n`);
    return 1;
  }

  if (result.savedPath) {
    process.stdout.write(`\n[oms parse] Saved to ${result.savedPath}\n`);
    appendLog(logFile, `[parse] saved="${result.savedPath}"`);
  }

  // If content is large, show summary and full path
  const MAX_DISPLAY = 3000;
  if (result.content.length > MAX_DISPLAY) {
    process.stdout.write(`\n--- Parsed content (first ${MAX_DISPLAY} chars) ---\n`);
    process.stdout.write(result.content.slice(0, MAX_DISPLAY));
    process.stdout.write(`\n\n... [${result.content.length - MAX_DISPLAY} more chars in file] ...\n`);
  } else {
    process.stdout.write(`\n--- Parsed content ---\n${result.content}\n`);
  }

  // Optionally ask Solar a question about the parsed content
  if (question) {
    process.stdout.write(`\n[oms parse] Asking Solar: "${question}"\n\n`);
    const provider = createUpstageProvider(apiKey);

    const contextContent =
      result.content.length > 20000
        ? result.content.slice(0, 20000) + '\n\n[...document truncated...]'
        : result.content;

    await provider.stream(
      {
        model,
        messages: [
          {
            role: 'system',
            content:
              config.language === 'ko'
                ? '당신은 문서 분석 전문가입니다. 제공된 문서 내용을 바탕으로 질문에 답해주세요.'
                : 'You are a document analysis expert. Answer questions based on the provided document content.',
          },
          {
            role: 'user',
            content: `Document:\n\n${contextContent}\n\n---\n\nQuestion: ${question}`,
          },
        ],
        stream: true,
      },
      {
        onChunk: (text) => process.stdout.write(text),
        onDone: () => process.stdout.write('\n'),
        onError: (err) => process.stderr.write(`\nError: ${err.message}\n`),
      }
    );
  }

  return 0;
}
