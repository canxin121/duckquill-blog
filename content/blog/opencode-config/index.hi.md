+++
authors = ["canxin"]
title = "OpenCode Config शेयर: Default Agent, Plugins और Provider"
description = "मौजूदा global config का संक्षिप्त विवरण: default_agent, model routing, plugin capabilities और provider gateway संरचना।"
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

## 1. वर्तमान कॉन्फ़िगरेशन

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

Global layer long-term defaults के लिए उपयुक्त है: `default_agent`, `model`, `small_model`, shared providers और shared plugins.

## 3. Top-level fields

| Field | Current value | भूमिका | नोट |
| :-- | :-- | :-- | :-- |
| `$schema` | `https://opencode.ai/config.json` | JSON validation + autocomplete | रखना चाहिए |
| `autoupdate` | `false` | Auto update बंद | Stability-first workflow |
| `compaction.auto` | `true` | लंबे sessions auto compact | Recommended |
| `compaction.prune` | `true` | पुराने tool output prune | Context bloat कम करता है |
| `default_agent` | `cx-omni` | Default agent | Plugin द्वारा उपलब्ध |
| `model` | `openai/gpt-5.3-codex` | Main model | Primary path |
| `small_model` | `openai/gpt-5.1-codex-mini` | Lightweight model | Helper path / cost |
| `plugin[]` | 4 npm plugins | Capability extension | Cross-machine reuse आसान |
| `provider.*.options` | `baseURL + apiKey` | Provider connection settings | Environment variables उपयोग |

## 4. `default_agent = cx-omni` का स्रोत

`cx-omni` को `opencode-cx-agents` plugin register करता है; local config में manual `agent` block की जरूरत नहीं होती।

प्रभाव:

1. Global config compact रहती है।
2. Plugin load fail होने पर `cx-omni` register नहीं होता।

## 5. Plugin stack (मुख्य भाग)

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

**भूमिका**: complex tasks के लिए structured execution.  
**Core capabilities**:

- unified model: `plan -> step -> goal`
- `ai / human` executor split
- next executor `ai` होने पर auto-continue

**उपयुक्त परिदृश्य**: multi-stage लंबे tasks जिनमें progress tracking जरूरी हो।

### 5.3 `opencode-workbench`

**भूमिका**: branch/worktree आधारित parallel orchestration.  
**Core capabilities**:

- session-to-worktree explicit binding
- worktree-wise task routing
- branch/task context traceability

**उपयुक्त परिदृश्य**: एक ही repo में parallel task execution.

### 5.4 `opencode-web-preview`

**भूमिका**: local frontend preview session management.  
**Core capabilities**:

- available preview sessions detect करना
- local preview host start/stop
- preview status check

**उपयुक्त परिदृश्य**: UI changes की तेज validation.

### 5.5 `opencode-cx-agents`

**भूमिका**: preset agents देना (जैसे `cx-omni`)।  
**Core capabilities**:

- naming और behavior baseline को unify करना
- per-project agent boilerplate कम करना

**उपयुक्त परिदृश्य**: multiple repos में consistent agent strategy रखना।

## 6. Provider और model routing

वर्तमान layout: एक gateway domain, provider-specific routes.

| Provider | baseURL | विवरण |
| :-- | :-- | :-- |
| `anthropic` | `https://gateway.example.com/v1` | Anthropic-compatible route |
| `google` | `https://gateway.example.com/v1beta` | Gemini-compatible route |
| `openai` | `https://gateway.example.com/v1` | OpenAI-compatible route |
