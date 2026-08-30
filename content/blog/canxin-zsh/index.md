+++
authors = ["canxin"]
title = "canxin-zsh：把一套不打扰现有配置的 zsh 环境带到每台机器"
description = "介绍 canxin-zsh 的定位、安装后的实际功能、跨平台依赖处理，以及它如何在保留已有 zsh 配置的前提下完成接入。"
date = 2026-08-30
updated = 2026-08-30
slug = "canxin-zsh"
[taxonomies]
tags = ["zsh", "macOS", "Linux", "Windows", "命令行工具", "开发工具"]
[extra]
toc = true
toc_inline = true
+++

> 项目地址：[canxin121/canxin-zsh](https://github.com/canxin121/canxin-zsh)
>
> 本文介绍项目的定位、安装后的使用体验和设计取舍。具体参数与最新平台支持情况请以仓库的 [README](https://github.com/canxin121/canxin-zsh/blob/main/README.md) 为准。

很多人第一次整理 zsh 配置时，都会遇到两个相反的问题：要么把一份 `.zshrc` 直接复制到每台机器上，最后和系统环境、已有插件互相冲突；要么每换一台电脑，就重新手动安装 zsh、Oh My Zsh、主题、插件和各种命令行工具。

`canxin-zsh` 想解决的是中间这件事：把一套可复用的 zsh 环境、默认工具和安装流程放在同一个仓库里，同时尽量尊重用户已经存在的配置。它可以在 macOS、Linux、WSL、MSYS2 和 Cygwin 中使用，并根据当前平台选择可用的包管理器。

## 这个仓库到底是什么

`canxin-zsh` 不只是几份 dotfiles，也不是一个会接管整台电脑的配置管理器。它由三部分组成：

- `home/.zshrc` 和 `home/.zprofile`：zsh 的入口配置；
- `zsh/rc/common.zsh`：alias、工具检测、历史记录、Oh My Zsh 接入和更新函数；
- `install.sh` 与 `install.ps1`：分别负责 POSIX shell 和 Windows PowerShell 场景的安装。

安装器会把仓库作为一个可更新的 source checkout 保存下来，再让用户的 zsh 配置加载它。这样做的好处是，仓库更新时不需要把一整份新的 `.zshrc` 覆盖到用户家目录里，也不会因为某一台机器的路径不同而失效。

## 安装以后能得到什么

普通全量安装、且原来的 zsh 配置为空时，得到的是一套可以直接工作的交互式 shell 环境。

### 更有信息量的 prompt

默认会安装并使用 [Powerlevel10k](https://github.com/romkatv/powerlevel10k)。提示符会展示当前目录、Git 分支和工作区状态，也会保留命令执行状态等有助于日常开发的信息。

如果用户已经选择了其他主题，或者家目录中已经有可读的 `.p10k.zsh`，安装器会优先保留用户自己的选择，不会强行换主题或覆盖 p10k 配置。

### Oh My Zsh 与常用插件

全新配置会使用 [Oh My Zsh](https://github.com/ohmyzsh/ohmyzsh)，并启用一组比较实用的基础插件：

- `git`：Git 命令别名和仓库提示；
- `colored-man-pages`：让 man 文档更容易阅读；
- `dirhistory`：使用快捷键浏览目录历史；
- `extract`：用统一命令解压常见压缩文件；
- `sudo`：快速为上一条命令补上 sudo。

此外还会准备以下插件：

- `zsh-completions`：补充更多命令的 Tab 补全；
- `fzf-tab`：把补全候选项接入交互式选择；
- `zsh-autosuggestions`：根据历史命令给出灰色建议；
- `zsh-history-substring-search`：按输入内容搜索历史；
- `zsh-syntax-highlighting`：对命令输入进行语法高亮。

### 历史记录和目录导航

在全新配置中，历史记录默认保留最多 50,000 条，并启用增量写入、跨 shell 共享和重复命令过滤。输入一部分命令后，按上下方向键可以在历史中搜索包含这段文字的命令。

目录操作也会启用一些适合交互式 shell 的选项：可以直接输入目录名进入目录，使用目录栈快速回到之前的位置，同时避免同一个目录被重复压入目录栈。

`Ctrl-E` 会调用 zsh 的 `edit-command-line`，用编辑器打开当前正在输入的命令，适合编辑比较长的命令或多行脚本。

### fzf 搜索工作流

如果系统中安装了 `fzf`，配置会自动把它接入文件搜索、目录切换和补全预览。`fd` 或 `fdfind` 存在时，fzf 会使用它们查找隐藏文件并排除 `.git`；如果没有，就退回系统自带的 `find`。

这意味着安装完成后，文件搜索、目录跳转和补全候选项都可以通过交互式筛选完成，而不必每次手写很长的 `find` 命令。没有安装 fzf 时，普通 Tab 补全和系统命令仍然可以正常使用。

### 一组实际可用的 alias

配置会根据当前机器上实际存在的命令自动选择 alias。下面这些命令是日常最容易用到的一组：

```zsh
l / ls       # 有 eza/exa 时增强目录列表，否则保留系统 ls
ll           # 详细列出文件、隐藏文件和 Git 状态
la           # 列出隐藏文件
lt           # 以树状形式列出目录
catp FILE    # 有 bat/batcat 时高亮并分页查看文件
grep TEXT    # 有 ripgrep 时使用 rg 搜索
top          # 有 btop 时启动 btop
lg            # 有 lazygit 时启动 lazygit
zreload      # 重新加载 zsh 配置
zupdate-all  # 更新 Oh My Zsh 和插件/主题 checkout
```

这些 alias 只会在同名 alias 或 function 尚不存在时定义。如果用户已经有自己的 `ls`、`grep` 或 `lg`，项目不会直接覆盖它们。

## 怎么安装

### macOS、Linux、WSL 和 MSYS2

在对应的终端执行：

```bash
curl -fsSL https://raw.githubusercontent.com/canxin121/canxin-zsh/main/install.sh | bash
```

安装器会自动检查并尝试补齐 zsh、Git、curl、CA 证书和默认命令行工具。远程命令本身需要当前环境已经有 `curl` 和 `bash`；如果需要先审查脚本，也可以 clone 后从本地运行：

```bash
git clone https://github.com/canxin121/canxin-zsh.git
cd canxin-zsh
./install.sh
```

### Windows PowerShell

原生 PowerShell 本身没有 zsh。已经安装 WSL、MSYS2 或 Cygwin 后，可以在 PowerShell 中使用项目提供的转发脚本：

```powershell
irm https://raw.githubusercontent.com/canxin121/canxin-zsh/main/install.ps1 | iex
```

它会优先使用 `wsl.exe`，其次使用 `bash.exe`。实际配置安装在哪个环境，取决于最终被调用的 WSL、MSYS2 或 Cygwin。这个命令不会自动安装 WSL，也不能让单独的 Git Bash 变成 zsh。

安装完成后，重新打开终端，或执行：

```bash
exec zsh
```

## 依赖会怎么处理

这个项目不希望用户安装完后才发现一半功能因为缺命令而失效，所以普通安装会默认尝试准备下面这些内容。

### 基础运行依赖

- `zsh`：实际运行 shell；
- `git`：下载仓库、Oh My Zsh、主题和插件；
- `curl`：远程安装与获取内容；
- CA 证书：确保 HTTPS 下载能够正常验证。

### 默认命令行工具集

默认工具集包括 `fzf`、`ripgrep`、`fd`、`eza`、`bat`、`btop`、`lazygit` 和 `tldr`。不同系统的可执行文件名和软件包名可能不同，例如：

| 作用 | 可能出现的命令 | 常见软件包名 |
| --- | --- | --- |
| 模糊搜索 | `fzf` | `fzf` |
| 文本搜索 | `rg` | `ripgrep` |
| 文件查找 | `fd` / `fdfind` | `fd` / `fd-find` |
| 目录列表 | `eza` / `exa` | `eza` |
| 文件查看 | `bat` / `batcat` | `bat` |
| 系统监控 | `btop` | `btop` |
| Git 终端界面 | `lazygit` | `lazygit` |
| 命令示例 | `tldr` | `tealdeer` |

工具集是普通安装的默认内容，不需要逐项选择。只有想要更轻量的安装时，才使用：

```bash
./install.sh --minimal
```

它会跳过默认工具集，但仍然尝试安装基础依赖。工具集中的单个软件包在某个发行版中不存在时，只会发出警告并继续；基础 shell 仍能工作。`zsh`、`git` 或 `curl` 这类必需命令在安装后仍缺失，则安装会停止。

安装器目前会识别 Homebrew、apt、dnf、yum、pacman、apk 和 zypper。macOS 没有 Homebrew 时不会静默安装 Homebrew；Cygwin 的系统包则需要通过 Cygwin 安装器维护。

## 它如何避免破坏已有配置

这是这个项目最重要的设计取舍：共享配置不能以“把用户的 `.zshrc` 换成我的版本”为代价。

安装器不会把仓库中的 `home/.zshrc` 直接复制覆盖用户文件，而是在用户的 `~/.zshrc` 和 `~/.zprofile` 末尾维护一个可重复更新的区块：

```zsh
# >>> zsh-dotfiles managed block >>>
...
# <<< zsh-dotfiles managed block <<<
```

虽然仓库已经从 `zsh-dotfiles` 改名为 `canxin-zsh`，marker 仍然保留旧名称，这是为了让历史安装可以被新版本识别和更新，避免升级后加载两遍配置。

### 新配置和已有配置的区别

- 空配置会进入 bootstrap 模式，启用完整的默认历史、补全、目录导航、快捷键、Oh My Zsh 和主题；
- 非空配置会进入兼容集成模式，保留用户已有的主题、插件、历史选项、补全样式和快捷键；
- 已经加载 Oh My Zsh 时不会重复加载，也不会重设用户的 `ZSH_THEME` 和 `plugins`；
- 检测到 zinit、zplug、zgen、antigen、zimfw、sheldon、prezto、zcomet 等其他框架时，不会再额外启动 Oh My Zsh；
- 已有 alias、function 和可读的 Powerlevel10k 配置会优先保留；
- 普通 symlink 会保留，安装器会更新它指向的目标；如果 symlink 直接指向仓库 source 文件，会先安全解除这个自引用关系，避免递归加载。

如果安装器确实需要修改已有配置，会先在下面的位置创建备份：

```text
~/.config/zsh-dotfiles/backups/
```

机器特定的设置可以放在：

```text
~/.zprofile.local   # PATH、SDK、代理和登录 shell 设置
~/.zshrc.local      # 本机 alias、函数和交互式设置
```

这些文件不会被仓库覆盖，也不应该提交到公开仓库。对于空配置，它们会自动加载；对于已有非空配置，安装器默认不额外插入加载语句，以免改变原来的加载顺序，可以由用户自行 source。

## 安装后如何检查和更新

本地 clone 的项目可以运行：

```bash
bin/zsh-doctor
```

远程安装默认把 source checkout 放在：

```text
${XDG_DATA_HOME:-$HOME/.local/share}/canxin-zsh
```

因此也可以直接执行：

```bash
"${XDG_DATA_HOME:-$HOME/.local/share}/canxin-zsh/bin/zsh-doctor"
```

诊断工具会检查 zsh、Git、默认工具集以及 `code` 命令是否存在，方便判断某个 alias 或增强功能为什么没有启用。

配置加载后，可以使用：

```zsh
zupdate-all
```

它会尝试更新 Oh My Zsh 和 `$ZSH_CUSTOM` 下的 Git 插件/主题 checkout。如果 `$ZSH_CUSTOM` 里还有用户自己放入的 Git checkout，它们也可能被更新；如果系统有 Homebrew，还会执行 `brew update` 和 `brew upgrade`。因此这个命令适合明确希望更新整套开发环境时使用。

安装阶段的更新选项则更细分：

```bash
./install.sh --update         # 更新远程地址匹配的依赖 checkout
./install.sh --update-source  # 更新远程安装管理的 canxin-zsh source checkout
./install.sh --dry-run        # 在本地 checkout 中只查看计划，不写配置
```

## 支持的平台

项目会根据环境使用对应的系统包管理器：

- macOS：优先使用已经安装的 Homebrew，也可以使用系统已有的 zsh 和 curl；
- Debian、Ubuntu、WSL：使用 `apt-get`；
- Fedora、RHEL：使用 `dnf` 或 `yum`；
- Arch Linux 和 MSYS2：使用 `pacman`；
- Alpine Linux：使用 `apk`；
- openSUSE：使用 `zypper`；
- Cygwin：先用 Cygwin 安装器准备 `git`、`curl` 和 `zsh`，再运行项目安装器。

原生 Windows PowerShell 和单独的 Git Bash 都不是 zsh 运行环境。Windows 用户应把 WSL 作为首选，或者使用已经安装 zsh 的 MSYS2/Cygwin。

## 这个项目为什么值得单独做一个安装器

如果只是把几个配置文件放进 Git 仓库，跨平台时很快就会遇到这些问题：

- macOS、Linux 和 MSYS2 的包管理器完全不同；
- `fd`、`bat` 等工具在 Debian 系统上的命令名可能与 macOS 不同；
- 有些机器已经有自己的 Oh My Zsh 或其他框架；
- 用户的 `.zshrc` 里可能已经有大量 alias、函数和本机变量；
- 通过 `curl | bash` 安装时，仓库 source 不能依赖当前目录存在；
- symlink、`ZDOTDIR` 和旧版本安装路径都可能造成重复加载或覆盖。

安装器把这些判断集中处理了：它会根据命令是否存在选择增强功能，根据配置内容选择 bootstrap 或 integrate 模式，根据远程地址决定是否允许更新，并在写入前留下备份。重复运行安装器时，已有 managed block 会被更新，而不是不断追加相同配置。

## 跨平台验证

这不是只在一台 Mac 上能工作的个人配置。仓库的 GitHub Actions 会在 Ubuntu、macOS 和 Windows/MSYS2 上运行 shell 语法检查、ShellCheck、隔离安装测试和真实依赖安装 smoke test；非 Pull Request 事件还会验证已经发布的一键安装脚本是否能够完成 bootstrap。

因此，项目更关注“安装器能否在不同环境中安全完成初始化”，而不只是 prompt 在作者自己的机器上看起来是否正常。可以在 [Actions 页面](https://github.com/canxin121/canxin-zsh/actions) 查看每次提交的验证结果。

## 安全提示

远程一键安装本质上会下载并执行仓库中的 shell 脚本。在敏感环境中，建议先 clone 并阅读 [install.sh](https://github.com/canxin121/canxin-zsh/blob/main/install.sh)，再决定是否执行。安装器需要系统权限时只调用已有的 `sudo` 或 `doas`，不会把密码写入文件。

公开仓库中的所有脚本、配置和提交历史都应视为任何人可读。API token、密码、私钥、公司内部路径和代理凭据应该放在本机的 local 文件或专门的秘密管理工具中，而不是放进仓库。`.gitignore` 可以降低误提交概率，但不能代替秘密管理，也不能抹掉已经进入 Git 历史的敏感内容。

如果你正在寻找一套“装一次、换机器时少折腾、又不希望接管原有 shell 配置”的 zsh 起点，`canxin-zsh` 就是为这个场景准备的。
