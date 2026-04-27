const HELP_TEXT = `
Solar Code — Solar-native terminal coding agent

USAGE
  solar                        Launch the Solar Code agent shell
  solar "prompt"               Ask Solar Code in the current workspace
  solar --model solar-pro3     Launch with a model override
  solar --yes                  Auto-approve write/execute tool calls
  solar --readonly             Read-only mode

SLASH COMMANDS
  /help                        Show agent-shell commands
  /status                      Show session and connection status
  /model [model]               Show model usage
  /init                        Create SOLAR.md project guidance
  /history                     Show recent activity
  /clear                       Redraw the dashboard
  /oms doctor                  Run legacy command inside the shell
  /doctor                      Shortcut for /oms doctor
  /setup                       Shortcut for /oms setup
  /agents                      Shortcut for /oms agents

LEGACY SHELL COMMANDS
  solar setup                  Initialize .oms/ in the current project
  solar doctor                 Check environment and configuration
  solar parse <file>           Parse document with Upstage
  solar team <n> <goal>        Spawn parallel workers
  solar resume                 Resume last session

COMPATIBILITY
  oms still works as an alias while the project moves to Solar Code.

ENVIRONMENT
  UPSTAGE_API_KEY              Required for Solar API access
  UPSTAGE_BASE_URL             Override API base URL
  OMS_DEBUG                    Enable verbose debug output

PROJECT
  https://github.com/ultraworkers/solar-code
`;

export async function cmdHelp(_args: string[], _flags: Record<string, string | boolean>): Promise<number> {
  process.stdout.write(HELP_TEXT);
  return 0;
}
