# npm Release Guide

## Package Structure

| Package | Purpose | Published |
|---------|---------|-----------|
| `solar-code` | Main CLI (`oms` command) | Yes |
| `@solar-code/core` | Provider, backend, state | Yes |
| `@solar-code/agents` | Agent definitions | Yes |
| `@solar-code/skills` | Skill registry | Yes |
| `@solar-code/mcp-server` | MCP server | Yes |

## Optional Platform Packages

Pre-built Claw binaries (published separately when available):

| Package | Platform |
|---------|---------|
| `@solar-code/claw-linux-x64-gnu` | Linux x64 |
| `@solar-code/claw-linux-arm64-gnu` | Linux arm64 |
| `@solar-code/claw-darwin-arm64` | macOS Apple Silicon |
| `@solar-code/claw-darwin-x64` | macOS Intel |
| `@solar-code/claw-win32-x64-msvc` | Windows x64 |

## Release Process

```bash
# 1. Run tests
npm run test
npm run typecheck
npm run build

# 2. Bump version (in each package + root)
npm version patch  # or minor/major

# 3. Dry run
cd packages/cli && npm publish --dry-run --access public

# 4. Publish (in order: dependencies first)
cd packages/core && npm publish --access public --provenance
cd ../agents && npm publish --access public --provenance
cd ../skills && npm publish --access public --provenance
cd ../mcp-server && npm publish --access public --provenance
cd ../cli && npm publish --access public --provenance
```

## CI/CD

Automatic publish on git tag push:

```bash
git tag v0.2.0
git push origin v0.2.0
```

GitHub Actions (`release.yml`) handles the rest.

## Required Secrets

- `NPM_TOKEN` — set in GitHub repo secrets. **Never print this value.**

## Provenance

All packages are published with `--provenance` for npm audit trail.
