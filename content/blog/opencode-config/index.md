+++
authors = ["canxin"]
title = "OpenCode 配置分享：分层 Agent、权限策略与完整示例"
description = "分享一套实际使用的 OpenCode 配置，覆盖 agent 分层、provider 模型与完整配置。"
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

## 1. 配置加载顺序与覆盖规则

优先级（低 -> 高）：

1. 远程 `.well-known/opencode`
2. 全局 `~/.config/opencode/opencode.json`
3. `OPENCODE_CONFIG`
4. 项目 `opencode.json`
5. `.opencode` 目录（agents/commands/plugins 等）
6. `OPENCODE_CONFIG_CONTENT`

建议：全局放长期偏好，项目放项目特有规则。

## 2. 顶层配置（Top-level）写法

顶层核心字段：

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

字段说明：

- `"$schema"`：让编辑器获得 JSON 校验和补全能力。
- `default_agent`：默认使用 `LocalScribe`，即“可写、但带安全限制”的主工作代理。
- `model` / `small_model`：统一到同一个模型，优先行为一致性。
- `autoupdate = false`：避免自动升级导致行为变化，升级时手动控制。
- `compaction.auto + prune`：长会话自动压缩并裁剪旧工具输出，减少上下文溢出。

## 3. Agent 分层设计与完整写法

按当前 `permission` 的实际边界（单表）：

| Agent | `read` | `edit` | `external_directory` | `bash` | 结论 |
| :-- | :-- | :-- | :-- | :-- | :-- |
| `LocalReader` | `read.* = allow`（含 `*.env`） | `ask` | `ask` | `ask` | 工作区内读取直通；外部目录读写都需确认 |
| `LocalScribe` | `read.* = allow`（含 `*.env`） | `* = allow`，`*../* = deny` | `allow` | `* = allow`，高危命令 `ask` | 全局可读，常规局部可写 |
| `OmniReader` | `read.* = allow`（含 `*.env`） | `ask` | `allow` | `ask` | 全局可读；写入需要确认 |
| `OmniScribe` | `* = allow`（含 `read`） | `* = allow` | `allow` | `* = allow`，高危命令 `ask` | 全局读写 |

`LocalScribe` 的“局部可写”来自 `edit` 的越界拦截规则（`*../* = deny`）。如果要严格限制为“仅工作区可写”，把 `external_directory` 改为 `ask` 或 `deny`。

禁用内置代理：

```json
"agent": {
  "build": { "disable": true },
  "docs": { "disable": true },
  "plan": { "disable": true }
}
```

### 3.1 LocalReader（只读优先）

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

### 3.2 LocalScribe（默认写作代理）

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

### 3.3 OmniReader（跨目录只读）

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

### 3.4 OmniScribe（跨目录全写）

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


## 4. Provider 与模型目录的写法

当前写了三个 provider：

- `my_claude`（`@ai-sdk/anthropic`）
- `my_gemini`（`@ai-sdk/google`）
- `my_oai`（`@ai-sdk/openai`）

provider 结构：

1. provider 元信息：`name`、`npm`
2. provider 连接参数：`options.baseURL`、`options.apiKey`、`options.setCacheKey`（OpenAI 兼容常用）
3. `models` 字典：每个模型一个对象

### 4.1 模型对象通用 JSON 写法

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

### 4.2 每个模型字段参数说明

| 字段 | 类型 | 含义 |
| :-- | :-- | :-- |
| `name` | `string` | 模型展示名 |
| `attachment` | `boolean` | 是否允许附件输入 |
| `limit.context` | `number` | 总上下文上限 |
| `limit.output` | `number` | 输出 token 上限 |
| `modalities.input` | `string[]` | 输入模态，如 `text/image/pdf` |
| `modalities.output` | `string[]` | 输出模态，通常为 `text` |
| `options.store` | `boolean` | 是否存储请求（当前 OAI 系列为 `false`） |
| `options.include` | `string[]` | 额外返回字段（当前 OAI 用于 `reasoning.encrypted_content`） |
| `variants` | `object` | 同模型不同推理档位配置 |

### 4.3 不同 provider 的 `variants` 参数写法

`my_claude`：

```json
"variants": {
  "off": { "thinking": { "type": "disabled" } },
  "high": { "thinking": { "type": "enabled", "budgetTokens": 16000 } },
  "max": { "thinking": { "type": "enabled", "budgetTokens": 128000 } }
}
```

`my_gemini`：

