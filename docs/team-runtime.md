# Team Runtime

`oms team` spawns N parallel workers to tackle large goals.

## Usage

```bash
# Spawn 3 workers
oms team 3 "결제 모듈을 리팩토링하고 테스트를 보강해줘"

# 5-worker team
oms team 5 "API 서버 성능 최적화"

# Manage team
oms team status   # check worker status
oms team logs     # view team logs
oms team stop     # stop all workers
oms team resume   # resume last session
```

## Worker Roles

Workers are assigned roles round-robin from:

| Role | Responsibility |
|------|---------------|
| `planner` | Break down goal, write plan.md |
| `architect` | Design system, write architecture.md |
| `executor` | Implement code |
| `reviewer` | Review changes, write review.md |
| `researcher` | Research patterns and APIs |

## How It Works

1. Team session created with unique ID
2. Git worktrees created per worker: `.oms/team/<id>/worktrees/worker-N`
3. Each worker gets its own branch: `oms-team-<id>-N-<role>`
4. Workers spawned in tmux windows (parallel)
5. Each worker runs Claw Code with Solar
6. Results aggregated to `.oms/team/<id>/summary.md`

## tmux Integration

With tmux installed, all workers run in parallel in separate windows:

```
Session: oms-team-<id>
  Window 0: worker-1-planner
  Window 1: worker-2-architect
  Window 2: worker-3-executor
```

Attach: `tmux attach -t oms-team-<id>`

## Graceful Degradation

If tmux is not available:
- Workers run sequentially
- Clear message explains how to install tmux
- Does NOT fail unless `--tmux-required` flag is set

## State

```
.oms/team/<session-id>/
  session.json           # Session metadata and worker list
  team.log               # Execution log
  worktrees/
    worker-1/            # Git worktree for worker 1
    worker-2/            # Git worktree for worker 2
```
