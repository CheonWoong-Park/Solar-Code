import { describe, expect, it } from 'vitest';
import { confirmToolExecution, permissionProfileFromFlags } from '../../packages/engine/src/agent/permissions.js';
import type { ToolExecutor } from '../../packages/engine/src/tools/index.js';

function tool(name: string, permission: 'read' | 'write' | 'execute'): ToolExecutor {
  return {
    name,
    permission,
    definition: { type: 'function', function: { name } },
    describe: () => name,
    execute: async () => ({ ok: true, output: 'ok' }),
  };
}

describe('permission profiles', () => {
  it('allows trusted profile to approve write tools without approving bash execution', async () => {
    await expect(confirmToolExecution('ask', tool('write_file', 'write'), 'file', 'trusted'))
      .resolves.toEqual({ allowed: true });
    await expect(confirmToolExecution('ask', tool('bash', 'execute'), 'npm test', 'trusted'))
      .resolves.toMatchObject({ allowed: false });
  });

  it('locks non-read tools in locked profile', async () => {
    await expect(confirmToolExecution('auto', tool('write_file', 'write'), 'file', 'locked'))
      .resolves.toMatchObject({ allowed: false });
    await expect(confirmToolExecution('auto', tool('read_file', 'read'), 'file', 'locked'))
      .resolves.toEqual({ allowed: true });
  });

  it('parses permission profile flags', () => {
    expect(permissionProfileFromFlags({ profile: 'trusted' })).toBe('trusted');
    expect(permissionProfileFromFlags({ 'permission-profile': 'locked' })).toBe('locked');
    expect(permissionProfileFromFlags({ readonly: true })).toBe('locked');
    expect(permissionProfileFromFlags({}, 'trusted')).toBe('trusted');
  });
});