```json
"variants": {
  "off": { "thinkingConfig": { "thinkingBudget": 0 } },
  "high": { "thinkingConfig": { "includeThoughts": true, "thinkingBudget": 16000 } },
  "max": { "thinkingConfig": { "includeThoughts": true, "thinkingBudget": 24576 } }
}
```

`my_oai`：

```json
"variants": {
  "low": { "reasoningEffort": "low", "reasoningSummary": "auto", "textVerbosity": "medium" },
  "medium": { "reasoningEffort": "medium", "reasoningSummary": "auto", "textVerbosity": "medium" },
  "high": { "reasoningEffort": "high", "reasoningSummary": "auto", "textVerbosity": "medium" },
  "minimal": { "reasoningEffort": "minimal", "reasoningSummary": "auto", "textVerbosity": "low" }
}
```

### 4.4 provider 层参数写法

`provider.<id>.options` 常用字段：

| 字段 | 类型 | 含义 |
| :-- | :-- | :-- |
| `apiKey` | `string` | 提供商密钥 |
| `baseURL` | `string` | 提供商网关地址 |
| `setCacheKey` | `boolean` | OpenAI 兼容提供商缓存键控制 |

## 5. plugin 字段写法

插件配置：

```json
"plugin": [
  "opencode-planpilot",
  "opencode-workbench"
]
```

### 5.1 opencode-planpilot（npm）

