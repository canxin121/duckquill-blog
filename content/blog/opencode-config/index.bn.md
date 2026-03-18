+++
authors = ["canxin"]
title = "OpenCode Config শেয়ার: Default Agent, Plugin এবং Provider"
description = "বর্তমান global config-এর সংক্ষিপ্ত বিশ্লেষণ: default_agent, model routing, plugin ক্ষমতা এবং provider gateway বিন্যাস।"
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

## 1. বর্তমান কনফিগারেশন

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

Global layer দীর্ঘমেয়াদি defaults রাখার জন্য উপযুক্ত: `default_agent`, `model`, `small_model`, shared providers এবং shared plugins।

## 3. Top-level fields

| Field | Current value | ভূমিকা | নোট |
| :-- | :-- | :-- | :-- |
| `$schema` | `https://opencode.ai/config.json` | JSON validation + autocomplete | রাখা উচিত |
| `autoupdate` | `false` | Auto update বন্ধ | Stability-first workflow |
| `compaction.auto` | `true` | দীর্ঘ session auto compact | Recommended |
| `compaction.prune` | `true` | পুরনো tool output prune | Context bloat কমায় |
| `default_agent` | `cx-omni` | Default agent | Plugin দ্বারা সরবরাহিত |
| `model` | `openai/gpt-5.3-codex` | Main model | Primary path |
| `small_model` | `openai/gpt-5.1-codex-mini` | Lightweight model | Helper path / কম খরচ |
| `plugin[]` | 4 npm plugins | Capability extension | Cross-machine reuse সহজ |
| `provider.*.options` | `baseURL + apiKey` | Provider connection settings | Environment variables ব্যবহার |

## 4. `default_agent = cx-omni` এর উৎস

`cx-omni` নিবন্ধিত হয় `opencode-cx-agents` plugin দিয়ে; local config-এ manual `agent` block প্রয়োজন হয় না।

প্রভাব:

1. Global config compact থাকে।
2. Plugin load ব্যর্থ হলে `cx-omni` register হয় না।

## 5. Plugin stack (মূল অংশ)

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

**ভূমিকা**: complex task-এর জন্য structured execution।  
**Core capabilities**:

- unified model: `plan -> step -> goal`
- `ai / human` executor split
- next executor `ai` হলে auto-continue

**উপযুক্ত ব্যবহার**: multi-stage দীর্ঘ task যেখানে progress tracking দরকার।

### 5.3 `opencode-workbench`

**ভূমিকা**: branch/worktree-ভিত্তিক parallel orchestration।  
**Core capabilities**:

- session-to-worktree explicit binding
- worktree অনুযায়ী task routing
- branch/task context traceability

**উপযুক্ত ব্যবহার**: একই repo-তে একাধিক task সমান্তরালভাবে চালানো।

### 5.4 `opencode-web-preview`

**ভূমিকা**: local frontend preview session management।  
**Core capabilities**:

- available preview session খুঁজে পাওয়া
- local preview host start/stop
- preview status check

**উপযুক্ত ব্যবহার**: UI পরিবর্তনের দ্রুত validation।

### 5.5 `opencode-cx-agents`

**ভূমিকা**: preset agents সরবরাহ (যেমন `cx-omni`)।  
**Core capabilities**:

- naming এবং behavior baseline একীভূত করা
- per-project agent boilerplate কমানো

**উপযুক্ত ব্যবহার**: একাধিক repo-তে consistent agent strategy রাখা।

## 6. Provider এবং model routing

বর্তমান layout: এক gateway domain, provider-specific routes.

| Provider | baseURL | বর্ণনা |
| :-- | :-- | :-- |
| `anthropic` | `https://gateway.example.com/v1` | Anthropic-compatible route |
| `google` | `https://gateway.example.com/v1beta` | Gemini-compatible route |
| `openai` | `https://gateway.example.com/v1` | OpenAI-compatible route |
