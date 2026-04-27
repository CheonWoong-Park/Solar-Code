/**
 * oms tdd [goal] — test-driven development workflow.
 */

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
import { permissionModeFromFlags, runAgent } from '@solar-code/engine';

const TDD_SYSTEM = `You are a TDD expert. Given a feature goal, write:
1. A test plan with specific test cases (unit, integration, edge cases)
2. Example test code stubs
3. Implementation guidance to make tests pass

Format as clean Markdown with code blocks.`;

const TDD_SYSTEM_KO = `당신은 TDD 전문가입니다. 기능 목표가 주어지면 다음을 작성하세요:
1. 구체적인 테스트 케이스가 포함된 테스트 계획 (단위, 통합, 경계 케이스)
2. 예시 테스트 코드 스텁
3. 테스트를 통과시키기 위한 구현 가이드

코드 블록이 포함된 깔끔한 마크다운 형식으로 작성하세요.`;

export async function cmdTdd(
  args: string[],
  flags: Record<string, string | boolean>
): Promise<number> {
  const apiKey = getUpstageApiKey();
  if (!apiKey) {
    process.stderr.write('Error: UPSTAGE_API_KEY is not set.\n');
    return 1;
  }

  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const omsDir = getOmsDir(cwd);
  const model = (flags['model'] as string) ?? config.model ?? 'solar-pro3';
  const goal = args.join(' ').trim() || (flags['goal'] as string | undefined);
  const implement = flags['implement'] === true;

  if (!goal) {
    process.stderr.write('Usage: oms tdd <goal>\nExample: oms tdd "사용자 인증 API"\n');
    return 1;
  }

  const provider = createUpstageProvider(apiKey);
  const plansDir = join(omsDir, 'plans');
  mkdirSync(plansDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const tddFile = join(plansDir, `${timestamp}-tdd.md`);
  const logFile = join(omsDir, 'logs', 'tdd.log');

  process.stdout.write(`\n[oms tdd] Creating TDD plan: ${goal}\n\n`);
  appendLog(logFile, `[tdd] goal="${goal}"`);

  const systemPrompt = config.language === 'ko' ? TDD_SYSTEM_KO : TDD_SYSTEM;
  let fullPlan = `# TDD Plan\n\n**Goal:** ${goal}\n**Generated:** ${new Date().toISOString()}\n**Model:** ${model}\n\n---\n\n`;

  await provider.stream(
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: goal },
      ],
      stream: true,
    },
    {
      onChunk: (text) => {
        process.stdout.write(text);
        fullPlan += text;
      },
      onDone: () => {
        process.stdout.write('\n');
        writeAtomic(tddFile, fullPlan);
        process.stdout.write(`\n[oms tdd] Plan saved to ${tddFile}\n`);
        appendLog(logFile, `[tdd] saved=${tddFile}`);
      },
      onError: (err) => {
        process.stderr.write(`\nError: ${err.message}\n`);
      },
    }
  );

  // Optionally invoke native coding agent
  if (implement) {
    const maxTurns = typeof flags['max-turns'] === 'string' ? Number(flags['max-turns']) : undefined;
    process.stdout.write(`\n[oms tdd] Launching native engine to implement...\n\n`);
    const result = await runAgent({
      model,
      prompt: `Follow this TDD plan and implement:\n\n${fullPlan}`,
      cwd,
      omsDir,
      maxTurns,
      permissionMode: permissionModeFromFlags(flags),
      command: 'tdd',
    });
    return result.exitCode;
  }

  return 0;
}
