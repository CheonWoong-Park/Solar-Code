/**
 * oms review — review current git diff with Solar.
 */

import { spawnSync } from 'child_process';
import { join } from 'path';
import { mkdirSync } from 'fs';
import {
  loadConfig,
  getOmsDir,
  getUpstageApiKey,
  createUpstageProvider,
  writeAtomic,
  appendLog,
} from '@solar-code/core';

const REVIEWER_SYSTEM = `You are a senior code reviewer. Analyze the provided git diff and give a thorough review covering:
1. Summary of changes
2. Potential bugs or logic errors
3. Security concerns
4. Performance implications
5. Code quality and style issues
6. Missing tests
7. Overall assessment

Be specific, cite line numbers where relevant, and format as clean Markdown.`;

const REVIEWER_SYSTEM_KO = `당신은 시니어 코드 리뷰어입니다. 제공된 git diff를 분석하고 다음 항목을 포함한 종합적인 리뷰를 작성하세요:
1. 변경 사항 요약
2. 잠재적 버그 또는 로직 오류
3. 보안 우려 사항
4. 성능 영향
5. 코드 품질 및 스타일 문제
6. 누락된 테스트
7. 종합 평가

구체적으로 작성하고, 관련된 경우 줄 번호를 인용하며, 깔끔한 마크다운 형식으로 작성하세요.`;

export async function cmdReview(
  args: string[],
  flags: Record<string, string | boolean>
): Promise<number> {
  const apiKey = getUpstageApiKey();
  if (!apiKey) {
    process.stderr.write('Error: Solar Code auth is not set. Run `solar login`.\n');
    return 1;
  }

  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const omsDir = getOmsDir(cwd);
  const model = (flags['model'] as string) ?? config.model ?? 'solar-pro3';

  // Get git diff
  const diffArgs = args.length > 0 ? args : ['HEAD'];
  const diffResult = spawnSync('git', ['diff', ...diffArgs], {
    cwd,
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024 * 4, // 4MB
  });

  if (diffResult.status !== 0) {
    process.stderr.write(
      `[oms review] git diff failed: ${diffResult.stderr}\nMake sure you are in a git repository.\n`
    );
    return 1;
  }

  const diff = diffResult.stdout?.trim();
  if (!diff) {
    process.stdout.write('[oms review] No changes found in git diff.\n');
    return 0;
  }

  // Truncate very large diffs
  const MAX_DIFF_CHARS = 30000;
  const truncatedDiff =
    diff.length > MAX_DIFF_CHARS
      ? diff.slice(0, MAX_DIFF_CHARS) + '\n\n... [diff truncated at 30000 chars] ...'
      : diff;

  const provider = createUpstageProvider(apiKey);
  const reviewsDir = join(omsDir, 'logs', 'reviews');
  mkdirSync(reviewsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reviewFile = join(reviewsDir, `${timestamp}-review.md`);
  const logFile = join(omsDir, 'logs', 'reviews.log');

  process.stdout.write(`\n[oms review] Reviewing diff (${diff.length} chars)...\n\n`);
  appendLog(logFile, `[review] diff_chars=${diff.length}`);

  const systemPrompt = config.language === 'ko' ? REVIEWER_SYSTEM_KO : REVIEWER_SYSTEM;

  let fullReview = `# Code Review\n\n**Generated:** ${new Date().toISOString()}\n**Model:** ${model}\n\n---\n\n`;

  await provider.stream(
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Review this diff:\n\n\`\`\`diff\n${truncatedDiff}\n\`\`\`` },
      ],
      stream: true,
    },
    {
      onChunk: (text) => {
        process.stdout.write(text);
        fullReview += text;
      },
      onDone: () => {
        process.stdout.write('\n');
        writeAtomic(reviewFile, fullReview);
        process.stdout.write(`\n[oms review] Saved to ${reviewFile}\n`);
        appendLog(logFile, `[review] saved=${reviewFile}`);
      },
      onError: (err) => {
        process.stderr.write(`\nError: ${err.message}\n`);
      },
    }
  );

  return 0;
}
