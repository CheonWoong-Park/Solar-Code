# Getting Started with Solar Code

## Prerequisites

- Node.js >= 20
- npm >= 9
- An Upstage API key ([console.upstage.ai](https://console.upstage.ai))
- Optional: `claw` binary for team workflows
- Optional: `tmux` for parallel team mode

## Installation

```bash
npm install -g solar-code
```

## Configuration

```bash
solar login   # saves your key to ~/.solar-code/auth.json
solar setup    # creates .solar-code/ in current directory
solar doctor   # verify environment
```

## Your First Session

```bash
# Interactive chat
solar

# One-shot prompt
solar chat "Solar AI에 대해 설명해줘"

# Coding agent (native engine)
solar code "README.md를 분석하고 개선안을 제안해줘"
```

## Shell Integration

Optional custom base URL:

```bash
export UPSTAGE_BASE_URL="https://..."
```
