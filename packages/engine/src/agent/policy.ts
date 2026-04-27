import { isAbsolute, resolve } from 'path';
import type { AgentToolCall } from '../tools/types.js';
import { isInsidePath } from '../tools/path.js';

export interface DirectResponse {
  content: string;
}

export interface PolicyContext {
  cwd: string;
}

const CODING_TASK_PATTERN = /(만들|생성|작성|수정|고쳐|고침|구현|추가|삭제|테스트|빌드|실행|파일|폴더|디렉토리|버그|에러|코드|엔진|레포|repo|readme|package|src\/|\.ts|\.tsx|\.js|\.jsx|\.json|\.html|\.css|\.md)/i;
const IDENTITY_PATTERN = /\b(who are you|what are you|what can you do|introduce yourself)\b|너는?\s*누구|너\s*뭐야|정체|소개해|무엇을\s*할\s*수|뭘\s*할\s*수/i;
const GREETING_PATTERN = /^(hi|hello|hey|안녕|안녕하세요|ㅎㅇ|하이|반가워)[!.?。,\s]*$/i;
const ABSOLUTE_PATH_PATTERN = /(^|\s)(\/[^\s`'"]+)/g;

function hasCodingTaskIntent(input: string): boolean {
  return CODING_TASK_PATTERN.test(input);
}

function isDirectConversationPrompt(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed || hasCodingTaskIntent(trimmed)) return false;
  return GREETING_PATTERN.test(trimmed) || IDENTITY_PATTERN.test(trimmed);
}

function extractAbsolutePaths(input: string): string[] {
  const paths: string[] = [];
  for (const match of input.matchAll(ABSOLUTE_PATH_PATTERN)) {
    const value = match[2]?.replace(/[.,;:!?)]$/, '');
    if (value && isAbsolute(value)) paths.push(value);
  }
  return paths;
}

function workspaceBoundaryResponse(input: string, context: PolicyContext): DirectResponse | undefined {
  if (!hasCodingTaskIntent(input)) return undefined;
  const outsidePath = extractAbsolutePaths(input).find((path) => !isInsidePath(context.cwd, resolve(path)));
  if (!outsidePath) return undefined;

  return {
    content: [
      `요청한 경로 \`${outsidePath}\`는 현재 workspace \`${context.cwd}\` 밖입니다.`,
      'Solar Code는 현재 workspace 안의 파일만 수정합니다.',
      `그 위치에서 작업하려면 \`cd ${outsidePath}\` 후 \`solar\`를 실행하거나, 현재 workspace 안의 경로를 지정해 주세요.`,
    ].join('\n'),
  };
}

export function directResponseForPrompt(input: string, context: PolicyContext): DirectResponse | undefined {
  const boundary = workspaceBoundaryResponse(input, context);
  if (boundary) return boundary;

  const trimmed = input.trim();
  if (!isDirectConversationPrompt(trimmed)) return undefined;

  if (IDENTITY_PATTERN.test(trimmed)) {
    return {
      content: [
        '저는 Solar Code입니다.',
        'Solar 모델을 사용하는 터미널 코딩 에이전트로, 현재 workspace에서 파일을 읽고 수정하고 검증하는 작업을 돕습니다.',
        '잡담이나 정체성 질문에는 도구를 쓰지 않고 바로 답하고, 코드 작업이 필요할 때만 파일/터미널 도구를 사용합니다.',
      ].join('\n'),
    };
  }

  return {
    content: '안녕하세요. Solar Code입니다. 코드 작성, 파일 수정, 테스트 실행 같은 개발 작업을 도와드릴 수 있습니다.',
  };
}

export function suppressReasonForToolCall(call: AgentToolCall, lastUserContent: string): string | undefined {
  if (!isDirectConversationPrompt(lastUserContent)) return undefined;
  if (call.name === 'bash') {
    const command = String(call.arguments['command'] ?? '').trim();
    if (command) return `casual prompt does not need shell command: ${command}`;
  }
  return `casual prompt does not need tool call: ${call.name}`;
}
