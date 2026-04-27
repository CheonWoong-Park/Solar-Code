# Agents

Solar Code includes 7 built-in agents, each with a specific role and output contract.

## Built-in Agents

### planner
Turns vague requests into clear, actionable plans.
- **Model**: solar-pro3
- **Output**: `plan.md` → `.solar-code/plans/`
- **Usage**: `solar plan "목표"`

### architect
System design, repo architecture, API boundaries.
- **Model**: solar-pro3
- **Output**: `architecture.md`
- **Usage**: `solar plan "시스템 설계"` or via `solar team`

### executor
Implements code using the Claw backend.
- **Model**: solar-pro3
- **Output**: Working code in worktree
- **Usage**: `solar code "구현 목표"` or via `solar team`

### reviewer
Code review, security review, regression checks.
- **Model**: solar-pro3
- **Output**: `review.md` → `.solar-code/logs/reviews/`
- **Usage**: `solar review`

### researcher
Web/repo/doc research.
- **Model**: solar-pro3
- **Output**: `research.md` with sources
- **Usage**: `solar chat "Research: 주제"` or via `solar team`

### document-analyst
Upstage Document Parse + Korean document summarization.
- **Model**: solar-pro3
- **Output**: structured JSON + summary → `.solar-code/parsed/`
- **Usage**: `solar parse ./file.pdf`

### korean-localizer
Korean-first UX, tone, docs, business/government document style.
- **Model**: solar-pro3
- **Output**: Localized Korean content
- **Usage**: Via `solar chat` or as a team worker

## Custom Agents

Add custom agent profiles to `.solar-code/agents/<name>/`:

```
.solar-code/agents/my-agent/
  manifest.json
  prompt.md
```

`manifest.json`:
```json
{
  "name": "my-agent",
  "description": "My custom agent",
  "model": "solar-pro3",
  "tools": ["read_file", "write_file"],
  "outputContract": "custom-output.md",
  "failureHandling": "retry once, then report error"
}
```

List agents: `solar agents`
Show details: `solar agents show <name>`
