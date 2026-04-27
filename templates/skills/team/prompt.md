# $team skill

Run: `oms team <n> <goal>`

Spawn N parallel workers (planner, architect, executor, reviewer, researcher).
Uses tmux for parallel execution and git worktrees for isolation.

Subcommands:
- `oms team status` — check worker status
- `oms team stop` — stop all workers
- `oms team logs` — view team logs
- `oms team resume` — resume stopped session
