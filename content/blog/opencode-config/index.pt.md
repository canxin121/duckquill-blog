+++
authors = ["canxin"]
title = "Compartilhamento de Config OpenCode: Agent Padrao, Plugins e Providers"
description = "Resumo da configuracao global atual: default_agent, roteamento de modelos, capacidades de plugins e arquitetura de gateway de providers."
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

## 1. Configuracao atual

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

## 2. Precedencia de merge

Precedencia do OpenCode (baixo -> alto):

1. Remote `.well-known/opencode`
2. Global `~/.config/opencode/opencode.json`
3. `OPENCODE_CONFIG`
4. Project `opencode.json`
5. Diretorios `.opencode` (agents/commands/plugins)
6. `OPENCODE_CONFIG_CONTENT`

A camada global e ideal para defaults duraveis: `default_agent`, `model`, `small_model`, providers e plugins compartilhados.

## 3. Campos top-level

| Campo | Valor atual | Funcao | Nota |
| :-- | :-- | :-- | :-- |
| `$schema` | `https://opencode.ai/config.json` | Validacao JSON e autocomplete | Manter ativo |
| `autoupdate` | `false` | Desliga atualizacao automatica | Fluxo orientado a estabilidade |
| `compaction.auto` | `true` | Compacta sessoes longas automaticamente | Recomendado |
| `compaction.prune` | `true` | Remove saida antiga de ferramentas | Reduz crescimento de contexto |
| `default_agent` | `cx-omni` | Agent padrao | Fornecido por plugin |
| `model` | `openai/gpt-5.3-codex` | Modelo principal | Caminho principal |
| `small_model` | `openai/gpt-5.1-codex-mini` | Modelo leve | Caminho auxiliar / custo |
| `plugin[]` | 4 plugins npm | Extensao de capacidades | Facil de reutilizar entre maquinas |
| `provider.*.options` | `baseURL + apiKey` | Parametros de conexao | Usa variaveis de ambiente |

## 4. Origem de `default_agent = cx-omni`

`cx-omni` e registrado pelo plugin `opencode-cx-agents`, sem necessidade de bloco `agent` manual no arquivo local.

Efeitos:

1. Config global mais enxuta.
2. Se o carregamento do plugin falhar, `cx-omni` nao e registrado.

## 5. Stack de plugins (foco)

### 5.1 Lista de plugins (nomes npm)

```json
"plugin": [
  "opencode-planpilot",
  "opencode-workbench",
  "opencode-web-preview",
  "opencode-cx-agents"
]
```

### 5.2 `opencode-planpilot`

**Papel**: execucao estruturada de tarefas complexas.  
**Capacidades principais**:

- modelo unificado: `plan -> step -> goal`
- separacao explicita de executor `ai / human`
- auto-continue quando o proximo executor e `ai`

**Uso tipico**: tarefas longas em multiplas etapas.

### 5.3 `opencode-workbench`

**Papel**: orquestracao paralela com branch/worktree.  
**Capacidades principais**:

- vinculo explicito entre sessao e worktree
- roteamento por worktree para paralelismo
- rastreabilidade de contexto de branch/tarefa

**Uso tipico**: multiplas frentes de trabalho no mesmo repositorio.

### 5.4 `opencode-web-preview`

**Papel**: gerenciamento de preview local de frontend.  
**Capacidades principais**:

- descoberta de sessoes de preview
- start/stop de hosts de preview locais
- verificacao de status de preview

**Uso tipico**: validacao rapida de alteracoes de UI.

### 5.5 `opencode-cx-agents`

**Papel**: fornece agents predefinidos (incluindo `cx-omni`).  
**Capacidades principais**:

- baseline unificada de nomenclatura e comportamento
- menos repeticao de definicoes por projeto

**Uso tipico**: padronizar estrategia de agents entre repositorios.

## 6. Providers e roteamento de modelo

Layout atual: um dominio de gateway com rotas separadas por provider.

| Provider | baseURL | Observacao |
| :-- | :-- | :-- |
| `anthropic` | `https://gateway.example.com/v1` | Rota compativel com Anthropic |
| `google` | `https://gateway.example.com/v1beta` | Rota compativel com Gemini |
| `openai` | `https://gateway.example.com/v1` | Rota compativel com OpenAI |
