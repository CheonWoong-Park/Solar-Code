/**
 * oms plan [goal] — AI planning workflow → .solar-code/plans/
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

const PLANNER_SYSTEM = `You are a senior software architect and planning AI.
Given a goal, produce a clear, actionable implementation plan with:
1. Summary of the goal
2. Key questions that need answering first (if any)
3. Architecture/design decisions
4. Implementation steps (ordered, concrete)
5. Testing strategy
6. Risks and mitigations

Format as clean Markdown. Be specific and actionable.`;

const PLANNER_SYSTEM_KO = `당신은 시니어 소프트웨어 아키텍트이자 계획 수립 AI입니다.
주어진 목표에 대해 명확하고 실행 가능한 구현 계획을 다음 형식으로 작성하세요:
1. 목표 요약
2. 사전에 답해야 할 핵심 질문 (있는 경우)
3. 아키텍처/설계 결정사항
4. 구현 단계 (순서대로, 구체적으로)
5. 테스트 전략
6. 위험 요소 및 완화 방안

깔끔한 마크다운 형식으로 작성하세요.`;

export async function cmdPlan(
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
  const goal = args.join(' ').trim() || (flags['goal'] as string | undefined);

  if (!goal) {
    process.stderr.write('Usage: oms plan <goal>\nExample: oms plan "결제 모듈을 리팩토링해줘"\n');
    return 1;
  }

  const provider = createUpstageProvider(apiKey);
  const plansDir = join(omsDir, 'plans');
  mkdirSync(plansDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const planFile = join(plansDir, `${timestamp}-plan.md`);
  const logFile = join(omsDir, 'logs', 'plans.log');

  process.stdout.write(`\n[oms plan] Planning: ${goal}\n\n`);
  appendLog(logFile, `[plan] goal="${goal}"`);

  const systemPrompt = config.language === 'ko' ? PLANNER_SYSTEM_KO : PLANNER_SYSTEM;

  let fullPlan = `# Plan\n\n**Goal:** ${goal}\n**Generated:** ${new Date().toISOString()}\n**Model:** ${model}\n\n---\n\n`;

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
        writeAtomic(planFile, fullPlan);
        process.stdout.write(`\n[oms plan] Saved to ${planFile}\n`);
        appendLog(logFile, `[plan] saved=${planFile}`);
      },
      onError: (err) => {
        process.stderr.write(`\nError: ${err.message}\n`);
      },
    }
  );

  return 0;
}
