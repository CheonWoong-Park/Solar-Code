# Skills

Skills are reusable prompt workflows that can be invoked by trigger name.

## Built-in Skills

| Trigger | Command | Description |
|---------|---------|-------------|
| `$plan` | `solar plan <goal>` | Full planning workflow |
| `$deep-interview` | `solar chat "$deep-interview <topic>"` | Requirements gathering |
| `$review` | `solar review` | Code review via Solar |
| `$tdd` | `solar tdd <feature>` | Test-driven implementation |
| `$parse` | `solar parse <file>` | Document parsing |
| `$summarize-doc` | `solar parse <file> --ask "요약"` | Document summarization |
| `$contract-review` | `solar parse <file> --ask "계약 검토"` | Contract risk analysis |
| `$repo-map` | `solar chat "$repo-map"` | Repository map |
| `$team` | `solar team <n> <goal>` | Multi-agent team |
| `$research` | `solar chat "$research <topic>"` | Deep research |
| `$ship` | `solar chat "$ship"` | Pre-release checklist |
| `$doctor` | `solar doctor` | Environment check |

## Custom Skills

Add skills to `.solar-code/skills/<name>/`:

```
.solar-code/skills/my-skill/
  manifest.json
  prompt.md
```

`manifest.json`:
```json
{
  "name": "my-skill",
  "trigger": "$my-skill",
  "description": "My custom skill",
  "usage": "$my-skill <input>",
  "example": "$my-skill 예시 입력"
}
```

Install a skill: `solar skills install <path>`
List skills: `solar skills`
Show skill: `solar skills show <name>`
