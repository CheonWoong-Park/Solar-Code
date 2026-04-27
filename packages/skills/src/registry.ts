export interface SkillManifest {
  name: string;
  trigger: string;
  description: string;
  usage: string;
  example: string;
}

export const BUILT_IN_SKILLS: SkillManifest[] = [
  {
    name: 'plan',
    trigger: '$plan',
    description: 'Run full planning workflow for a goal',
    usage: '$plan <goal>',
    example: '$plan 결제 모듈을 리팩토링하고 테스트를 보강해줘',
  },
  {
    name: 'deep-interview',
    trigger: '$deep-interview',
    description: 'Conduct a deep clarification interview before complex work',
    usage: '$deep-interview <topic>',
    example: '$deep-interview 새 기능 설계',
  },
  {
    name: 'review',
    trigger: '$review',
    description: 'Code review the current git diff with Solar',
    usage: '$review',
    example: '$review',
  },
  {
    name: 'tdd',
    trigger: '$tdd',
    description: 'Generate test-first implementation plan',
    usage: '$tdd <feature>',
    example: '$tdd 사용자 인증 시스템',
  },
  {
    name: 'parse',
    trigger: '$parse',
    description: 'Parse document with Upstage Document Parse',
    usage: '$parse <file> [--ask "question"]',
    example: "$parse ./report.pdf --ask '핵심 리스크를 요약해줘'",
  },
  {
    name: 'summarize-doc',
    trigger: '$summarize-doc',
    description: 'Parse and summarize a document in Korean or English',
    usage: '$summarize-doc <file>',
    example: '$summarize-doc ./계약서.pdf',
  },
  {
    name: 'contract-review',
    trigger: '$contract-review',
    description: 'Review contract documents for risks and key terms',
    usage: '$contract-review <file>',
    example: '$contract-review ./NDA.pdf',
  },
  {
    name: 'repo-map',
    trigger: '$repo-map',
    description: 'Generate comprehensive repository structure map',
    usage: '$repo-map',
    example: '$repo-map',
  },
  {
    name: 'team',
    trigger: '$team',
    description: 'Spawn a multi-agent team to tackle a large goal',
    usage: '$team <n> <goal>',
    example: '$team 3 결제 모듈을 리팩토링하고 테스트를 보강해줘',
  },
  {
    name: 'research',
    trigger: '$research',
    description: 'Deep web/repo research, synthesized into findings',
    usage: '$research <topic>',
    example: '$research Upstage Solar API rate limits',
  },
  {
    name: 'ship',
    trigger: '$ship',
    description: 'Pre-ship checklist: review, tests, docs, changelog',
    usage: '$ship',
    example: '$ship',
  },
  {
    name: 'doctor',
    trigger: '$doctor',
    description: 'Run oms doctor environment check',
    usage: '$doctor',
    example: '$doctor',
  },
];

export function findSkill(nameOrTrigger: string): SkillManifest | undefined {
  return BUILT_IN_SKILLS.find(
    (s) => s.name === nameOrTrigger || s.trigger === nameOrTrigger
  );
}
