+++
authors = ["canxin"]
title = "OpenCode কনফিগ শেয়ার: লেয়ার্ড এজেন্ট, পারমিশন এবং পূর্ণ উদাহরণ"
description = "OpenCode কনফিগের একটি বাস্তবমুখী শেয়ার, যেখানে agent layering, provider models এবং পূর্ণ উদাহরণ রয়েছে।"
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

## 1. মার্জ অর্ডার ও প্রাধান্য

প্রাধান্য (নিম্ন -> উচ্চ):

1. Remote `.well-known/opencode`
2. Global `~/.config/opencode/opencode.json`
3. `OPENCODE_CONFIG`
4. Project `opencode.json`
5. `.opencode` directories
6. `OPENCODE_CONFIG_CONTENT`

প্রস্তাবনা: টেকসই ডিফল্ট global-এ রাখুন; repo-নির্দিষ্ট নিয়ম সংশ্লিষ্ট repository-তে রাখুন।

## 2. টপ-লেভেল কনফিগ ফিল্ড

টপ-লেভেলের প্রধান ফিল্ডগুলো:

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

ফিল্ড নোট:

- `"$schema"`: এডিটরে validation ও autocomplete.
- `default_agent`: দৈনন্দিন ব্যবহারের স্থিতিশীল ডিফল্ট (`LocalScribe`).
- `model` এবং `small_model`: আচরণে সামঞ্জস্য রাখতে একই মডেল।
- `autoupdate = false`: নিয়ন্ত্রিত আপগ্রেড চক্র।
- `compaction.auto/prune`: দীর্ঘ সেশনকে ব্যবস্থাপনাযোগ্য রাখে।

## 3. লেয়ার্ড এজেন্ট ডিজাইন

বর্তমান `permission` মান অনুযায়ী বাস্তব সীমানা (একটি টেবিলে):

| Agent | `read` | `edit` | `external_directory` | `bash` | উপসংহার |
| :-- | :-- | :-- | :-- | :-- | :-- |
| `LocalReader` | `read.* = allow` (যার মধ্যে `*.env`) | `ask` | `ask` | `ask` | workspace সরাসরি পড়তে পারে; workspace-এর বাইরে অ্যাক্সেসে নিশ্চিতকরণ দরকার |
| `LocalScribe` | `read.* = allow` (যার মধ্যে `*.env`) | `* = allow`, `*../* = deny` | `allow` | `* = allow`, ঝুঁকিপূর্ণ pattern `ask` | গ্লোবাল রিড অনুমতি; সাধারণত workspace-এ writable |
| `OmniReader` | `read.* = allow` (যার মধ্যে `*.env`) | `ask` | `allow` | `ask` | গ্লোবাল রিড; লিখতে নিশ্চিতকরণ দরকার |
| `OmniScribe` | `* = allow` (যার মধ্যে `read`) | `* = allow` | `allow` | `* = allow`, ঝুঁকিপূর্ণ pattern `ask` | গ্লোবাল read/write |

`LocalScribe`-কে “সাধারণত workspace writable” বলা হয় কারণ path traversal `*../* = deny` দিয়ে ব্লক করা। কঠোর workspace-only write চাইলে `external_directory`-কে `ask` বা `deny` করুন।

নিষ্ক্রিয় built-ins:

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

### 3.2 LocalScribe (ডিফল্ট)

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

## 4. Provider ও model catalog কাঠামো

তিনটি provider:

- `my_claude` (`@ai-sdk/anthropic`)
- `my_gemini` (`@ai-sdk/google`)
- `my_oai` (`@ai-sdk/openai`)

Provider কাঠামো:

1. provider metadata: `name`, `npm`
2. provider connection options: `options.baseURL`, `options.apiKey`, `options.setCacheKey` (সাধারণত OpenAI-compatible provider-এ ব্যবহৃত)
3. `models` map: প্রতিটি model-এর জন্য একটি object

### 4.1 সাধারণ model JSON কাঠামো

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

### 4.2 model ফিল্ড রেফারেন্স

| Field | Type | অর্থ |
| :-- | :-- | :-- |
| `name` | `string` | প্রদর্শন নাম |
| `attachment` | `boolean` | attachments সক্রিয় কি না |
| `limit.context` | `number` | মোট context window |
| `limit.output` | `number` | সর্বোচ্চ output tokens |
| `modalities.input` | `string[]` | input modalities, যেমন `text/image/pdf` |
| `modalities.output` | `string[]` | output modalities, সাধারণত `text` |
| `options.store` | `boolean` | request storage toggle (বর্তমানে OAI-family মডেলে `false`) |
| `options.include` | `string[]` | অতিরিক্ত returned fields (যেমন `reasoning.encrypted_content`) |
| `variants` | `object` | per-model reasoning profiles |

