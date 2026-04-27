# Skills

Skills are reusable prompt workflows that can be invoked by trigger name.

## Built-in Skills

| Trigger | Command | Description |
|---------|---------|-------------|
| `$plan` | `oms plan <goal>` | Full planning workflow |
| `$deep-interview` | `oms chat "$deep-interview <topic>"` | Requirements gathering |
| `$review` | `oms review` | Code review via Solar |
| `$tdd` | `oms tdd <feature>` | Test-driven implementation |
| `$parse` | `oms parse <file>` | Document parsing |
| `$summarize-doc` | `oms parse <file> --ask "요약"` | Document summarization |
| `$contract-review` | `oms parse <file> --ask "계약 검토"` | Contract risk analysis |
| `$repo-map` | `oms chat "$repo-map"` | Repository map |
| `$team` | `oms team <n> <goal>` | Multi-agent team |
| `$research` | `oms chat "$research <topic>"` | Deep research |
| `$ship` | `oms chat "$ship"` | Pre-release checklist |
| `$doctor` | `oms doctor` | Environment check |

## Custom Skills

Add skills to `.oms/skills/<name>/`:

```
.oms/skills/my-skill/
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

Install a skill: `oms skills install <path>`
List skills: `oms skills`
Show skill: `oms skills show <name>`
