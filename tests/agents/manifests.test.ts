import { describe, it, expect } from 'vitest';
import { BUILT_IN_AGENTS } from '../../packages/agents/src/manifests.js';

describe('BUILT_IN_AGENTS', () => {
  it('has 7 agents', () => {
    expect(BUILT_IN_AGENTS).toHaveLength(7);
  });

  const requiredFields = ['name', 'description', 'model', 'tools', 'outputContract', 'failureHandling'];

  for (const field of requiredFields) {
    it(`each agent has ${field}`, () => {
      for (const agent of BUILT_IN_AGENTS) {
        expect(agent).toHaveProperty(field);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((agent as any)[field]).toBeTruthy();
      }
    });
  }

  it('all agents default to solar-pro3 model', () => {
    for (const agent of BUILT_IN_AGENTS) {
      expect(agent.model).toBe('solar-pro3');
    }
  });

  it('includes expected agent names', () => {
    const names = BUILT_IN_AGENTS.map((a) => a.name);
    expect(names).toContain('planner');
    expect(names).toContain('architect');
    expect(names).toContain('executor');
    expect(names).toContain('reviewer');
    expect(names).toContain('researcher');
    expect(names).toContain('document-analyst');
    expect(names).toContain('korean-localizer');
  });

  it('tools is an array for each agent', () => {
    for (const agent of BUILT_IN_AGENTS) {
      expect(Array.isArray(agent.tools)).toBe(true);
      expect(agent.tools.length).toBeGreaterThan(0);
    }
  });
});