- npm: [opencode-planpilot](https://www.npmjs.com/package/opencode-planpilot)
- 包描述：`Planpilot plugin for OpenCode`
- 核心能力：
  - 把复杂任务拆为 `plan -> step -> goal`。
  - 当下一步归属 `ai` 时自动续跑。
  - 本地持久化计划状态（数据库 + Markdown 快照）。
  - 支持自然语言触发（如“使用 planpilot”）。

### 5.2 opencode-workbench（npm）

- npm: [opencode-workbench](https://www.npmjs.com/package/opencode-workbench)
- 包描述：`Branch sandboxes for parallel OpenCode development`
- 核心能力：
  - 将 `git worktree` 映射到 OpenCode 会话，实现并发任务路由。
  - 支持 supervisor/worker 并行编排，降低多任务串线风险。
  - 绑定并记录分支、fork、PR 元数据，便于并行协作交付。
  - 可选版本锁定（例如 `opencode-workbench@0.3.2`）。

## 6. 完整配置

完整内容如下：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "LocalReader": {
      "description": "Read-first agent; asks for non-read actions",
      "mode": "all",
      "permission": {
        "*": "ask",
        "bash": "ask",
        "codesearch": "allow",
        "doom_loop": "ask",
        "edit": "ask",
        "external_directory": "ask",
        "glob": "allow",
        "grep": "allow",
        "list": "allow",
        "lsp": "allow",
        "plan_enter": "deny",
        "plan_exit": "deny",
        "planpilot": "allow",
        "question": "allow",
        "read": {
          "*": "allow",
          "*.env": "allow",
          "*.env.*": "allow"
        },
        "skill": "ask",
        "task": "ask",
        "todoread": "deny",
        "todowrite": "deny",
        "webfetch": "allow",
        "websearch": "allow"
      }
    },
    "LocalScribe": {
      "description": "Reads any path; writes only inside workspace",
      "mode": "all",
      "permission": {
        "*": "allow",
        "bash": {
          "*": "allow",
          "dd *": "ask",
          "doas *": "ask",
          "mkfs* *": "ask",
          "poweroff *": "ask",
          "reboot *": "ask",
          "rm -fr *": "ask",
          "rm -rf *": "ask",
          "shutdown *": "ask",
          "su *": "ask",
          "sudo *": "ask"
        },
        "codesearch": "allow",
        "doom_loop": "ask",
        "edit": {
          "*": "allow",
          "*../*": "deny"
        },
        "external_directory": "allow",
        "glob": "allow",
        "grep": "allow",
        "list": "allow",
        "lsp": "allow",
        "plan_enter": "deny",
        "plan_exit": "deny",
        "planpilot": "allow",
        "question": "allow",
        "read": {
          "*": "allow",
          "*.env": "allow",
          "*.env.*": "allow"
        },
        "skill": "allow",
        "task": "allow",
        "todoread": "deny",
        "todowrite": "deny",
        "webfetch": "allow",
        "websearch": "allow"
      }
    },
    "OmniReader": {
      "description": "Read-first agent for all paths; asks for non-read actions",
      "mode": "all",
      "permission": {
        "*": "ask",
        "bash": "ask",
        "codesearch": "allow",
        "doom_loop": "ask",
        "edit": "ask",
        "external_directory": "allow",
        "glob": "allow",
        "grep": "allow",
        "list": "allow",
        "lsp": "allow",
        "plan_enter": "deny",
        "plan_exit": "deny",
        "planpilot": "allow",
        "question": "allow",
        "read": {
          "*": "allow",
          "*.env": "allow",
          "*.env.*": "allow"
        },
        "skill": "ask",
        "task": "ask",
        "todoread": "deny",
        "todowrite": "deny",
        "webfetch": "allow",
        "websearch": "allow"
      }
    },
    "OmniScribe": {
      "description": "Dangerous full access read/write anywhere",
      "mode": "all",
      "permission": {
        "*": "allow",
        "bash": {
          "*": "allow",
          "dd *": "ask",
          "doas *": "ask",
          "mkfs* *": "ask",
          "poweroff *": "ask",
          "reboot *": "ask",
          "rm -fr *": "ask",
          "rm -rf *": "ask",
          "shutdown *": "ask",
          "su *": "ask",
          "sudo *": "ask"
        },
        "doom_loop": "ask",
        "external_directory": "allow",
        "plan_enter": "deny",
        "plan_exit": "deny",
        "planpilot": "allow",
        "todoread": "deny",
        "todowrite": "deny"
      }
    },
    "build": {
      "disable": true
    },
    "docs": {
      "disable": true
    },
    "plan": {
      "disable": true
    }
  },
  "autoupdate": false,
  "compaction": {
    "auto": true,
    "prune": true
  },
  "default_agent": "LocalScribe",
  "model": "my_oai/gpt-5.3-codex",
  "plugin": [
    "opencode-planpilot",
    "opencode-workbench"
  ],
  "provider": {
    "my_claude": {
      "models": {
        "claude-3-5-haiku-20241022": {
          "attachment": true,
          "limit": {
            "context": 128000,
            "output": 8192
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "claude-3-5-haiku-20241022",
          "variants": {
            "off": {
              "thinking": {
                "type": "disabled"
              }
            }
          }
        },
        "claude-3-7-sonnet-20250219": {
          "attachment": true,
          "limit": {
            "context": 128000,
            "output": 8192
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "claude-3-7-sonnet-20250219",
          "variants": {
            "high": {
              "thinking": {
                "budgetTokens": 16000,
                "type": "enabled"
              }
            },
            "max": {
              "thinking": {
                "budgetTokens": 128000,
                "type": "enabled"
              }
            },
            "off": {
              "thinking": {
                "type": "disabled"
              }
            }
          }
        },
        "claude-haiku-4-5-20251001": {
          "attachment": true,
          "limit": {
            "context": 200000,
            "output": 64000
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "claude-haiku-4-5-20251001",
          "variants": {
            "high": {
              "thinking": {
                "budgetTokens": 16000,
                "type": "enabled"
              }
            },
            "max": {
              "thinking": {
                "budgetTokens": 128000,
                "type": "enabled"
              }
            },
            "off": {
              "thinking": {
                "type": "disabled"
              }
            }
          }
        },
        "claude-opus-4-1-20250805": {
          "attachment": true,
          "limit": {
            "context": 200000,
            "output": 32000
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "claude-opus-4-1-20250805",
          "variants": {
            "high": {
              "thinking": {
                "budgetTokens": 16000,
                "type": "enabled"
              }
            },
            "max": {
              "thinking": {
                "budgetTokens": 128000,
                "type": "enabled"
              }
            },
            "off": {
              "thinking": {
                "type": "disabled"
              }
            }
          }
        },
        "claude-opus-4-20250514": {
          "attachment": true,
          "limit": {
            "context": 200000,
            "output": 32000
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "claude-opus-4-20250514",
          "variants": {
            "high": {
              "thinking": {
                "budgetTokens": 16000,
                "type": "enabled"
              }
            },
            "max": {
              "thinking": {
                "budgetTokens": 128000,
                "type": "enabled"
              }
            },
            "off": {
              "thinking": {
                "type": "disabled"
              }
            }
          }
        },
        "claude-opus-4-5-20251101": {
          "attachment": true,
          "limit": {
            "context": 200000,
            "output": 64000
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "claude-opus-4-5-20251101",
          "variants": {
            "high": {
              "thinking": {
                "budgetTokens": 16000,
                "type": "enabled"
              }
            },
            "max": {
              "thinking": {
                "budgetTokens": 128000,
                "type": "enabled"
              }
            },
            "off": {
              "thinking": {
                "type": "disabled"
              }
            }
          }
        },
        "claude-opus-4-6": {
          "attachment": true,
          "limit": {
            "context": 1000000,
            "output": 128000
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "claude-opus-4-6",
          "variants": {
            "high": {
              "thinking": {
                "budgetTokens": 16000,
                "type": "enabled"
              }
            },
            "max": {
              "thinking": {
                "budgetTokens": 128000,
                "type": "enabled"
              }
            },
            "off": {
              "thinking": {
                "type": "disabled"
              }
            }
          }
        },
        "claude-sonnet-4-20250514": {
          "attachment": true,
          "limit": {
            "context": 200000,
            "output": 64000
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "claude-sonnet-4-20250514",
          "variants": {
            "high": {
              "thinking": {
                "budgetTokens": 16000,
                "type": "enabled"
              }
            },
            "max": {
              "thinking": {
                "budgetTokens": 128000,
                "type": "enabled"
              }
            },
            "off": {
              "thinking": {
                "type": "disabled"
              }
            }
          }
        },
        "claude-sonnet-4-5-20250929": {
          "attachment": true,
          "limit": {
            "context": 200000,
            "output": 64000
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "claude-sonnet-4-5-20250929",
          "variants": {
            "high": {
              "thinking": {
                "budgetTokens": 16000,
                "type": "enabled"
              }
            },
            "max": {
              "thinking": {
                "budgetTokens": 128000,
                "type": "enabled"
              }
            },
            "off": {
              "thinking": {
                "type": "disabled"
              }
            }
          }
        },
        "gemini-claude-opus-4-5-thinking": {
          "attachment": true,
          "limit": {
            "context": 200000,
            "output": 64000
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gemini-claude-opus-4-5-thinking",
          "variants": {
            "high": {
              "thinking": {
                "budgetTokens": 16000,
                "type": "enabled"
              }
            },
            "max": {
              "thinking": {
                "budgetTokens": 128000,
                "type": "enabled"
              }
            },
            "off": {
              "thinking": {
                "type": "disabled"
              }
            }
          }
        },
        "gemini-claude-sonnet-4-5": {
          "attachment": true,
          "limit": {
            "context": 200000,
            "output": 64000
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gemini-claude-sonnet-4-5",
          "variants": {
            "high": {
              "thinking": {
                "budgetTokens": 16000,
                "type": "enabled"
              }
            },
            "max": {
              "thinking": {
                "budgetTokens": 128000,
                "type": "enabled"
              }
            },
            "off": {
              "thinking": {
                "type": "disabled"
              }
            }
          }
        },
        "gemini-claude-sonnet-4-5-thinking": {
          "attachment": true,
          "limit": {
            "context": 200000,
            "output": 64000
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gemini-claude-sonnet-4-5-thinking",
          "variants": {
            "high": {
              "thinking": {
                "budgetTokens": 16000,
                "type": "enabled"
              }
            },
            "max": {
              "thinking": {
                "budgetTokens": 128000,
                "type": "enabled"
              }
            },
            "off": {
              "thinking": {
                "type": "disabled"
              }
            }
          }
        }
      },
      "name": "my_claude",
      "npm": "@ai-sdk/anthropic",
      "options": {
        "apiKey": "{env:CLAUDE_API_KEY}",
        "baseURL": "https://your-gateway.example/v1"
      }
    },
    "my_gemini": {
      "models": {
        "gemini-2.5-flash": {
          "attachment": true,
          "limit": {
            "context": 1048576,
            "output": 65536
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "audio",
              "video",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gemini-2.5-flash",
          "variants": {
            "high": {
              "thinkingConfig": {
                "includeThoughts": true,
                "thinkingBudget": 16000
              }
            },
            "max": {
              "thinkingConfig": {
                "includeThoughts": true,
                "thinkingBudget": 24576
              }
            },
            "off": {
              "thinkingConfig": {
                "thinkingBudget": 0
              }
            }
          }
        },
        "gemini-2.5-flash-lite": {
          "attachment": true,
          "limit": {
            "context": 1048576,
            "output": 65536
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "audio",
              "video",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gemini-2.5-flash-lite",
          "variants": {
            "high": {
              "thinkingConfig": {
                "includeThoughts": true,
                "thinkingBudget": 16000
              }
            },
            "max": {
              "thinkingConfig": {
                "includeThoughts": true,
                "thinkingBudget": 24576
              }
            },
            "off": {
              "thinkingConfig": {
                "thinkingBudget": 0
              }
            }
          }
        },
        "gemini-2.5-pro": {
          "attachment": true,
          "limit": {
            "context": 1048576,
            "output": 65536
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "audio",
              "video",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gemini-2.5-pro",
          "variants": {
            "high": {
              "thinkingConfig": {
                "includeThoughts": true,
                "thinkingBudget": 16000
              }
            },
            "max": {
              "thinkingConfig": {
                "includeThoughts": true,
                "thinkingBudget": 32768
              }
            },
            "off": {
              "thinkingConfig": {
                "thinkingBudget": 128
              }
            }
          }
        },
        "gemini-3-flash-preview": {
          "attachment": true,
          "limit": {
            "context": 1048576,
            "output": 65536
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "video",
              "audio",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gemini-3-flash-preview",
          "variants": {
            "high": {
              "includeThoughts": true,
              "thinkingLevel": "high"
            },
            "low": {
              "includeThoughts": true,
              "thinkingLevel": "low"
            },
            "off": {
              "includeThoughts": false,
              "thinkingLevel": "minimal"
            }
          }
        },
        "gemini-3-pro-image-preview": {
          "attachment": true,
          "limit": {
            "context": 1048576,
            "output": 65536
          },
          "modalities": {
            "input": [
              "text",
              "image"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gemini-3-pro-image-preview",
          "variants": {
            "high": {
              "includeThoughts": true,
              "thinkingLevel": "high"
            },
            "low": {
              "includeThoughts": true,
              "thinkingLevel": "low"
            },
            "off": {
              "includeThoughts": false,
              "thinkingLevel": "low"
            }
          }
        },
        "gemini-3-pro-preview": {
          "attachment": true,
          "limit": {
            "context": 1048576,
            "output": 65536
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "video",
              "audio",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gemini-3-pro-preview",
          "variants": {
            "high": {
              "includeThoughts": true,
              "thinkingLevel": "high"
            },
            "low": {
              "includeThoughts": true,
              "thinkingLevel": "low"
            },
            "off": {
              "includeThoughts": false,
              "thinkingLevel": "low"
            }
          }
        }
      },
      "name": "my_gemini",
      "npm": "@ai-sdk/google",
      "options": {
        "apiKey": "{env:GEMINI_API_KEY}",
        "baseURL": "https://your-gateway.example/v1beta"
      }
    },
    "my_oai": {
      "models": {
        "gpt-5": {
          "attachment": true,
          "limit": {
            "context": 400000,
            "output": 128000
          },
          "modalities": {
            "input": [
              "text",
              "image"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gpt-5",
          "options": {
            "include": [
              "reasoning.encrypted_content"
            ],
            "store": false
          },
          "variants": {
            "high": {
              "reasoningEffort": "high",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "low": {
              "reasoningEffort": "low",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "medium": {
              "reasoningEffort": "medium",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "minimal": {
              "reasoningEffort": "minimal",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            }
          }
        },
        "gpt-5-codex": {
          "attachment": false,
          "limit": {
            "context": 400000,
            "output": 128000
          },
          "modalities": {
            "input": [
              "text",
              "image"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gpt-5-codex",
          "options": {
            "include": [
              "reasoning.encrypted_content"
            ],
            "store": false
          },
          "variants": {
            "high": {
              "reasoningEffort": "high",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "low": {
              "reasoningEffort": "low",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "medium": {
              "reasoningEffort": "medium",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            }
          }
        },
        "gpt-5-codex-mini": {
          "attachment": false,
          "limit": {
            "context": 400000,
            "output": 128000
          },
          "modalities": {
            "input": [
              "text",
              "image"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gpt-5-codex-mini",
          "options": {
            "include": [
              "reasoning.encrypted_content"
            ],
            "store": false
          },
          "variants": {
            "high": {
              "reasoningEffort": "high",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "low": {
              "reasoningEffort": "low",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "medium": {
              "reasoningEffort": "medium",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            }
          }
        },
        "gpt-5.1": {
          "attachment": true,
          "limit": {
            "context": 400000,
            "output": 128000
          },
          "modalities": {
            "input": [
              "text",
              "image"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gpt-5.1",
          "options": {
            "include": [
              "reasoning.encrypted_content"
            ],
            "store": false
          },
          "variants": {
            "high": {
              "reasoningEffort": "high",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "low": {
              "reasoningEffort": "low",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "medium": {
              "reasoningEffort": "medium",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "none": {
              "reasoningEffort": "none",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            }
          }
        },
        "gpt-5.1-codex": {
          "attachment": true,
          "limit": {
            "context": 400000,
            "output": 128000
          },
          "modalities": {
            "input": [
              "text",
              "image"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gpt-5.1-codex",
          "options": {
            "include": [
              "reasoning.encrypted_content"
            ],
            "store": false
          },
          "variants": {
            "high": {
              "reasoningEffort": "high",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "low": {
              "reasoningEffort": "low",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "medium": {
              "reasoningEffort": "medium",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            }
          }
        },
        "gpt-5.1-codex-max": {
          "attachment": true,
          "limit": {
            "context": 400000,
            "output": 128000
          },
          "modalities": {
            "input": [
              "text",
              "image"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gpt-5.1-codex-max",
          "options": {
            "include": [
              "reasoning.encrypted_content"
            ],
            "store": false
          },
          "variants": {
            "high": {
              "reasoningEffort": "high",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "low": {
              "reasoningEffort": "low",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "medium": {
              "reasoningEffort": "medium",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "xhigh": {
              "reasoningEffort": "xhigh",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            }
          }
        },
        "gpt-5.1-codex-mini": {
          "attachment": true,
          "limit": {
            "context": 400000,
            "output": 128000
          },
          "modalities": {
            "input": [
              "text",
              "image"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gpt-5.1-codex-mini",
          "options": {
            "include": [
              "reasoning.encrypted_content"
            ],
            "store": false
          },
          "variants": {
            "high": {
              "reasoningEffort": "high",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "low": {
              "reasoningEffort": "low",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "medium": {
              "reasoningEffort": "medium",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            }
          }
        },
        "gpt-5.2": {
          "attachment": true,
          "limit": {
            "context": 400000,
            "output": 128000
          },
          "modalities": {
            "input": [
              "text",
              "image"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gpt-5.2",
          "options": {
            "include": [
              "reasoning.encrypted_content"
            ],
            "store": false
          },
          "variants": {
            "high": {
              "reasoningEffort": "high",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "low": {
              "reasoningEffort": "low",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "medium": {
              "reasoningEffort": "medium",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "none": {
              "reasoningEffort": "none",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "xhigh": {
              "reasoningEffort": "xhigh",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            }
          }
        },
        "gpt-5.2-codex": {
          "attachment": true,
          "limit": {
            "context": 400000,
            "output": 128000
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gpt-5.2-codex",
          "options": {
            "include": [
              "reasoning.encrypted_content"
            ],
            "store": false
          },
          "variants": {
            "high": {
              "reasoningEffort": "high",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "low": {
              "reasoningEffort": "low",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "medium": {
              "reasoningEffort": "medium",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "xhigh": {
              "reasoningEffort": "xhigh",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            }
          }
        },
        "gpt-5.3-codex": {
          "attachment": true,
          "limit": {
            "context": 400000,
            "output": 128000
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gpt-5.3-codex",
          "options": {
            "include": [
              "reasoning.encrypted_content"
            ],
            "store": false
          },
          "variants": {
            "high": {
              "reasoningEffort": "high",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "low": {
              "reasoningEffort": "low",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "medium": {
              "reasoningEffort": "medium",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "xhigh": {
              "reasoningEffort": "xhigh",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            }
          }
        },
        "gpt-5.3-codex-spark": {
          "attachment": true,
          "limit": {
            "context": 128000,
            "output": 32000
          },
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "name": "gpt-5.3-codex-spark",
          "options": {
            "include": [
              "reasoning.encrypted_content"
            ],
            "store": false
          },
          "variants": {
            "high": {
              "reasoningEffort": "high",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "low": {
              "reasoningEffort": "low",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "medium": {
              "reasoningEffort": "medium",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            },
            "xhigh": {
              "reasoningEffort": "xhigh",
              "reasoningSummary": "auto",
              "textVerbosity": "medium"
            }
          }
        }
      },
      "name": "my_oai",
      "npm": "@ai-sdk/openai",
      "options": {
        "apiKey": "{env:OAI_API_KEY}",
        "baseURL": "https://your-gateway.example/v1",
        "setCacheKey": true
      }
    }
  },
  "small_model": "my_oai/gpt-5.3-codex"
}
```
