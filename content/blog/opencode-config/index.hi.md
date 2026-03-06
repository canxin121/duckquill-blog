+++
authors = ["canxin"]
title = "OpenCode कॉन्फिग शेयर: लेयर्ड एजेंट्स, परमिशन और पूरा उदाहरण"
description = "OpenCode कॉन्फिग का एक व्यावहारिक शेयर, जिसमें agent layering, provider models और पूर्ण उदाहरण शामिल हैं।"
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

## 1. मर्ज क्रम और प्राथमिकता

प्राथमिकता (निम्न -> उच्च):

1. Remote `.well-known/opencode`
2. Global `~/.config/opencode/opencode.json`
3. `OPENCODE_CONFIG`
4. Project `opencode.json`
5. `.opencode` directories
6. `OPENCODE_CONFIG_CONTENT`

सिफारिश: टिकाऊ डिफॉल्ट्स को global रखें; repo-विशिष्ट नियम प्रत्येक repository में रखें।

## 2. टॉप-लेवल कॉन्फिग फील्ड्स

टॉप-लेवल मुख्य फील्ड्स:

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

फील्ड नोट्स:

- `"$schema"`: एडिटर में validation और autocomplete.
- `default_agent`: रोज़मर्रा के उपयोग के लिए स्थिर डिफॉल्ट (`LocalScribe`).
- `model` और `small_model`: व्यवहार में स्थिरता के लिए समान मॉडल।
- `autoupdate = false`: नियंत्रित अपग्रेड चक्र।
- `compaction.auto/prune`: लंबे सेशन को संभालने योग्य रखता है।

## 3. लेयर्ड एजेंट डिज़ाइन

वर्तमान `permission` मानों से वास्तविक सीमाएं (एकल तालिका):

| Agent | `read` | `edit` | `external_directory` | `bash` | निष्कर्ष |
| :-- | :-- | :-- | :-- | :-- | :-- |
| `LocalReader` | `read.* = allow` (जिसमें `*.env`) | `ask` | `ask` | `ask` | वर्कस्पेस को सीधे पढ़ सकता है; वर्कस्पेस के बाहर पहुंच के लिए पुष्टि चाहिए |
| `LocalScribe` | `read.* = allow` (जिसमें `*.env`) | `* = allow`, `*../* = deny` | `allow` | `* = allow`, खतरनाक पैटर्न `ask` | वैश्विक पढ़ने की अनुमति; सामान्यतः वर्कस्पेस में लिखने योग्य |
| `OmniReader` | `read.* = allow` (जिसमें `*.env`) | `ask` | `allow` | `ask` | वैश्विक पढ़ाई; लिखने के लिए पुष्टि चाहिए |
| `OmniScribe` | `* = allow` (जिसमें `read`) | `* = allow` | `allow` | `* = allow`, खतरनाक पैटर्न `ask` | वैश्विक पढ़ना/लिखना |

`LocalScribe` को “आमतौर पर वर्कस्पेस में writable” कहा जाता है क्योंकि path traversal `*../* = deny` से अवरुद्ध है। यदि सख्त workspace-only writes चाहिए, तो `external_directory` को `ask` या `deny` पर सेट करें।

निष्क्रिय built-ins:

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

### 3.2 LocalScribe (डिफॉल्ट)

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

## 4. Provider और model catalog संरचना

तीन providers:

- `my_claude` (`@ai-sdk/anthropic`)
- `my_gemini` (`@ai-sdk/google`)
- `my_oai` (`@ai-sdk/openai`)

Provider संरचना:

1. provider metadata: `name`, `npm`
2. provider connection options: `options.baseURL`, `options.apiKey`, `options.setCacheKey` (आमतौर पर OpenAI-compatible providers में)
3. `models` map: प्रत्येक मॉडल के लिए एक ऑब्जेक्ट

### 4.1 सामान्य model JSON संरचना

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

### 4.2 मॉडल फील्ड संदर्भ

| Field | Type | अर्थ |
| :-- | :-- | :-- |
| `name` | `string` | प्रदर्शन नाम |
| `attachment` | `boolean` | attachments सक्षम हैं या नहीं |
| `limit.context` | `number` | कुल context window |
| `limit.output` | `number` | अधिकतम output tokens |
| `modalities.input` | `string[]` | input modalities, जैसे `text/image/pdf` |
| `modalities.output` | `string[]` | output modalities, आमतौर पर `text` |
| `options.store` | `boolean` | request storage toggle (वर्तमान में OAI-family के लिए `false`) |
| `options.include` | `string[]` | अतिरिक्त return fields (जैसे `reasoning.encrypted_content`) |
| `variants` | `object` | प्रति-मॉडल reasoning profiles |

### 4.3 provider के अनुसार `variants` पैटर्न

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

### 4.4 provider-स्तरीय option फील्ड्स

सामान्य `provider.<id>.options` फील्ड्स:

| Field | Type | अर्थ |
| :-- | :-- | :-- |
| `apiKey` | `string` | provider API key |
| `baseURL` | `string` | provider gateway URL |
| `setCacheKey` | `boolean` | OpenAI-compatible providers के लिए cache-key व्यवहार |

## 5. प्लगइन लोडिंग

Plugin कॉन्फिग:

```json
"plugin": [
  "opencode-planpilot",
  "opencode-workbench"
]
```

### 5.1 opencode-planpilot (npm)

- npm: [opencode-planpilot](https://www.npmjs.com/package/opencode-planpilot)
- पैकेज विवरण: `Planpilot plugin for OpenCode`
- मुख्य क्षमताएं:
  - जटिल कार्य को `plan -> step -> goal` में विभाजित करता है।
  - जब अगला step `ai` को सौंपा हो तो auto-continue करता है।
  - लोकल प्रोग्रेस स्थायी रूप से रखता है (database + Markdown snapshot)।
  - प्राकृतिक भाषा ट्रिगर फ्लो का समर्थन करता है (जैसे "use planpilot")।

### 5.2 opencode-workbench (npm)

- npm: [opencode-workbench](https://www.npmjs.com/package/opencode-workbench)
- पैकेज विवरण: `Branch sandboxes for parallel OpenCode development`
- मुख्य क्षमताएं:
  - `git worktree` को OpenCode sessions से map करता है, ताकि parallel routing हो सके।
  - supervisor/worker orchestration के साथ समांतर कार्य निष्पादन को सपोर्ट करता है।
  - branch, fork, और PR metadata को multi-task delivery के लिए ट्रैक करता है।
  - वैकल्पिक version pinning (उदाहरण: `opencode-workbench@0.3.2`)।

## 6. पूर्ण कॉन्फिग उदाहरण

नीचे production शैली का एक व्यावहारिक पूर्ण उदाहरण दिया गया है (JSONC):

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

यह सेटअप टीम और व्यक्तिगत दोनों परिदृश्यों में अच्छा काम करता है: पढ़ने/लिखने की सीमाएं स्पष्ट रहती हैं, मॉडल व्यवहार सुसंगत रहता है, और प्लगइन-आधारित workflow विस्तार करना आसान होता है।
