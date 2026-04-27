import { describe, it, expect } from 'vitest';
import { BUILT_IN_SKILLS, findSkill } from '../../packages/skills/src/registry.js';

describe('BUILT_IN_SKILLS', () => {
  it('has 12 skills', () => {
    expect(BUILT_IN_SKILLS).toHaveLength(12);
  });

  const requiredFields = ['name', 'trigger', 'description', 'usage', 'example'];

  for (const field of requiredFields) {
    it(`each skill has ${field}`, () => {
      for (const skill of BUILT_IN_SKILLS) {
        expect(skill).toHaveProperty(field);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((skill as any)[field]).toBeTruthy();
      }
    });
  }

  it('all triggers start with $', () => {
    for (const skill of BUILT_IN_SKILLS) {
      expect(skill.trigger.startsWith('$')).toBe(true);
    }
  });

  it('includes expected skill names', () => {
    const names = BUILT_IN_SKILLS.map((s) => s.name);
    expect(names).toContain('plan');
    expect(names).toContain('review');
    expect(names).toContain('tdd');
    expect(names).toContain('parse');
    expect(names).toContain('summarize-doc');
    expect(names).toContain('contract-review');
    expect(names).toContain('ship');
    expect(names).toContain('doctor');
  });
});

describe('findSkill', () => {
  it('finds by name', () => {
    const skill = findSkill('plan');
    expect(skill?.name).toBe('plan');
  });

  it('finds by trigger', () => {
    const skill = findSkill('$plan');
    expect(skill?.name).toBe('plan');
  });

  it('returns undefined for unknown skill', () => {
    expect(findSkill('nonexistent')).toBeUndefined();
  });
});
