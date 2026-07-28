# Plan: Add Architect Agent with OpenRouter OWL Alpha (Default Model)

## Objective
Configure OpenRouter as a provider, set `openrouter/owl-alpha` as the default model, and create a new "architect" agent that uses it.

## Impacted Files
- `.kilo/opencode.json` (add OpenRouter provider, change default `model` and `small_model`)
- `.env` (add `OPENROUTER_API_KEY`)
- `.kilo/agent/architect.md` (new)

## Step-by-Step Blueprint

### 1. Update `.kilo/opencode.json` — add OpenRouter provider, set default model

OpenRouter needs a provider entry with an API key. `.kilo/opencode.json` takes precedence over the root `opencode.jsonc` (loaded later), so modify it:

- Add an `openrouter` block under `"provider"`:
```jsonc
"openrouter": {
  "options": {
    "apiKey": "{env:OPENROUTER_API_KEY}",
    "baseURL": "https://openrouter.ai/api/v1"
  }
}
```
- Change `"model"` from `"openai/gpt-4o"` to `"openrouter/owl-alpha"`
- Change `"small_model"` from `"openai/gpt-4o-mini"` to `"openrouter/owl-alpha"` (or keep a smaller OpenRouter model)

Resulting `.kilo/opencode.json`:
```jsonc
{
  "$schema": "https://opencode.ai",
  "model": "openrouter/owl-alpha",
  "small_model": "openrouter/owl-alpha",
  "provider": {
    "openai": {
      "options": {
        "apiKey": "YOUR_API_KEY",
        "baseURL": "https://api.openai.com/v1"
      }
    },
    "openrouter": {
      "options": {
        "apiKey": "{env:OPENROUTER_API_KEY}",
        "baseURL": "https://openrouter.ai/api/v1"
      }
    }
  },
  "mcp": {
    "figma": {
      "type": "local",
      "enabled": true,
      "command": "cmd.exe",
      "args": ["/c", "npx", "-y", "figma-mcp"],
      "env": {
        "FIGMA_API_KEY": "figd_SXZwxjL7enms6b2YSrMll19tDt8EAzhwVRq8Bbz-",
        "FIGMA_ACCESS_TOKEN": "figd_SXZwxjL7enms6b2YSrMll19tDt8EAzhwVRq8Bbz-"
      }
    }
  }
}
```

### 2. Add `OPENROUTER_API_KEY` to `.env`

User must add their OpenRouter API key to `.env`:
```
OPENROUTER_API_KEY=sk-or-v1-...
```

### 3. Create architect agent definition

Create `.kilo/agent/architect.md` with frontmatter:
```yaml
---
description: Principal Software Architect — system design, architecture planning, and technical debt analysis
mode: primary
model: openrouter/owl-alpha
color: "#7C3AED"
---

You are a Principal Software Architect. Focus strictly on:
- Breaking down structural paths and system design
- Calculating technical debt and architectural risks
- Defining strict execution milestones
- Producing clean, modular architecture plans
- Analyzing tradeoffs and recommending optimal solutions
```

### 4. Verify agent loads

Run a Kilo command that lists agents to confirm `architect` appears and uses `openrouter/owl-alpha`. The model should resolve via the OpenRouter provider.

## Verification Checklist
1. `OPENROUTER_API_KEY` is set in `.env`
2. OpenRouter provider is configured in `.kilo/opencode.json` with `{env:OPENROUTER_API_KEY}` key reference
3. `"model": "openrouter/owl-alpha"` is set as default in `.kilo/opencode.json`
4. `.kilo/agent/architect.md` exists with correct frontmatter
5. Agent is selectable via `/agents` in Kilo TUI and routes to `openrouter/owl-alpha`
