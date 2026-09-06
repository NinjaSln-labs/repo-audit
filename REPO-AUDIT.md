# repo-audit — 仓库标准化审计工具

专门审计 scaffold 生成的仓库是否符合工业最佳实践标准。审计基准 = `templates/` 目录下的模板文件。

## 快速开始

```bash
# 审计当前仓库（自动检测分类）
node repo-audit.mjs

# 审计指定仓库
node repo-audit.mjs --repo /path/to/repo

# 指定分类（跳过自动检测，加速）
node repo-audit.mjs --repo /path/to/repo --type python-app

# 启用 LLM 增强（对 fail 的发现做根因分析和修复建议）
export LLM_PROVIDER=deepseek
export LLM_API_KEY=sk-xxx
node repo-audit.mjs --repo /path/to/repo --llm-model deepseek-chat

# 严格模式（Critical/Major 发现即 exit 1，适合 CI）
node repo-audit.mjs --strict

# 只输出 JSON（CI 解析用）
node repo-audit.mjs --format json

# 只审计特定维度
node repo-audit.mjs --dim security --dim docs

# 叠加自定义规则
node repo-audit.mjs --rules my-custom-rules.yaml
```

## 跨平台安装

```bash
# 方式一：直接运行
node repo-audit.mjs --repo /path/to/repo

# 方式二：加入 PATH（shim 目录）
export PATH="$PATH:/path/to/shim"
repo-audit --repo /path/to/repo   # Windows 用 repo-audit.cmd，Linux/macOS 用 repo-audit.sh
```

## 命令行参数

| 参数 | 说明 | 默认值 |
|---|---|---|
| `--repo <path>` | 目标仓库路径 | 当前目录 |
| `--type <type>` | 强制指定分类（跳过自动检测） | 自动推断 |
| `--format <fmt>` | 输出格式：md / json / both | both |
| `--output <path>` | 输出目录 | `<repo>/audit-report/` |
| `--llm-provider <p>` | LLM 供应商：openai / anthropic / deepseek / none | none |
| `--llm-model <m>` | 模型名称 | auto |
| `--strict` | 严格模式：Critical/Major 发现即 exit 1 | 关 |
| `--rules <file>` | 自定义规则文件（可多次） | 无 |
| `--dim <domain>` | 只审计指定维度（可多次） | 全部 |
| `--help, -h` | 显示帮助 | — |

## 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `LLM_PROVIDER` | LLM 供应商 | `none` |
| `LLM_API_KEY` | API Key | 无（必须手动指定）|
| `LLM_MODEL` | 模型名称 | `auto` |
| `LLM_BASE_URL` | 自定义 API 端点 | 供应商默认 |
| `REPO_AUDIT_TYPES` | 自定义分类列表（JSON 数组） | 内置默认 |

支持的 LLM 供应商：`openai`、`anthropic`、`deepseek`、`none`

## 输出说明

审计报告写入 `<repo>/audit-report/` 目录：
- `report.md` — 人类可读的详细报告（评分 + 分级发现 + LLM 分析）
- `report.json` — 机器可读的结构化数据（CI 消费用）
- stdout — 简洁摘要（评分 + 发现统计）

## 审计维度（可扩展）

| 维度 | 初始规则数 | 说明 |
|---|---|---|
| `git` | 4 | Conventional Commits、.gitignore、提交数、lock 状态 |
| `docs` | 8 | README/LICENSE/AGENTS/CONTRIBUTING 等（引用 templates/common/ 单源） |
| `security` | 4 | 硬编码密钥、CI SHA 固定、本机路径、id-token 权限 |
| `quality` | 5 | 验证链、CI workflow、pre-commit、锁文件、CLAUDE.md |
| `dsh` / `python` / `go` / `sandbox` / `content` / `oss` | 各 3-7 | 分类专属规则（从 CATEGORY.md 推导） |

**新增维度**：在 `rules/domains/` 下加新 YAML 文件，无需改引擎代码。
**新增分类**：在 `rules/categories/` 下加新 YAML + `detectType` 加分支。

## 与 scaffold 的关系

- `scaffold.mjs --generate` 后 → 立即跑 `repo-audit` 验证出库质量
- `scaffold.mjs --update` 后 → 再跑 `repo-audit` 确认模板升级未破坏既有内容
- audit 报告可作为 PR 描述附件，说明仓库当前健康度
- 规则随模板升级自动更新（`template_ref` 指向 templates/，不改代码）

## 退出码

| 码 | 含义 |
|---|---|
| 0 | 审计通过（无 Critical/Major 或 --strict 未启用） |
| 1 | 有 Critical/Major 发现且 --strict 启用 |
| 2 | 参数错误 / 运行时错误 |
| 3 | 目标不是 git 仓库 |
