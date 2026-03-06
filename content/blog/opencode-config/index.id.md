+++
authors = ["canxin"]
title = "Berbagi Konfigurasi OpenCode: Agent Berlapis, Permission, dan Contoh Lengkap"
description = "Berbagi konfigurasi OpenCode yang praktis, mencakup pelapisan agent, model provider, dan contoh konfigurasi penuh."
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

## 1. Urutan merge dan prioritas

Prioritas (rendah -> tinggi):

1. Remote `.well-known/opencode`
2. Global `~/.config/opencode/opencode.json`
3. `OPENCODE_CONFIG`
4. Project `opencode.json`
5. `.opencode` directories
6. `OPENCODE_CONFIG_CONTENT`

Rekomendasi: simpan default yang tahan lama di global; simpan aturan khusus repo di masing-masing repository.

## 2. Field konfigurasi tingkat atas

Field inti tingkat atas:

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

Catatan field:

- `"$schema"`: validasi dan autocomplete di editor.
- `default_agent`: default harian yang stabil (`LocalScribe`).
- `model` dan `small_model`: model yang sama agar perilaku konsisten.
- `autoupdate = false`: ritme upgrade yang lebih terkontrol.
- `compaction.auto/prune`: menjaga sesi panjang tetap mudah dikelola.

## 3. Desain agent berlapis

Batas nyata berdasarkan nilai `permission` saat ini (satu tabel):

| Agent | `read` | `edit` | `external_directory` | `bash` | Kesimpulan |
| :-- | :-- | :-- | :-- | :-- | :-- |
| `LocalReader` | `read.* = allow` (termasuk `*.env`) | `ask` | `ask` | `ask` | baca workspace langsung; akses di luar workspace perlu konfirmasi |
| `LocalScribe` | `read.* = allow` (termasuk `*.env`) | `* = allow`, `*../* = deny` | `allow` | `* = allow`, pola berbahaya bernilai `ask` | bisa dibaca global, umumnya bisa menulis di workspace |
| `OmniReader` | `read.* = allow` (termasuk `*.env`) | `ask` | `allow` | `ask` | bisa dibaca global; penulisan perlu konfirmasi |
| `OmniScribe` | `* = allow` (termasuk `read`) | `* = allow` | `allow` | `* = allow`, pola berbahaya bernilai `ask` | baca/tulis global |

`LocalScribe` disebut “umumnya bisa menulis di workspace” karena traversal diblokir oleh `*../* = deny`. Untuk benar-benar membatasi tulis hanya di workspace, set `external_directory` ke `ask` atau `deny`.

Built-in yang dinonaktifkan:

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


## 4. Struktur katalog provider dan model

Tiga provider:

- `my_claude` (`@ai-sdk/anthropic`)
- `my_gemini` (`@ai-sdk/google`)
- `my_oai` (`@ai-sdk/openai`)

Struktur provider:

1. metadata provider: `name`, `npm`
2. opsi koneksi provider: `options.baseURL`, `options.apiKey`, `options.setCacheKey` (umum dipakai untuk provider kompatibel OpenAI)
3. map `models`: satu objek untuk tiap model

### 4.1 Struktur JSON model yang umum

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

### 4.2 Referensi field model

| Field | Type | Arti |
| :-- | :-- | :-- |
| `name` | `string` | nama tampilan |
| `attachment` | `boolean` | apakah lampiran diaktifkan |
| `limit.context` | `number` | total jendela konteks |
| `limit.output` | `number` | token output maksimum |
| `modalities.input` | `string[]` | modalitas input, misalnya `text/image/pdf` |
| `modalities.output` | `string[]` | modalitas output, biasanya `text` |
| `options.store` | `boolean` | toggle penyimpanan request (saat ini `false` untuk model keluarga OAI) |
| `options.include` | `string[]` | field tambahan yang dikembalikan (saat ini dipakai untuk `reasoning.encrypted_content`) |
| `variants` | `object` | profil reasoning per model |

### 4.3 Pola `variants` per provider

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

### 4.4 Field opsi tingkat provider

Field `provider.<id>.options` yang umum:

| Field | Type | Arti |
| :-- | :-- | :-- |
| `apiKey` | `string` | API key provider |
| `baseURL` | `string` | URL gateway provider |
| `setCacheKey` | `boolean` | perilaku cache-key untuk provider kompatibel OpenAI |

## 5. Memuat plugin

Konfigurasi plugin:

```json
"plugin": [
  "opencode-planpilot",
  "opencode-workbench"
]
```

### 5.1 opencode-planpilot (npm)

- npm: [opencode-planpilot](https://www.npmjs.com/package/opencode-planpilot)
- Deskripsi paket: `Planpilot plugin for OpenCode`
- Kemampuan utama:
  - Memecah pekerjaan kompleks menjadi `plan -> step -> goal`.
  - Lanjut otomatis saat langkah berikutnya ditugaskan ke `ai`.
  - Menyimpan progres secara lokal (database + snapshot Markdown).
  - Mendukung alur pemicu bahasa alami (contohnya, "use planpilot").

### 5.2 opencode-workbench (npm)

- npm: [opencode-workbench](https://www.npmjs.com/package/opencode-workbench)
- Deskripsi paket: `Branch sandboxes for parallel OpenCode development`
- Kemampuan utama:
  - Memetakan `git worktree` ke sesi OpenCode untuk routing paralel.
  - Mendukung orkestrasi supervisor/worker untuk tugas bersamaan.
  - Melacak metadata branch, fork, dan PR untuk delivery multi-tugas.
  - Mendukung version pinning opsional (contohnya, `opencode-workbench@0.3.2`).

## 6. Konfigurasi lengkap

Konten lengkap:

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
