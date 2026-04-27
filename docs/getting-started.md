# Getting Started with Solar Code

## Prerequisites

- Node.js >= 20
- npm >= 9
- An Upstage API key ([console.upstage.ai](https://console.upstage.ai))
- Optional: `claw` binary for legacy/team workflows
- Optional: `tmux` for parallel team mode

## Installation

```bash
npm install -g solar-code
```

## Configuration

```bash
export UPSTAGE_API_KEY="up_..."
oms setup    # creates .oms/ in current directory
oms doctor   # verify environment
```

## Your First Session

```bash
# Interactive chat
oms

# One-shot prompt
oms chat "Solar AI에 대해 설명해줘"

# Coding agent (native engine)
oms code "README.md를 분석하고 개선안을 제안해줘"
```

## Shell Integration

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
export UPSTAGE_API_KEY="up_..."

# Optional: alias
alias solar="oms"
```
