import { ensureUpstageApiKey } from '../upstage-key.js';

export async function cmdLogin(
  _args: string[],
  _flags: Record<string, string | boolean>
): Promise<number> {
  return (await ensureUpstageApiKey({ forcePrompt: true })) ? 0 : 1;
}
