+++
authors = ["canxin"]
title = "Berbagi Konfigurasi OpenCode: Default Agent, Plugin, dan Provider"
description = "Ringkasan konfigurasi global saat ini: default_agent, routing model, kapabilitas plugin, dan susunan gateway provider."
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

## 1. Konfigurasi saat ini

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

## 2. Prioritas merge

Prioritas OpenCode (rendah -> tinggi):

1. Remote `.well-known/opencode`
2. Global `~/.config/opencode/opencode.json`
3. `OPENCODE_CONFIG`
4. Project `opencode.json`
5. Direktori `.opencode` (agents/commands/plugins)
6. `OPENCODE_CONFIG_CONTENT`

Layer global cocok untuk default jangka panjang: `default_agent`, `model`, `small_model`, provider umum, dan plugin umum.

## 3. Field top-level

| Field | Nilai saat ini | Fungsi | Catatan |
| :-- | :-- | :-- | :-- |
| `$schema` | `https://opencode.ai/config.json` | Validasi JSON + autocomplete | Disarankan tetap ada |
| `autoupdate` | `false` | Menonaktifkan update otomatis | Cocok untuk stabilitas |
| `compaction.auto` | `true` | Kompresi otomatis sesi panjang | Direkomendasikan |
| `compaction.prune` | `true` | Memangkas output tool lama | Mengurangi bloat konteks |
| `default_agent` | `cx-local` | Agent default | Disediakan plugin (direkomendasikan sejak 0.2.0) |
| `model` | `openai/gpt-5.3-codex` | Model utama | Jalur utama |
| `small_model` | `openai/gpt-5.1-codex-mini` | Model ringan | Jalur bantu / biaya |
| `plugin[]` | 4 plugin npm | Ekstensi kemampuan | Mudah dipakai lintas mesin |
| `provider.*.options` | `baseURL + apiKey` | Parameter koneksi provider | Pakai env var |

## 4. Sumber `default_agent = cx-local`

`cx-local` diregistrasikan oleh plugin [`opencode-cx-agents`](https://github.com/canxin121/opencode-cx-agents), bukan ditulis manual dalam blok `agent` lokal.

Plugin ini saat ini menyediakan canonical agents: `cx-explore`, `cx-local`, `cx-global`.

Dampak:

1. Konfigurasi global lebih ringkas.
2. Jika plugin gagal dimuat, agent default tidak terdaftar.

## 5. Susunan plugin (fokus)

### 5.1 Daftar plugin (nama npm)

```json
"plugin": [
  "opencode-planpilot",
  "opencode-workbench",
  "opencode-web-preview",
  "opencode-cx-agents"
]
```

Repositori GitHub:

- [`opencode-planpilot`](https://github.com/canxin121/opencode-planpilot)
- [`opencode-workbench`](https://github.com/canxin121/opencode-workbench)
- [`opencode-web-preview`](https://github.com/canxin121/opencode-web-preview)
- [`opencode-cx-agents`](https://github.com/canxin121/opencode-cx-agents)

### 5.2 [`opencode-planpilot`](https://github.com/canxin121/opencode-planpilot)

**Peran**: eksekusi terstruktur untuk tugas kompleks.  
**Kemampuan inti**:

- model kerja seragam: `plan -> step -> goal`
- pemisahan executor `ai / human`
- auto-continue jika executor langkah berikutnya `ai`

**Cocok untuk**: pekerjaan bertahap dengan kebutuhan pelacakan progres.

### 5.3 [`opencode-workbench`](https://github.com/canxin121/opencode-workbench)

**Peran**: orkestrasi paralel berbasis branch/worktree.  
**Kemampuan inti**:

- binding eksplisit sesi ke worktree
- routing tugas per worktree untuk paralelisme
- jejak konteks branch/tugas

**Cocok untuk**: menjalankan beberapa task paralel di repo yang sama.

### 5.4 [`opencode-web-preview`](https://github.com/canxin121/opencode-web-preview)

**Peran**: pengelolaan sesi preview frontend lokal.  
**Kemampuan inti**:

- menemukan sesi preview yang tersedia
- start/stop preview host lokal
- memeriksa status preview

**Cocok untuk**: validasi cepat perubahan UI.

### 5.5 [`opencode-cx-agents`](https://github.com/canxin121/opencode-cx-agents)

**Peran**: menyediakan preset agent reusable dan baseline permission.  
**Kemampuan inti**:

- canonical agents: `cx-explore`, `cx-local`, `cx-global`
- tier permission untuk menulis:
  - `cx-local`: workspace-first, `external_directory: ask`
  - `cx-global`: menulis lintas direktori, `external_directory: allow`
- tetap kompatibel dengan [`opencode-planpilot`](https://github.com/canxin121/opencode-planpilot), [`opencode-workbench`](https://github.com/canxin121/opencode-workbench), dan [`opencode-web-preview`](https://github.com/canxin121/opencode-web-preview) sambil menjaga visibilitas tools

**Cocok untuk**: strategi agent yang konsisten lintas repository dengan pilihan default write berbasis risiko.

### 5.6 Saran penggunaan

1. Gunakan `default_agent = cx-local` sebagai default yang aman.
2. Beralih ke `cx-global` hanya saat benar-benar perlu menulis lintas direktori.
3. Setelah startup, pastikan `cx-explore / cx-local / cx-global` terlihat.

## 6. Provider dan routing model

Susunan provider saat ini: satu domain gateway, rute dipisah per provider.

| Provider | baseURL | Keterangan |
| :-- | :-- | :-- |
| `anthropic` | `https://gateway.example.com/v1` | Rute kompatibel Anthropic |
| `google` | `https://gateway.example.com/v1beta` | Rute kompatibel Gemini |
| `openai` | `https://gateway.example.com/v1` | Rute kompatibel OpenAI |
