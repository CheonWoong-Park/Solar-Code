import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { writeAtomic } from './state.js';

export interface OmsConfig {
  provider: 'upstage' | 'openai' | 'anthropic' | 'xai' | 'custom';
  model: string;
  language: 'ko' | 'en' | 'auto';
  backend: 'native' | 'claw-code' | 'none';
  agent: {
    permissionProfile: 'standard' | 'trusted' | 'locked';
  };
  documentParse: {
    enabled: boolean;
    outputFormat: 'markdown' | 'html' | 'text';
  };
  team: {
    useTmux: boolean;
    useWorktrees: boolean;
    maxWorkers: number;
  };
  hooks: {
    enabled: boolean;
    hooksFile: string;
  };
}

export const DEFAULT_CONFIG: OmsConfig = {
  provider: 'upstage',
  model: 'solar-pro3',
  language: 'ko',
  backend: 'native',
  agent: {
    permissionProfile: 'standard',
  },
  documentParse: {
    enabled: true,
    outputFormat: 'markdown',
  },
  team: {
    useTmux: true,
    useWorktrees: true,
    maxWorkers: 8,
  },
  hooks: {
    enabled: true,
    hooksFile: '.oms/hooks.json',
  },
};

export function getOmsDir(cwd = process.cwd()): string {
  return join(cwd, '.oms');
}

export function getConfigPath(cwd = process.cwd()): string {
  return join(getOmsDir(cwd), 'config.json');
}

export function loadConfig(cwd = process.cwd()): OmsConfig {
  const configPath = getConfigPath(cwd);
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<OmsConfig>;
    return deepMerge(DEFAULT_CONFIG, parsed) as OmsConfig;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: OmsConfig, cwd = process.cwd()): void {
  const omsDir = getOmsDir(cwd);
  mkdirSync(omsDir, { recursive: true });
  writeAtomic(getConfigPath(cwd), JSON.stringify(config, null, 2));
}

function deepMerge(base: any, override: any): any {
  if (typeof base !== 'object' || base === null) return override ?? base;
  if (typeof override !== 'object' || override === null) return base;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (key in base && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      result[key] = deepMerge(base[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

export function getUpstageApiKey(): string | undefined {
  return process.env['UPSTAGE_API_KEY'];
}

export function getUpstageBaseUrl(): string {
  return process.env['UPSTAGE_BASE_URL'] ?? 'https://api.upstage.ai/v1';
}

export function resolveModel(alias: string): { provider: string; model: string } {
  const normalised = alias.toLowerCase().trim();
  const SOLAR_ALIASES: Record<string, string> = {
    solar: 'solar-pro3',
    'solar3': 'solar-pro3',
    'solar-pro3': 'solar-pro3',
    'solar-pro2': 'solar-pro2',
    'solar-pro': 'solar-pro3',
    'solar-mini': 'solar-mini',
    'upstage/solar-pro3': 'solar-pro3',
    'upstage/solar-pro2': 'solar-pro2',
    'upstage/solar-mini': 'solar-mini',
  };
  if (normalised in SOLAR_ALIASES) {
    return { provider: 'upstage', model: SOLAR_ALIASES[normalised] };
  }
  if (normalised.startsWith('claude')) {
    return { provider: 'anthropic', model: alias };
  }
  if (normalised.startsWith('grok')) {
    return { provider: 'xai', model: alias };
  }
  if (normalised.startsWith('gpt-') || normalised.startsWith('openai/')) {
    return { provider: 'openai', model: alias.replace(/^openai\//, '') };
  }
  return { provider: 'upstage', model: alias };
}
