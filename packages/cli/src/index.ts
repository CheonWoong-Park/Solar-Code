#!/usr/bin/env node
/**
 * Solar Code — oms CLI entry point
 * Solar-native agent orchestration layer
 */

import { parseArgs } from './args.js';
import { runCommand } from './commands/router.js';

async function main(): Promise<void> {
  const { command, args, flags } = parseArgs(process.argv.slice(2));

  try {
    const exitCode = await runCommand(command, args, flags);
    process.exit(exitCode ?? 0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\nError: ${message}\n`);
    if (process.env['OMS_DEBUG']) {
      console.error(err);
    }
    process.exit(1);
  }
}

main();