### 4.3 provider অনুযায়ী `variants` প্যাটার্ন

`my_claude`:

```json
"variants": {
  "off": { "thinking": { "type": "disabled" } },
  "high": { "thinking": { "type": "enabled", "budgetTokens": 16000 } },
  "max": { "thinking": { "type": "enabled", "budgetTokens": 128000 } }
}
```

`my_gemini`:

```json
"variants": {
  "off": { "thinkingConfig": { "thinkingBudget": 0 } },
  "high": { "thinkingConfig": { "includeThoughts": true, "thinkingBudget": 16000 } },
  "max": { "thinkingConfig": { "includeThoughts": true, "thinkingBudget": 24576 } }
}
```

`my_oai`:

```json
"variants": {
  "low": { "reasoningEffort": "low", "reasoningSummary": "auto", "textVerbosity": "medium" },
  "medium": { "reasoningEffort": "medium", "reasoningSummary": "auto", "textVerbosity": "medium" },
  "high": { "reasoningEffort": "high", "reasoningSummary": "auto", "textVerbosity": "medium" },
  "minimal": { "reasoningEffort": "minimal", "reasoningSummary": "auto", "textVerbosity": "low" }
}
```

### 4.4 provider-লেভেল option ফিল্ড

সাধারণ `provider.<id>.options` ফিল্ড:

| Field | Type | অর্থ |
| :-- | :-- | :-- |
| `apiKey` | `string` | provider API key |
| `baseURL` | `string` | provider gateway URL |
| `setCacheKey` | `boolean` | OpenAI-compatible provider-এর cache-key আচরণ |

## 5. প্লাগিন লোডিং

Plugin কনফিগ:

```json
"plugin": [
  "opencode-planpilot",
  "opencode-workbench"
]
```

### 5.1 opencode-planpilot (npm)

- npm: [opencode-planpilot](https://www.npmjs.com/package/opencode-planpilot)
- প্যাকেজ বিবরণ: `Planpilot plugin for OpenCode`
- মূল সক্ষমতা:
  - জটিল কাজকে `plan -> step -> goal` এ ভাগ করে।
  - পরবর্তী ধাপ `ai`-কে অ্যাসাইন থাকলে auto-continue করে।
  - লোকাল প্রগ্রেস স্থায়ীভাবে সংরক্ষণ করে (database + Markdown snapshot)।
  - প্রাকৃতিক ভাষার ট্রিগার ফ্লো সমর্থন করে (যেমন, "use planpilot")।

### 5.2 opencode-workbench (npm)

- npm: [opencode-workbench](https://www.npmjs.com/package/opencode-workbench)
- প্যাকেজ বিবরণ: `Branch sandboxes for parallel OpenCode development`
- মূল সক্ষমতা:
  - `git worktree`-কে OpenCode session-এর সাথে map করে parallel routing করে।
  - supervisor/worker orchestration দিয়ে সমান্তরাল কাজ পরিচালনা করে।
  - branch, fork ও PR metadata multi-task delivery-এর জন্য ট্র্যাক করে।
  - ঐচ্ছিক version pinning (যেমন, `opencode-workbench@0.3.2`)।

## 6. পূর্ণ কনফিগ উদাহরণ

নিচে production-ধরনের একটি ব্যবহারযোগ্য পূর্ণ উদাহরণ (JSONC):

```jsonc
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
  "plugin": [
    "opencode-planpilot",
    "opencode-workbench"
  ],
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
            "low": { "reasoningEffort": "low", "reasoningSummary": "auto", "textVerbosity": "medium" },
            "medium": { "reasoningEffort": "medium", "reasoningSummary": "auto", "textVerbosity": "medium" },
            "high": { "reasoningEffort": "high", "reasoningSummary": "auto", "textVerbosity": "medium" }
          }
        }
      }
    }
  }
}
```

এই সেটআপ ব্যক্তি ও টিম—দুই ক্ষেত্রেই ভালো কাজ করে: read/write সীমা স্পষ্ট থাকে, model আচরণ স্থির থাকে, এবং plugin-ভিত্তিক workflow সহজে সম্প্রসারণযোগ্য হয়।
