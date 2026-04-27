# Security

## API Key Handling

- `UPSTAGE_API_KEY` is **never** printed to stdout or logs
- Doctor output shows `[REDACTED]` instead of the actual key
- Log files do not contain API keys
- `redactSecrets()` is applied to any output that might contain key patterns

## Hooks Security

`.solar-code/hooks.json` can define shell commands that execute during sessions.

**Default**: hooks are **disabled** (`"enabled": false`).

Before enabling hooks:
1. Review all commands in `.solar-code/hooks.json`
2. Ensure you trust the source of the hooks
3. Set `"enabled": true` only after review

```
SECURITY WARNING: OMS hooks execute shell commands.
Only enable hooks from sources you trust.
Review .solar-code/hooks.json before enabling.
```

Hook commands receive context via environment variables (e.g., `OMS_COMMAND`), never via shell interpolation of user input.

## Path Traversal Prevention

MCP server operations validate that paths stay within `.solar-code/` — no `../` escapes allowed.

## Team Mode

Git worktrees are created per-worker, providing isolation. Each worker operates on its own branch.

## No Arbitrary Downloads

`npm install -g solar-code` only installs the TypeScript CLI and optional pre-built Claw binaries from npm. No arbitrary downloads from external URLs during install.

## Secrets in Code

Never commit `.solar-code/` to git — it may contain session logs and parsed documents. Add `.solar-code/` to `.gitignore`:

```
echo '.solar-code/' >> .gitignore
```

## Reporting Security Issues

Report security vulnerabilities at: https://github.com/ultraworkers/solar-code/security/advisories
