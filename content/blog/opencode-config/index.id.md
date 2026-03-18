+++
authors = ["canxin"]
title = "Berbagi Konfigurasi OpenCode: Default Agent, Plugin, dan Provider"
description = "Ringkasan konfigurasi global saat ini: default_agent, routing model, kapabilitas plugin, dan susunan gateway provider."
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
| `default_agent` | `cx-omni` | Agent default | Disediakan plugin |
| `model` | `openai/gpt-5.3-codex` | Model utama | Jalur utama |
| `small_model` | `openai/gpt-5.1-codex-mini` | Model ringan | Jalur bantu / biaya |
| `plugin[]` | 4 plugin npm | Ekstensi kemampuan | Mudah dipakai lintas mesin |
| `provider.*.options` | `baseURL + apiKey` | Parameter koneksi provider | Pakai env var |

## 4. Sumber `default_agent = cx-omni`

`cx-omni` diregistrasikan oleh plugin `opencode-cx-agents`, bukan ditulis manual dalam blok `agent` lokal.

Dampak:

1. Konfigurasi global lebih ringkas.
2. Jika plugin gagal dimuat, `cx-omni` tidak terdaftar.

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

### 5.2 `opencode-planpilot`

**Peran**: eksekusi terstruktur untuk tugas kompleks.  
**Kemampuan inti**:

- model kerja seragam: `plan -> step -> goal`
- pemisahan executor `ai / human`
- auto-continue jika executor langkah berikutnya `ai`

**Cocok untuk**: pekerjaan bertahap dengan kebutuhan pelacakan progres.

### 5.3 `opencode-workbench`

**Peran**: orkestrasi paralel berbasis branch/worktree.  
**Kemampuan inti**:

- binding eksplisit sesi ke worktree
- routing tugas per worktree untuk paralelisme
- jejak konteks branch/tugas

**Cocok untuk**: menjalankan beberapa task paralel di repo yang sama.

### 5.4 `opencode-web-preview`

**Peran**: pengelolaan sesi preview frontend lokal.  
**Kemampuan inti**:

- menemukan sesi preview yang tersedia
- start/stop preview host lokal
- memeriksa status preview

**Cocok untuk**: validasi cepat perubahan UI.

### 5.5 `opencode-cx-agents`

**Peran**: menyediakan preset agent (termasuk `cx-omni`).  
**Kemampuan inti**:

- baseline penamaan dan perilaku agent yang konsisten
- mengurangi duplikasi definisi agent per proyek

**Cocok untuk**: menjaga strategi agent yang seragam lintas repository.

## 6. Provider dan routing model

Susunan provider saat ini: satu domain gateway, rute dipisah per provider.

| Provider | baseURL | Keterangan |
| :-- | :-- | :-- |
| `anthropic` | `https://gateway.example.com/v1` | Rute kompatibel Anthropic |
| `google` | `https://gateway.example.com/v1beta` | Rute kompatibel Gemini |
| `openai` | `https://gateway.example.com/v1` | Rute kompatibel OpenAI |
