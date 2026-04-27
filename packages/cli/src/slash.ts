import { cmdAgents } from './commands/agents.js';
import { cmdChat } from './commands/chat.js';
import { cmdDoctor } from './commands/doctor.js';
import { cmdHelp } from './commands/help.js';
import { cmdHud } from './commands/hud.js';
import { cmdParse } from './commands/parse.js';
import { cmdPlan } from './commands/plan.js';
import { cmdReview } from './commands/review.js';
import { cmdSetup } from './commands/setup.js';
import { cmdSkills } from './commands/skills.js';
import { cmdTdd } from './commands/tdd.js';
import { cmdTeam } from './commands/team.js';
import { cmdVersion } from './commands/version.js';

type SlashFn = (args: string[], flags: Record<string, string | boolean>) => Promise<number>;

const SLASH_COMMANDS: Record<string, SlashFn> = {
  agents: cmdAgents,
  chat: cmdChat,
  doctor: cmdDoctor,
  help: cmdHelp,
  hud: cmdHud,
  parse: cmdParse,
  plan: cmdPlan,
  review: cmdReview,
  setup: cmdSetup,
  skills: cmdSkills,
  tdd: cmdTdd,
  team: cmdTeam,
  version: cmdVersion,
};

export async function runSlashCommand(
  command: string,
  args: string[],
  flags: Record<string, string | boolean>
): Promise<number> {
  const fn = SLASH_COMMANDS[command];
  if (!fn) {
    process.stdout.write(`[solar] Unknown slash command: /${command}. Use /help.\n`);
    return 1;
  }
  return fn(args, flags);
}
