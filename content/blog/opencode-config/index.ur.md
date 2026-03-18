+++
authors = ["canxin"]
title = "OpenCode Config شیئر: Default Agent، Plugins اور Provider"
description = "موجودہ global config کا مختصر جائزہ: default_agent، model routing، plugin صلاحیتیں، اور provider gateway ساخت۔"
date = 2026-03-18
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

## 1. موجودہ configuration

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "autoupdate": false,
  "compaction": {
    "auto": true,
    "prune": true
  },
  "default_agent": "cx-local",
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

Global layer طویل مدتی defaults کے لئے موزوں ہے: `default_agent`، `model`، `small_model`، مشترک providers اور plugins۔

## 3. Top-level fields

| Field | Current value | مقصد | نوٹ |
| :-- | :-- | :-- | :-- |
| `$schema` | `https://opencode.ai/config.json` | JSON validation + autocomplete | برقرار رکھیں |
| `autoupdate` | `false` | Auto update بند | Stability-first workflow |
| `compaction.auto` | `true` | لمبی sessions auto compact | Recommended |
| `compaction.prune` | `true` | پرانا tool output prune | Context bloat کم کرتا ہے |
| `default_agent` | `cx-local` | Default agent | Plugin فراہم کرتا ہے (0.2.0 سے recommended) |
| `model` | `openai/gpt-5.3-codex` | Main model | Primary path |
| `small_model` | `openai/gpt-5.1-codex-mini` | Lightweight model | Helper path / کم لاگت |
| `plugin[]` | 4 npm plugins | Capability extension | Cross-machine reuse آسان |
| `provider.*.options` | `baseURL + apiKey` | Provider connection settings | Environment variables استعمال |

## 4. `default_agent = cx-local` کا ماخذ

`cx-local` کو [`opencode-cx-agents`](https://github.com/canxin121/opencode-cx-agents) plugin register کرتا ہے؛ local config میں manual `agent` block ضروری نہیں۔

یہ plugin canonical agents فراہم کرتا ہے: `cx-explore`، `cx-local`، `cx-global`۔

اثرات:

1. Global config compact رہتی ہے۔
2. Plugin load fail ہو تو default agent register نہیں ہوتا۔

## 5. Plugin stack (اہم حصہ)

### 5.1 Plugin list (npm names)

```json
"plugin": [
  "opencode-planpilot",
  "opencode-workbench",
  "opencode-web-preview",
  "opencode-cx-agents"
]
```

GitHub repositories:

- [`opencode-planpilot`](https://github.com/canxin121/opencode-planpilot)
- [`opencode-workbench`](https://github.com/canxin121/opencode-workbench)
- [`opencode-web-preview`](https://github.com/canxin121/opencode-web-preview)
- [`opencode-cx-agents`](https://github.com/canxin121/opencode-cx-agents)

### 5.2 [`opencode-planpilot`](https://github.com/canxin121/opencode-planpilot)

**کردار**: پیچیدہ کام کے لئے structured execution۔  
**Core capabilities**:

- unified model: `plan -> step -> goal`
- `ai / human` executor split
- next executor `ai` ہو تو auto-continue

**موزوں استعمال**: multi-stage لمبے tasks جہاں progress tracking درکار ہو۔

### 5.3 [`opencode-workbench`](https://github.com/canxin121/opencode-workbench)

**کردار**: branch/worktree بنیاد پر parallel orchestration۔  
**Core capabilities**:

- session-to-worktree explicit binding
- worktree کے مطابق task routing
- branch/task context traceability

**موزوں استعمال**: ایک ہی repo میں متعدد tasks کو متوازی چلانا۔

### 5.4 [`opencode-web-preview`](https://github.com/canxin121/opencode-web-preview)

**کردار**: local frontend preview session management۔  
**Core capabilities**:

- available preview sessions دریافت کرنا
- local preview host start/stop
- preview status check

**موزوں استعمال**: UI تبدیلیوں کی فوری validation۔

### 5.5 [`opencode-cx-agents`](https://github.com/canxin121/opencode-cx-agents)

**کردار**: reusable preset agents اور permission baseline فراہم کرنا۔  
**Core capabilities**:

- canonical agents: `cx-explore`، `cx-local`، `cx-global`
- write permission tiers:
  - `cx-local`: workspace-first، `external_directory: ask`
  - `cx-global`: cross-directory writes، `external_directory: allow`
- [`opencode-planpilot`](https://github.com/canxin121/opencode-planpilot)، [`opencode-workbench`](https://github.com/canxin121/opencode-workbench)، اور [`opencode-web-preview`](https://github.com/canxin121/opencode-web-preview) کے ساتھ tool visibility برقرار رکھتے ہوئے کام کرنا

**موزوں استعمال**: کئی repos میں consistent agent strategy اور risk-based write defaults برقرار رکھنا۔

### 5.6 استعمال کی تجاویز

1. safe default کے طور پر `default_agent = cx-local` رکھیں۔
2. صرف تب `cx-global` منتخب کریں جب cross-directory auto-write واقعی ضروری ہو۔
3. startup کے بعد `cx-explore / cx-local / cx-global` کی visibility verify کریں۔

## 6. Provider اور model routing

موجودہ layout: ایک gateway domain، provider-specific routes۔

| Provider | baseURL | وضاحت |
| :-- | :-- | :-- |
| `anthropic` | `https://gateway.example.com/v1` | Anthropic-compatible route |
| `google` | `https://gateway.example.com/v1beta` | Gemini-compatible route |
| `openai` | `https://gateway.example.com/v1` | OpenAI-compatible route |
