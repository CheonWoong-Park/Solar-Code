import { cmdDefault } from './default.js';
import { cmdSetup } from './setup.js';
import { cmdDoctor } from './doctor.js';
import { cmdChat } from './chat.js';
import { cmdCode } from './code.js';
import { cmdPlan } from './plan.js';
import { cmdReview } from './review.js';
import { cmdTdd } from './tdd.js';
import { cmdParse } from './parse.js';
import { cmdTeam } from './team.js';
import { cmdHud } from './hud.js';
import { cmdResume } from './resume.js';
import { cmdAgents } from './agents.js';
import { cmdSkills } from './skills.js';
import { cmdParity } from './parity.js';
import { cmdVersion } from './version.js';
import { cmdHelp } from './help.js';

type CommandFn = (args: string[], flags: Record<string, string | boolean>) => Promise<number>;

const COMMANDS: Record<string, CommandFn> = {
  default: cmdDefault,
  setup: cmdSetup,
  doctor: cmdDoctor,
  chat: cmdChat,
  code: cmdCode,
  plan: cmdPlan,
  review: cmdReview,
  tdd: cmdTdd,
  parse: cmdParse,
  team: cmdTeam,
  hud: cmdHud,
  resume: cmdResume,
  agents: cmdAgents,
  skills: cmdSkills,
  parity: cmdParity,
  version: cmdVersion,
  help: cmdHelp,
};

export async function runCommand(
  command: string,
  args: string[],
  flags: Record<string, string | boolean>
): Promise<number> {
  const fn = COMMANDS[command] ?? cmdHelp;
  return fn(args, flags);
}
