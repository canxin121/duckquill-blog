+++
authors = ["canxin"]
title = "OpenCode Config شیئر: Layered Agents، Permissions اور مکمل مثال"
description = "OpenCode کنفگ کا ایک عملی شیئر، جس میں agent layering، provider models اور ایک مکمل ریفرنس کنفگ شامل ہے۔"
date = 2026-03-06
updated = 2026-03-06
slug = "my-opencode-setup"
[taxonomies]
tags = ["opencode", "ai-coding", "agents", "permissions", "llm"]
[extra]
toc = true
toc_inline = true
toc_ordered = true
go_to_top = true
+++

## 1. Merge order اور precedence

Precedence (کم -> زیادہ):

1. Remote `.well-known/opencode`
2. Global `~/.config/opencode/opencode.json`
3. `OPENCODE_CONFIG`
4. Project `opencode.json`
5. `.opencode` directories
6. `OPENCODE_CONFIG_CONTENT`

تجویز: دیرپا defaults کو global رکھیں، اور repo-specific قواعد ہر repository میں الگ رکھیں۔

## 2. Top-level config fields

اوپر کی سطح کے بنیادی fields:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "LocalScribe",
  "model": "my_oai/gpt-5.3-codex",
  "small_model": "my_oai/gpt-5.3-codex",
  "autoupdate": false,
  "compaction": {
    "auto": true,
    "prune": true
  },
  "agent": { ... },
  "plugin": [ ... ],
  "provider": { ... }
}
```

فیلڈ نوٹس:

- `"$schema"`: editor میں validation اور autocomplete کے لیے۔
- `default_agent`: روزمرہ کے لیے مستحکم default (`LocalScribe`)۔
- `model` اور `small_model`: یکساں behavior کے لیے ایک ہی ماڈل۔
- `autoupdate = false`: اپ گریڈ cadence کو کنٹرول میں رکھتا ہے۔
- `compaction.auto/prune`: طویل سیشنز کو قابلِ انتظام رکھتا ہے۔

## 3. Layered agent design

موجودہ `permission` اقدار کی بنیاد پر حقیقی حدود (ایک جدول):

| Agent | `read` | `edit` | `external_directory` | `bash` | نتیجہ |
| :-- | :-- | :-- | :-- | :-- | :-- |
| `LocalReader` | `read.* = allow` (بشمول `*.env`) | `ask` | `ask` | `ask` | workspace میں براہِ راست read؛ باہر read/write کے لیے تصدیق درکار |
| `LocalScribe` | `read.* = allow` (بشمول `*.env`) | `* = allow`, `*../* = deny` | `allow` | `* = allow`, خطرناک patterns پر `ask` | global read، لکھائی عموماً workspace کے اندر |
| `OmniReader` | `read.* = allow` (بشمول `*.env`) | `ask` | `allow` | `ask` | global read؛ لکھائی کے لیے تصدیق درکار |
| `OmniScribe` | `* = allow` (جس میں `read` شامل) | `* = allow` | `allow` | `* = allow`, خطرناک patterns پر `ask` | global read/write |

`LocalScribe` کو "عموماً workspace writable" اس لیے کہا جاتا ہے کہ traversal کو `*../* = deny` روکتا ہے۔ سخت workspace-only writes کے لیے `external_directory` کو `ask` یا `deny` پر رکھیں۔

Disabled built-ins:

```json
"agent": {
  "build": { "disable": true },
  "docs": { "disable": true },
  "plan": { "disable": true }
}
```

### 3.1 LocalReader

```json
"LocalReader": {
  "description": "Read-first agent; asks for non-read actions",
  "mode": "all",
  "permission": {
    "*": "ask",
    "bash": "ask",
    "edit": "ask",
    "glob": "allow",
    "grep": "allow",
    "list": "allow",
    "read": {
      "*": "allow",
      "*.env": "allow",
      "*.env.*": "allow"
    },
    "plan_enter": "deny",
    "plan_exit": "deny",
    "todoread": "deny",
    "todowrite": "deny"
  }
}
```

### 3.2 LocalScribe (default)

```json
"LocalScribe": {
  "description": "Reads any path; writes only inside workspace",
  "mode": "all",
  "permission": {
    "*": "allow",
    "bash": {
      "*": "allow",
      "sudo *": "ask",
      "su *": "ask",
      "rm -rf *": "ask",
      "rm -fr *": "ask",
      "mkfs* *": "ask",
      "reboot *": "ask",
      "shutdown *": "ask",
      "dd *": "ask"
    },
    "edit": {
      "*": "allow",
      "*../*": "deny"
    },
    "external_directory": "allow",
    "plan_enter": "deny",
    "plan_exit": "deny",
    "todoread": "deny",
    "todowrite": "deny"
  }
}
```

### 3.3 OmniReader

```json
"OmniReader": {
  "description": "Read-first agent for all paths; asks for non-read actions",
  "mode": "all",
  "permission": {
    "*": "ask",
    "external_directory": "allow",
    "read": {
      "*": "allow",
      "*.env": "allow",
      "*.env.*": "allow"
    },
    "bash": "ask",
    "edit": "ask"
  }
}
```

### 3.4 OmniScribe

```json
"OmniScribe": {
  "description": "Dangerous full access read/write anywhere",
  "mode": "all",
  "permission": {
    "*": "allow",
    "bash": {
      "*": "allow",
      "sudo *": "ask",
      "rm -rf *": "ask",
      "mkfs* *": "ask"
    },
    "external_directory": "allow",
    "plan_enter": "deny",
    "plan_exit": "deny"
  }
}
```

## 4. Provider اور model catalog ساخت

تین providers:

- `my_claude` (`@ai-sdk/anthropic`)
- `my_gemini` (`@ai-sdk/google`)
- `my_oai` (`@ai-sdk/openai`)

Provider structure:

1. provider metadata: `name`, `npm`
2. provider connection options: `options.baseURL`, `options.apiKey`, `options.setCacheKey`
3. `models` map: ہر model کے لیے ایک object

### 4.1 Common model JSON structure

```json
"provider": {
  "my_oai": {
    "name": "my_oai",
    "npm": "@ai-sdk/openai",
    "options": {
      "apiKey": "{env:OAI_API_KEY}",
      "baseURL": "https://your-gateway.example/v1",
      "setCacheKey": true
    },
    "models": {
      "gpt-5.3-codex": {
        "name": "gpt-5.3-codex",
        "attachment": true,
        "limit": {
          "context": 400000,
          "output": 128000
        },
        "modalities": {
          "input": ["text", "image", "pdf"],
          "output": ["text"]
        },
        "options": {
          "store": false,
          "include": ["reasoning.encrypted_content"]
        },
        "variants": {
          "high": { "reasoningEffort": "high", "reasoningSummary": "auto", "textVerbosity": "medium" },
          "medium": { "reasoningEffort": "medium", "reasoningSummary": "auto", "textVerbosity": "medium" },
          "low": { "reasoningEffort": "low", "reasoningSummary": "auto", "textVerbosity": "medium" },
          "xhigh": { "reasoningEffort": "xhigh", "reasoningSummary": "auto", "textVerbosity": "medium" }
        }
      }
    }
  }
}
```

### 4.2 Model field reference

| Field | Type | معنی |
| :-- | :-- | :-- |
| `name` | `string` | دکھانے والا نام |
| `attachment` | `boolean` | attachments فعال ہیں یا نہیں |
| `limit.context` | `number` | کل context window |
| `limit.output` | `number` | زیادہ سے زیادہ output tokens |
| `modalities.input` | `string[]` | input modalities، مثال `text/image/pdf` |
| `modalities.output` | `string[]` | output modalities، عموماً `text` |
| `options.store` | `boolean` | request storage toggle |
| `options.include` | `string[]` | اضافی returned fields |
| `variants` | `object` | ہر model کے reasoning profiles |

## 5. Plugin loading

Plugin config:

```json
"plugin": [
  "opencode-planpilot",
  "opencode-workbench"
]
```

### 5.1 opencode-planpilot (npm)

- npm: [opencode-planpilot](https://www.npmjs.com/package/opencode-planpilot)
- Package description: `Planpilot plugin for OpenCode`
- اہم صلاحیتیں:
  - پیچیدہ کام کو `plan -> step -> goal` میں تقسیم کرتا ہے۔
  - اگلا step `ai` ہونے پر auto-continue کرتا ہے۔
  - progress کو local طور پر محفوظ کرتا ہے (database + Markdown snapshot)۔
  - natural-language trigger flows کو سپورٹ کرتا ہے (مثلاً "use planpilot")۔

### 5.2 opencode-workbench (npm)

- npm: [opencode-workbench](https://www.npmjs.com/package/opencode-workbench)
- Package description: `Branch sandboxes for parallel OpenCode development`
- اہم صلاحیتیں:
  - `git worktree` کو OpenCode sessions سے map کرتا ہے۔
  - supervisor/worker orchestration کے ساتھ parallel tasks چلانے میں مدد دیتا ہے۔
  - branch, fork, PR metadata کو ٹریک کرتا ہے۔
  - optional version pinning سپورٹ کرتا ہے (مثلاً `opencode-workbench@0.3.2`)۔

## 6. مکمل کنفگ (حوالہ)

اس localized ورژن کو مختصر رکھنے کے لیے بہت بڑا JSONC بلاک یہاں دوبارہ نہیں دیا گیا۔ ضرورت ہو تو مکمل کنفگ انگریزی ورژن سے جوں کا توں استعمال کیا جا سکتا ہے۔

براہِ راست لنک: [English](@/blog/opencode-config/index.en.md)
