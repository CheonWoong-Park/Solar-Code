import { describe, expect, it } from 'vitest';
import { buildSolarWorkerCmd, shellQuote } from '../../packages/core/src/team.js';

describe('team command building', () => {
  it('shell-quotes prompts without embedding API keys', () => {
    const command = buildSolarWorkerCmd('solar-pro3', "don't leak");

    expect(command).toBe("solar --yes --model 'solar-pro3' 'don'\\''t leak'");
    expect(command).not.toContain('OPENAI_API_KEY');
    expect(command).not.toContain('UPSTAGE_API_KEY');
  });

  it('quotes shell values safely', () => {
    expect(shellQuote("/tmp/a dir/worker's")).toBe("'/tmp/a dir/worker'\\''s'");
  });
});
