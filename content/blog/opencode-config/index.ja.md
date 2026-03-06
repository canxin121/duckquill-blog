+++
authors = ["canxin"]
title = "OpenCode 設定共有: 多層エージェント、権限、完全サンプル"
description = "エージェントのレイヤリング、プロバイダーモデル、完全な設定例を含む実践的な OpenCode 設定共有です。"
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

## 1. マージ順序と優先順位

優先順位（低 -> 高）:

1. Remote `.well-known/opencode`
2. Global `~/.config/opencode/opencode.json`
3. `OPENCODE_CONFIG`
4. Project `opencode.json`
5. `.opencode` directories
6. `OPENCODE_CONFIG_CONTENT`

推奨: 長期的に使うデフォルトはグローバルに置き、リポジトリ固有のルールは各リポジトリ側に置きます。

## 2. トップレベル設定フィールド

トップレベルの主要フィールド:

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

フィールド解説:

- `"$schema"`: エディタでの検証と補完に使います。
- `default_agent`: 日常運用の安定したデフォルト（`LocalScribe`）。
- `model` と `small_model`: 挙動の一貫性を保つため同一モデルを指定。
- `autoupdate = false`: 更新タイミングを制御しやすくします。
- `compaction.auto/prune`: 長いセッションでも扱いやすく保ちます。

## 3. 多層エージェント設計

現在の `permission` 値から見た実際の境界（単一テーブル）:

| Agent | `read` | `edit` | `external_directory` | `bash` | 結論 |
| :-- | :-- | :-- | :-- | :-- | :-- |
| `LocalReader` | `read.* = allow`（`*.env` 含む） | `ask` | `ask` | `ask` | ワークスペース内は直接読み取り可能、外部は確認が必要 |
| `LocalScribe` | `read.* = allow`（`*.env` 含む） | `* = allow`, `*../* = deny` | `allow` | `* = allow`、危険パターンは `ask` | グローバルに読めて、通常はワークスペース内へ書き込み可能 |
| `OmniReader` | `read.* = allow`（`*.env` 含む） | `ask` | `allow` | `ask` | グローバル読み取り可、書き込みは確認が必要 |
| `OmniScribe` | `* = allow`（`read` 含む） | `* = allow` | `allow` | `* = allow`、危険パターンは `ask` | グローバル読み書き可能 |

`LocalScribe` が「通常はワークスペース書き込み可能」とされるのは、`*../* = deny` によりトラバーサルが遮断されるためです。厳密にワークスペース限定にしたい場合は、`external_directory` を `ask` または `deny` に設定します。

無効化している組み込みエージェント:

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


## 4. プロバイダーとモデルカタログの構造

プロバイダーは 3 つです:

- `my_claude` (`@ai-sdk/anthropic`)
- `my_gemini` (`@ai-sdk/google`)
- `my_oai` (`@ai-sdk/openai`)

プロバイダー構造:

1. プロバイダーメタデータ: `name`, `npm`
2. 接続オプション: `options.baseURL`, `options.apiKey`, `options.setCacheKey`（OpenAI 互換プロバイダーでよく利用）
3. `models` マップ: モデルごとに 1 オブジェクト

### 4.1 共通のモデル JSON 構造

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

### 4.2 モデルフィールド一覧

| Field | Type | 意味 |
| :-- | :-- | :-- |
| `name` | `string` | 表示名 |
| `attachment` | `boolean` | 添付を有効化するか |
| `limit.context` | `number` | コンテキストウィンドウ総量 |
| `limit.output` | `number` | 出力トークン上限 |
| `modalities.input` | `string[]` | 入力モダリティ（例: `text/image/pdf`） |
| `modalities.output` | `string[]` | 出力モダリティ（通常は `text`） |
| `options.store` | `boolean` | リクエスト保存の切替（現在 OAI 系は `false`） |
| `options.include` | `string[]` | 追加返却フィールド（現在は `reasoning.encrypted_content` で利用） |
| `variants` | `object` | モデルごとの推論プロファイル |

### 4.3 プロバイダー別 `variants` パターン

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

### 4.4 プロバイダーレベルのオプション項目

代表的な `provider.<id>.options` フィールド:

| Field | Type | 意味 |
| :-- | :-- | :-- |
| `apiKey` | `string` | プロバイダー API キー |
| `baseURL` | `string` | プロバイダーのゲートウェイ URL |
| `setCacheKey` | `boolean` | OpenAI 互換プロバイダーでのキャッシュキー動作 |

## 5. プラグイン読み込み

プラグイン設定:

```json
"plugin": [
  "opencode-planpilot",
  "opencode-workbench"
]
```

### 5.1 opencode-planpilot (npm)

- npm: [opencode-planpilot](https://www.npmjs.com/package/opencode-planpilot)
- パッケージ説明: `Planpilot plugin for OpenCode`
- 主な機能:
  - 複雑な作業を `plan -> step -> goal` に分解。
  - 次のステップが `ai` 担当なら自動で継続。
  - 進捗をローカルに永続化（DB + Markdown スナップショット）。
  - 自然言語トリガー（例: "use planpilot"）をサポート。

### 5.2 opencode-workbench (npm)

- npm: [opencode-workbench](https://www.npmjs.com/package/opencode-workbench)
- パッケージ説明: `Branch sandboxes for parallel OpenCode development`
- 主な機能:
  - `git worktree` と OpenCode セッションを対応付け、並列ルーティングを実現。
  - supervisor/worker 方式で並行タスクをオーケストレーション。
  - マルチタスク配信向けに branch・fork・PR メタデータを追跡。
  - 任意のバージョン固定（例: `opencode-workbench@0.3.2`）に対応。

## 6. 完全設定

全文:

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
