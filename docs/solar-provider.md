# Solar Provider

Solar Code adds first-class Upstage Solar provider support.

## Configuration

| Setting | Value |
|---------|-------|
| Provider | `upstage` |
| API key env | `UPSTAGE_API_KEY` |
| Base URL env | `UPSTAGE_BASE_URL` |
| Default URL | `https://api.upstage.ai/v1` |
| Default model | `solar-pro3` |
| Protocol | OpenAI-compatible Chat Completions |

## Model Aliases

| Input | Resolved Model |
|-------|---------------|
| `solar` | `solar-pro3` |
| `solar3` | `solar-pro3` |
| `solar-pro3` | `solar-pro3` |
| `solar-pro2` | `solar-pro2` |
| `solar-pro` | `solar-pro3` |
| `solar-mini` | `solar-mini` |
| `upstage/solar-pro3` | `solar-pro3` |
| `upstage/solar-pro2` | `solar-pro2` |

## Priority

Solar aliases **always** route to Upstage, even if `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` are set.

## Using with Claw Code

Claw Code uses the OpenAI-compatible API. Solar Code wires Solar to Claw via:

```bash
OPENAI_API_KEY=$UPSTAGE_API_KEY
OPENAI_BASE_URL=https://api.upstage.ai/v1
```

This means all existing Claw features work with Solar transparently.

## Streaming

Streaming is supported via Server-Sent Events (SSE). All `oms` commands stream by default.

## Tool Calling

Upstage Solar supports OpenAI-compatible function calling. Tool definitions are passed as-is.
