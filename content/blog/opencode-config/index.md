+++
authors = ["canxin"]
title = "OpenCode 配置分享：默认 Agent、插件与 Provider"
description = "围绕当前全局配置说明 default_agent、模型路由、插件能力与 provider 网关。"
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

## 1. 当前配置

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

## 2. 配置加载优先级

OpenCode 配置优先级（低 -> 高）：

1. Remote `.well-known/opencode`
2. 全局 `~/.config/opencode/opencode.json`
3. `OPENCODE_CONFIG`
4. 项目 `opencode.json`
5. `.opencode` 目录（agents/commands/plugins 等）
6. `OPENCODE_CONFIG_CONTENT`

全局层适合放长期默认值：`default_agent`、`model`、`small_model`、通用 provider 与通用插件。

## 3. 顶层字段速览

| 字段 | 当前值 | 作用 | 说明 |
| :-- | :-- | :-- | :-- |
| `$schema` | `https://opencode.ai/config.json` | JSON 校验与补全 | 保留即可 |
| `autoupdate` | `false` | 关闭自动升级 | 适合稳定优先 |
| `compaction.auto` | `true` | 自动压缩长会话 | 建议开启 |
| `compaction.prune` | `true` | 裁剪历史工具输出 | 降低上下文膨胀 |
| `default_agent` | `cx-omni` | 默认 agent | 由插件提供 |
| `model` | `openai/gpt-5.3-codex` | 主模型 | 主链路调用 |
| `small_model` | `openai/gpt-5.1-codex-mini` | 轻量模型 | 辅助链路/降成本 |
| `plugin[]` | 4 个 npm 插件 | 功能扩展 | 跨机器更易复用 |
| `provider.*.options` | `baseURL + apiKey` | 提供商连接参数 | `apiKey` 使用环境变量 |

## 4. `default_agent = cx-omni` 的来源

`cx-omni` 由 `opencode-cx-agents` 插件注册，不在该配置中手写 `agent` 定义。

影响：

1. 全局配置更精简。
2. 插件加载失败时，`cx-omni` 不会注册。

## 5. 插件体系（重点）

### 5.1 插件清单（npm 名称）

```json
"plugin": [
  "opencode-planpilot",
  "opencode-workbench",
  "opencode-web-preview",
  "opencode-cx-agents"
]
```

### 5.2 `opencode-planpilot`

**定位**：结构化推进复杂任务。  
**核心能力**：

- 统一任务模型：`plan -> step -> goal`
- 支持 `ai / human` 执行者分离
- 下一步执行者为 `ai` 时可自动续跑

**适用场景**：长任务拆解、跨阶段改造、需要状态持续追踪的流程。

### 5.3 `opencode-workbench`

**定位**：多分支 / 多 worktree 并行编排。  
**核心能力**：

- 会话与 worktree 显式绑定，降低任务串线风险
- 按 worktree 路由任务，支持并行推进
- 记录分支与任务上下文，便于回溯

**适用场景**：同仓库并行处理多个任务、多人协作分支并发。

### 5.4 `opencode-web-preview`

**定位**：前端预览会话与本地预览链路管理。  
**核心能力**：

- 发现可用预览会话
- 启停本地预览 host
- 查询预览状态，便于回归验证

**适用场景**：需要快速验证 UI 或本地前端改动时。

### 5.5 `opencode-cx-agents`

**定位**：提供预设 agent（如 `cx-omni`）。  
**核心能力**：

- 统一 agent 命名与行为基线
- 降低每个项目重复定义 agent 的成本

**适用场景**：多仓库复用统一 agent 策略。

## 6. Provider 与模型路由

当前 provider 设计为“单网关域名 + 多路由入口”：

| Provider | baseURL | 说明 |
| :-- | :-- | :-- |
| `anthropic` | `https://gateway.example.com/v1` | Anthropic 兼容入口 |
| `google` | `https://gateway.example.com/v1beta` | Gemini 兼容入口 |
| `openai` | `https://gateway.example.com/v1` | OpenAI 兼容入口 |
