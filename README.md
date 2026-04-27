# Solar Code

Solar-native terminal coding agent for local repositories. It is designed as an interactive agent shell, closer to Claude Code or Codex CLI than a collection of standalone commands.

```bash
npm install -g solar-code
export UPSTAGE_API_KEY="up_..."
solar
```

`oms` remains as a compatibility alias, but the primary product is now **Solar Code**.

## What It Is

Solar Code runs a TypeScript Solar function-calling engine with local coding tools. It can inspect a repository, create and edit files, run commands, and keep session history under project state.

The main workflow is:

```text
solar
› ask Solar Code for code work
• Thinking
• Plan write_file src/example.ts
• Modified
  Write src/example.ts
  ? approve? y yes · n no · enter deny
solar › done
```

Use slash commands like `/status`, `/doctor`, and `/setup` inside the shell.

## Terminal UX

The interactive shell keeps conversation and work logs visually separate:

```text
› Implement a Tetris game in test/tetris.html

  solar-pro3 ask · /mnt/d/DEV/OhMySolar
• Thinking (2s • esc to interrupt)
• Plan write_file test/tetris.html
• Modified
  Write test/tetris.html
  ok
• Next read tool result and continue
solar › Created test/tetris.html.
```

UI behavior:

| Surface | Behavior |
|---------|----------|
| User input | Dark input card with `›` prompt |
| Status line | Shows active model, permission mode, and cwd |
| Work log | `Thinking`, `Plan`, `Explored`, `Modified`, `Ran`, `Next` |
| Tool approval | Single-key approval: `y` approve, `n`/Enter/Esc deny |
| Interrupt | Press Esc or Ctrl+C while thinking to interrupt |
| Markdown emphasis | `**important**` renders as purple `important` in terminal output |

## Agent Shell

| Command | Description |
|---------|-------------|
| `/help` | Show shell commands |
| `/status` | Show session, model, mode, and connection status |
| `/model [model]` | Show model usage |
| `/init` | Create `SOLAR.md` project guidance |
| `/history` | Show recent activity |
| `/clear` | Redraw the dashboard |
| `/doctor` | Run environment checks |
| `/setup` | Initialize `.oms/` state |
| `/agents` | List/show agent profiles |
| `/oms <command>` | Run legacy commands inside the agent shell |

Examples:

```text
/doctor
/setup
/oms parse ./report.pdf --ask "핵심 내용을 요약해줘"
/oms team 3 "인증 모듈 리팩토링"
```

## Shell Entry Points

| Command | Description |
|---------|-------------|
| `solar` | Launch the interactive agent shell |
| `solar "prompt"` | One-shot agent prompt in the current workspace |
| `solar --yes` | Auto-approve write/execute tool calls |
| `solar --readonly` | Block write/execute tool calls |
| `solar --model solar-pro3` | Override model |
| `solar resume` | Resume the last session |

Legacy commands still work while the shell absorbs them:

```bash
solar setup
solar doctor
solar parse ./report.pdf --ask "요약해줘"
solar team 3 "결제 모듈을 리팩토링해줘"
oms doctor   # compatibility alias
```

## Workspace Boundaries

Tools are scoped to the current workspace. File tools reject paths outside the directory where `solar` was launched.

For example, from `/mnt/d/DEV/OhMySolar`:

```text
test/tetris.html          # OK: inside workspace
/mnt/d/DEV/OhMySolar/test/tetris.html  # OK: same workspace
/mnt/d/DEV/test/tetris.html            # blocked: outside workspace
```

To work in `/mnt/d/DEV/test`, start Solar Code there:

```bash
cd /mnt/d/DEV/test
solar
```

## Native Engine

Solar Code uses a TypeScript Solar function-calling engine with local tools:

| Tool | Purpose |
|------|---------|
| `bash` | Run shell commands with timeout/output limits |
| `read_file` | Read workspace files with line numbers |
| `write_file` | Create or overwrite files atomically |
| `edit_file` | Replace exact strings safely |
| `glob` | Find files by pattern |
| `grep` | Search file contents |
| `list_files` | List directories |

Permission modes:

| Mode | Behavior |
|------|----------|
| `ask` | Ask before write/execute tools |
| `auto` | Auto-approve tools with `--yes` |
| `readonly` | Block write/execute tools |

## State

Solar Code currently stores project state under `.oms/` for compatibility:

```text
.oms/
  config.json
  sessions/
  state/
  logs/
  plans/
  parsed/
  team/
  agents/
  skills/
```

Session history is saved as JSONL in `.oms/sessions/`.

## Development

```bash
npm install
npm run build
npm run typecheck
npm test
npm run lint
npm run link:global
solar
```

Build order:

```text
core -> engine -> agents -> skills -> mcp-server -> cli
```

Current QA baseline:

```bash
npm run build
npm run typecheck
npm test
npm run lint
```

The test suite includes engine tool tests, stream parser tests, and terminal output rendering tests for input-card cursor placement and streamed `**bold**` emphasis rendering.

## Environment

```bash
export UPSTAGE_API_KEY="up_..."
export UPSTAGE_BASE_URL="https://..." # optional
```

Default model: `solar-pro3`.

## License

MIT
