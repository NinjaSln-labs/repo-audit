# repo-audit

> **仓库标准化审计工具 + 工程脚手架生成器**

对仓库进行工业级最佳实践审计（无需 npm 依赖的纯 Node.js ESM 单文件），并支持从模板生成符合规范的工程脚手架。

## ✨ 特性

- **零依赖**：单个 `repo-audit.mjs` 文件，纯 Node.js ESM，无需 `npm install`
- **跨平台**：内置 Windows（`.cmd` / `.ps1`）、Linux/macOS（`.sh`）启动器
- **自动分类**：基于文件结构评分检测 18 种仓库类型（dsh-plugin / python-app / go-service / content / sandbox / archive 等）
- **可扩展规则**：`rules/` 目录下 YAML 规则，支持 5 大维度（docs / git / quality / security）+ 分类专属规则
- **Monorepo 感知**：自动探测 workspace 布局（`apps/*` / `packages/*` 等）
- **仓库级豁免**：`.auditrc.yaml` 声明已知接受的发现，避免「狼来了」效应
- **可选 LLM 增强**：支持 15+ 提供商（OpenAI / Anthropic / DeepSeek / Qwen / GLM / OpenRouter 等）
- **只读安全**：不修改被审计仓库任何文件

## 📦 快速开始

### 审计仓库

```bash
# 直接运行（Linux/macOS）
./shim/repo-audit.sh --repo /path/to/repo

# 或用 node
node repo-audit.mjs --repo /path/to/repo --format json

# Windows
shim\repo-audit.cmd --repo C:\path\to\repo
```

### 生成脚手架

```bash
node templates/scaffold.mjs --type dsh-plugin --name my-plugin --org my-org --desc "插件描述"
```

## 🏗️ 目录结构

```
repo-audit/
├── repo-audit.mjs          # 核心审计引擎（单文件，零依赖）
├── rules/                  # 审计规则（YAML）
│   ├── domains/            # 跨维度规则（docs/git/quality/security）
│   └── categories/         # 分类专属规则（dsh-plugin/python-app/...）
├── shim/                   # 跨平台启动器
├── templates/              # 工程脚手架模板 + 生成器
├── docs/repo-audit/        # 使用手册（AGENT-GUIDE + HUMAN-GUIDE）
├── AUDIT.md                # 审计方法论
├── BEST-PRACTICES.md       # 最佳实践标准
├── REPO-CLASSIFICATION.md  # 分类检测说明
└── REPO-AUDIT.md           # 工具概述
```

## 📚 文档

- [人类手册](https://github.com/NinjaSln-labs/repo-audit/blob/master/docs/repo-audit/HUMAN-GUIDE.md) — 完整使用说明
- [Agent 手册](https://github.com/NinjaSln-labs/repo-audit/blob/master/docs/repo-audit/AGENT-GUIDE.md) — 机器可读的操作协议
- [审计方法论](https://github.com/NinjaSln-labs/repo-audit/blob/master/AUDIT.md)
- [最佳实践标准](https://github.com/NinjaSln-labs/repo-audit/blob/master/BEST-PRACTICES.md)
- [GitHub Pages](https://ninjasln-labs.github.io/repo-audit/) — 在线文档

## 🛠️ 开发

- 审计规则：编辑 `rules/domains/*.yaml`（跨维度）或 `rules/categories/*.yaml`（分类专属）
- 新增分类：在 `rules/categories/` 添加 `<type>.yaml`，或用 `REPO_AUDIT_TYPES` 环境变量扩展
- 自定义规则：`--rules my-rules.yaml` 参数加载

## 📄 许可证

MIT © 2026 NinjaSln-labs
