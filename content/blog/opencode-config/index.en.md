+++
authors = ["canxin"]
title = "OpenCode Config Share: Default Agent, Plugins, and Providers"
description = "A concise walkthrough of current global defaults: default agent, model routing, plugin capabilities, and provider gateway layout."
slug = "my-opencode-setup"
weight = 10
[taxonomies]
tags = ["opencode", "ai-coding", "agents", "config"]
[extra]
toc = true
toc_inline = true
toc_ordered = true
go_to_top = true
+++

## 1. Current configuration

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "autoupdate": false,
  "compaction": {
    "auto": true,
    "prune": true
  },
  "default_agent": "cx-omni",
  "model": "openai/gpt-5.3-codex",
  "small_model": "openai/gpt-5.1-codex-mini",
  "plugin": [
    "opencode-planpilot",
    "opencode-workbench",
    "opencode-web-preview",
    "opencode-cx-agents"
  ],
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "{env:CLAUDE_API_KEY}",
        "baseURL": "https://gateway.example.com/v1"
      }
    },
    "google": {
      "options": {
        "apiKey": "{env:GEMINI_API_KEY}",
        "baseURL": "https://gateway.example.com/v1beta"
      }
    },
    "openai": {
      "options": {
        "apiKey": "{env:OPENAI_API_KEY}",
        "baseURL": "https://gateway.example.com/v1",
        "setCacheKey": true
      }
    }
  }
}
```

## 2. Merge precedence

OpenCode precedence (low -> high):

1. Remote `.well-known/opencode`
2. Global `~/.config/opencode/opencode.json`
3. `OPENCODE_CONFIG`
4. Project `opencode.json`
5. `.opencode` directories (agents/commands/plugins)
6. `OPENCODE_CONFIG_CONTENT`

Global config is best for durable defaults: `default_agent`, `model`, `small_model`, shared providers, and shared plugins.

## 3. Top-level fields

| Field | Current value | Purpose | Note |
| :-- | :-- | :-- | :-- |
| `$schema` | `https://opencode.ai/config.json` | JSON validation and completion | Keep enabled |
| `autoupdate` | `false` | Disable auto-updates | Stability-first |
| `compaction.auto` | `true` | Auto-compacts long sessions | Recommended |
| `compaction.prune` | `true` | Prunes old tool output | Reduces context bloat |
| `default_agent` | `cx-omni` | Default runtime agent | Provided by plugin |
| `model` | `openai/gpt-5.3-codex` | Primary model | Main path |
| `small_model` | `openai/gpt-5.1-codex-mini` | Lightweight model | Helper path / cost control |
| `plugin[]` | 4 npm plugins | Capability extensions | Easy cross-machine reuse |
| `provider.*.options` | `baseURL + apiKey` | Provider connection settings | Uses environment variables |

## 4. Where `default_agent = cx-omni` comes from

`cx-omni` is registered by the `opencode-cx-agents` plugin, not hand-written in a local `agent` block.

Effects:

1. Global config stays compact.
2. If plugin loading fails, `cx-omni` is not registered.

## 5. Plugin stack (focus)

### 5.1 Plugin list (npm names)

```json
"plugin": [
  "opencode-planpilot",
  "opencode-workbench",
  "opencode-web-preview",
  "opencode-cx-agents"
]
```

### 5.2 `opencode-planpilot`

**Role**: structured execution for complex work.  
**Core capabilities**:

- unified model: `plan -> step -> goal`
- explicit `ai / human` executor split
- auto-continue when the next step executor is `ai`

**Typical use**: long multi-stage tasks that need clear progress tracking.

### 5.3 `opencode-workbench`

**Role**: parallel orchestration with branches/worktrees.  
**Core capabilities**:

- explicit session-to-worktree binding
- task routing per worktree for parallel development
- branch/task context traceability

**Typical use**: concurrent tasks in the same repository.

### 5.4 `opencode-web-preview`

**Role**: local frontend preview session management.  
**Core capabilities**:

- discover available preview sessions
- start/stop local preview hosts
- check preview status for regression verification

**Typical use**: quick UI verification loops.

### 5.5 `opencode-cx-agents`

**Role**: provides preset agents (including `cx-omni`).  
**Core capabilities**:

- unified naming and behavior baseline
- reduced per-project agent boilerplate

**Typical use**: consistent agent strategy across repositories.

## 6. Provider and model routing

Current provider layout: single gateway domain with provider-specific routes.

| Provider | baseURL | Notes |
| :-- | :-- | :-- |
| `anthropic` | `https://gateway.example.com/v1` | Anthropic-compatible route |
| `google` | `https://gateway.example.com/v1beta` | Gemini-compatible route |
| `openai` | `https://gateway.example.com/v1` | OpenAI-compatible route |
