export interface AgentManifest {
  name: string;
  description: string;
  model: string;
  tools: string[];
  outputContract: string;
  failureHandling: string;
  promptTemplate?: string;
}

export const BUILT_IN_AGENTS: AgentManifest[] = [
  {
    name: 'planner',
    description: 'Turns vague requests into clear, actionable plans',
    model: 'solar-pro3',
    tools: ['read_file', 'list_files', 'search'],
    outputContract: 'plan.md written to .oms/plans/',
    failureHandling: 'If goal is too vague, ask one clarifying question before proceeding',
  },
  {
    name: 'architect',
    description: 'System design, repo architecture, API boundary decisions',
    model: 'solar-pro3',
    tools: ['read_file', 'list_files', 'search'],
    outputContract: 'architecture.md in project root or .oms/plans/',
    failureHandling: 'If no existing code, create from first principles',
  },
  {
    name: 'executor',
    description: 'Implementation agent — writes code, runs tests, makes changes',
    model: 'solar-pro3',
    tools: ['read_file', 'write_file', 'edit_file', 'bash', 'search'],
    outputContract: 'Working code committed to the worktree',
    failureHandling: 'If stuck, write a TODO comment and continue. Report blockers.',
  },
  {
    name: 'reviewer',
    description: 'Code review, security review, regression checks',
    model: 'solar-pro3',
    tools: ['read_file', 'bash', 'search'],
    outputContract: 'review.md in .oms/logs/reviews/',
    failureHandling: 'If diff is too large, review top-level structure and flag for manual review',
  },
  {
    name: 'researcher',
    description: 'Web/repo/doc research — summarizes sources and findings',
    model: 'solar-pro3',
    tools: ['web_search', 'web_fetch', 'read_file', 'search'],
    outputContract: 'research.md with sources, findings, and recommendations',
    failureHandling: 'If a source is unavailable, note it and continue',
  },
  {
    name: 'document-analyst',
    description: 'Upstage Document Parse + structured info extraction + Korean document summarization',
    model: 'solar-pro3',
    tools: ['read_file', 'oms_parse_document'],
    outputContract: 'structured JSON + summary markdown in .oms/parsed/',
    failureHandling: 'If file format unsupported, list supported formats',
  },
  {
    name: 'korean-localizer',
    description: 'Korean-first UX, tone, docs, government/business document style',
    model: 'solar-pro3',
    tools: ['read_file', 'write_file', 'search'],
    outputContract: 'Localized Korean content with proper style and register',
    failureHandling: 'If unsure about register, default to formal (합쇼체)',
  },
];
