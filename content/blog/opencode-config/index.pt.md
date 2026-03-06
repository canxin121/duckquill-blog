+++
authors = ["canxin"]
title = "Compartilhando Config do OpenCode: Agentes em Camadas, Permissoes e Exemplo Completo"
description = "Um compartilhamento pratico de configuracao do OpenCode cobrindo camadas de agentes, modelos de provider e uma configuracao completa de referencia."
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

## 1. Ordem de merge e precedencia

Precedencia (baixo -> alto):

1. Remote `.well-known/opencode`
2. Global `~/.config/opencode/opencode.json`
3. `OPENCODE_CONFIG`
4. Project `opencode.json`
5. Diretorios `.opencode`
6. `OPENCODE_CONFIG_CONTENT`

Recomendacao: mantenha defaults duraveis no global; mantenha regras especificas por repositorio.

## 2. Campos de configuracao no topo

Campos principais de nivel superior:

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

Notas de campo:

- `"$schema"`: validacao e autocomplete no editor.
- `default_agent`: padrao estavel do dia a dia (`LocalScribe`).
- `model` e `small_model`: mesmo modelo para consistencia de comportamento.
- `autoupdate = false`: ritmo de upgrade controlado.
- `compaction.auto/prune`: mantem sessoes longas gerenciaveis.

## 3. Design em camadas de agentes

Limites reais com base nos valores atuais de `permission` (tabela unica):

| Agente | `read` | `edit` | `external_directory` | `bash` | Conclusao |
| :-- | :-- | :-- | :-- | :-- | :-- |
| `LocalReader` | `read.* = allow` (inclui `*.env`) | `ask` | `ask` | `ask` | leitura direta no workspace; fora do workspace exige confirmacao |
| `LocalScribe` | `read.* = allow` (inclui `*.env`) | `* = allow`, `*../* = deny` | `allow` | `* = allow`, padroes perigosos sao `ask` | leitura global; escrita tipicamente no workspace |
| `OmniReader` | `read.* = allow` (inclui `*.env`) | `ask` | `allow` | `ask` | leitura global; escrita exige confirmacao |
| `OmniScribe` | `* = allow` (inclui `read`) | `* = allow` | `allow` | `* = allow`, padroes perigosos sao `ask` | leitura/escrita global |

`LocalScribe` e "tipicamente gravavel no workspace" porque traversal e bloqueado por `*../* = deny`. Para escrita estritamente dentro do workspace, ajuste `external_directory` para `ask` ou `deny`.

Built-ins desativados:

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

### 3.2 LocalScribe (padrao)

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

## 4. Estrutura de providers e catalogo de modelos

Tres providers:

- `my_claude` (`@ai-sdk/anthropic`)
- `my_gemini` (`@ai-sdk/google`)
- `my_oai` (`@ai-sdk/openai`)

Estrutura de provider:

1. metadados: `name`, `npm`
2. opcoes de conexao: `options.baseURL`, `options.apiKey`, `options.setCacheKey`
3. mapa `models`: um objeto por modelo

### 4.1 Estrutura JSON comum de modelo

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

### 4.2 Referencia de campos de modelo

| Campo | Tipo | Significado |
| :-- | :-- | :-- |
| `name` | `string` | nome de exibicao |
| `attachment` | `boolean` | se anexos estao habilitados |
| `limit.context` | `number` | janela total de contexto |
| `limit.output` | `number` | maximo de tokens de saida |
| `modalities.input` | `string[]` | modalidades de entrada, ex.: `text/image/pdf` |
| `modalities.output` | `string[]` | modalidades de saida, geralmente `text` |
| `options.store` | `boolean` | toggle de armazenamento da requisicao |
| `options.include` | `string[]` | campos extras retornados |
| `variants` | `object` | perfis de raciocinio por modelo |

## 5. Carregamento de plugins

Configuracao de plugins:

```json
"plugin": [
  "opencode-planpilot",
  "opencode-workbench"
]
```

### 5.1 opencode-planpilot (npm)

- npm: [opencode-planpilot](https://www.npmjs.com/package/opencode-planpilot)
- Descricao do pacote: `Planpilot plugin for OpenCode`
- Capacidades principais:
  - Quebra trabalhos complexos em `plan -> step -> goal`.
  - Continua automaticamente quando o proximo passo pertence a `ai`.
  - Persiste progresso localmente (banco + snapshot Markdown).
  - Suporta fluxos disparados por linguagem natural (por exemplo, "use planpilot").

### 5.2 opencode-workbench (npm)

- npm: [opencode-workbench](https://www.npmjs.com/package/opencode-workbench)
- Descricao do pacote: `Branch sandboxes for parallel OpenCode development`
- Capacidades principais:
  - Mapeia `git worktree` para sessoes OpenCode com roteamento paralelo.
  - Suporta orquestracao supervisor/worker para tarefas concorrentes.
  - Rastreia metadados de branch, fork e PR para entrega multi-tarefa.
  - Pinagem de versao opcional (por exemplo, `opencode-workbench@0.3.2`).

## 6. Config completa (referencia)

Para evitar duplicacao enorme nesta versao localizada, recomendo usar o mesmo bloco JSONC completo da versao em ingles e manter apenas os textos explicativos traduzidos neste artigo.

Link direto: [English](@/blog/opencode-config/index.en.md)
