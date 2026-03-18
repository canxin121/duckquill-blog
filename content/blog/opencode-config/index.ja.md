+++
authors = ["canxin"]
title = "OpenCode 設定共有：デフォルト Agent、プラグイン、Provider"
description = "現在のグローバル設定を簡潔に整理: default_agent、モデルルーティング、プラグイン機能、provider ゲートウェイ構成。"
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

## 1. 現在の設定

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

## 2. マージ優先順位

OpenCode の優先順位（低 -> 高）:

1. Remote `.well-known/opencode`
2. Global `~/.config/opencode/opencode.json`
3. `OPENCODE_CONFIG`
4. Project `opencode.json`
5. `.opencode` ディレクトリ（agents/commands/plugins）
6. `OPENCODE_CONFIG_CONTENT`

グローバル設定は、`default_agent`、`model`、`small_model`、共通 provider / plugin など長期的な既定値に向いている。

## 3. トップレベル項目

| 項目 | 現在値 | 役割 | メモ |
| :-- | :-- | :-- | :-- |
| `$schema` | `https://opencode.ai/config.json` | JSON 検証と補完 | 有効化推奨 |
| `autoupdate` | `false` | 自動更新を無効化 | 安定運用向け |
| `compaction.auto` | `true` | 長いセッションを自動圧縮 | 推奨 |
| `compaction.prune` | `true` | 古いツール出力を剪定 | コンテキスト肥大を抑制 |
| `default_agent` | `cx-local` | 既定 agent | プラグイン提供（0.2.0 以降推奨） |
| `model` | `openai/gpt-5.3-codex` | 主モデル | メイン処理 |
| `small_model` | `openai/gpt-5.1-codex-mini` | 軽量モデル | 補助処理 / コスト最適化 |
| `plugin[]` | npm プラグイン 4 つ | 機能拡張 | マシン間再利用が容易 |
| `provider.*.options` | `baseURL + apiKey` | 接続設定 | 環境変数を利用 |

## 4. `default_agent = cx-local` の由来

`cx-local` は [`opencode-cx-agents`](https://github.com/canxin121/opencode-cx-agents) プラグインで登録される。ローカル設定に手書きの `agent` 定義は不要。

現在の canonical agents は `cx-explore`、`cx-local`、`cx-global`。

影響:

1. グローバル設定を短く保てる。
2. プラグイン読み込み失敗時は既定 agent が登録されない。

## 5. プラグイン構成（重点）

### 5.1 プラグイン一覧（npm 名称）

```json
"plugin": [
  "opencode-planpilot",
  "opencode-workbench",
  "opencode-web-preview",
  "opencode-cx-agents"
]
```

GitHub リポジトリ:

- [`opencode-planpilot`](https://github.com/canxin121/opencode-planpilot)
- [`opencode-workbench`](https://github.com/canxin121/opencode-workbench)
- [`opencode-web-preview`](https://github.com/canxin121/opencode-web-preview)
- [`opencode-cx-agents`](https://github.com/canxin121/opencode-cx-agents)

### 5.2 [`opencode-planpilot`](https://github.com/canxin121/opencode-planpilot)

**役割**：複雑タスクの構造化実行。  
**主要機能**：

- 共通モデル `plan -> step -> goal`
- `ai / human` 実行者の分離
- 次ステップ実行者が `ai` の場合に自動継続

**適用例**：段階的に進む長期タスクの進捗管理。

### 5.3 [`opencode-workbench`](https://github.com/canxin121/opencode-workbench)

**役割**：branch/worktree ベースの並行編成。  
**主要機能**：

- セッションと worktree の明示的バインド
- worktree 単位のタスクルーティング
- branch / task 文脈の追跡

**適用例**：同一リポジトリでの並行開発。

### 5.4 [`opencode-web-preview`](https://github.com/canxin121/opencode-web-preview)

**役割**：ローカル front-end プレビュー管理。  
**主要機能**：

- 利用可能なプレビューセッション検出
- ローカル preview host の起動/停止
- プレビュー状態の確認

**適用例**：UI 変更の高速検証。

### 5.5 [`opencode-cx-agents`](https://github.com/canxin121/opencode-cx-agents)

**役割**：再利用可能な preset agent と権限ベースラインを提供。  
**主要機能**：

- canonical agents: `cx-explore`、`cx-local`、`cx-global`
- 書き込み権限プロファイル:
  - `cx-local`: ワークスペース優先、`external_directory: ask`
  - `cx-global`: ディレクトリ横断書き込み、`external_directory: allow`
- [`opencode-planpilot`](https://github.com/canxin121/opencode-planpilot)、[`opencode-workbench`](https://github.com/canxin121/opencode-workbench)、[`opencode-web-preview`](https://github.com/canxin121/opencode-web-preview) と併用してもツール可視性を維持

**適用例**：複数リポジトリで統一した agent 方針を運用しつつ、リスクに応じて書き込み権限を選択。

### 5.6 利用の推奨

1. 既定値は `default_agent = cx-local` を推奨。
2. ディレクトリ横断の自動書き込みが必要な場合のみ `cx-global` を使用。
3. 起動後に `cx-explore / cx-local / cx-global` が見えていることを確認。

## 6. Provider とモデルルーティング

現在の provider 構成は「単一 gateway ドメイン + provider 別ルート」。

| Provider | baseURL | 説明 |
| :-- | :-- | :-- |
| `anthropic` | `https://gateway.example.com/v1` | Anthropic 互換ルート |
| `google` | `https://gateway.example.com/v1beta` | Gemini 互換ルート |
| `openai` | `https://gateway.example.com/v1` | OpenAI 互換ルート |
