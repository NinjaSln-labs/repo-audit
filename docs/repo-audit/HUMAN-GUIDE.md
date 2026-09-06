# repo-audit 使用手册（人类版）

> 审计 scaffold 生成的仓库是否符合工业最佳实践标准。
> 审计基准 = `templates/` 目录下的模板文件。
> 跨平台：Windows / Linux / macOS / Unix 一个命令即用。

---

## 一、安装

### 方式一：直接运行（零配置）

Node.js 20+ 全局安装即可：

```bash
# 在项目根目录直接运行
node repo-audit.mjs --repo /path/to/repo
```

### 方式二：加入 PATH（推荐，像普通命令一样用）

把 `shim/` 目录加入 PATH：

```bash
# Linux / macOS
export PATH="$PATH:/path/to/shim"

# Windows（PowerShell）
$env:PATH += ";C:\path\to\shim"

# Windows（CMD）
set PATH=%PATH%;C:\path\to\shim
```

之后任意位置直接调用：

```bash
repo-audit --repo /path/to/repo        # Linux/macOS
repo-audit.cmd --repo C:\path\to\repo  # Windows CMD
repo-audit.ps1 --repo C:\path\to\repo  # Windows PowerShell
```

### 方式三：全局 npm 安装（长期用）

```bash
npm install -g /path/to/repo-audit-dir
```

---

## 二、快速开始

### 最简用法

```bash
# 审计当前目录
node repo-audit.mjs

# 审计指定仓库
node repo-audit.mjs --repo /path/to/repo
```

### 典型工作流

```bash
# 1. scaffold 生成新仓库后，立即验证出库质量
node repo-audit.mjs --repo ./my-new-repo

# 2. scaffold 升级模板后，对比前后差异
node repo-audit.mjs --repo ./my-repo --output ./audit-before
# ... 跑 scaffold --update ...
node repo-audit.mjs --repo ./my-repo --output ./audit-after

# 3. CI 中严格校验
node repo-audit.mjs --repo ./my-repo --strict --format json
```

### 常用组合

```bash
# 强制指定分类（跳过自动检测，加速）
node repo-audit.mjs --repo ./my-repo --type python-app

# 只审计安全维度
node repo-audit.mjs --repo ./my-repo --dim security

# 叠加自定义规则
node repo-audit.mjs --repo ./my-repo --rules ./my-rules.yaml

# 严格模式（Critical/Major 发现即 exit 1）
node repo-audit.mjs --repo ./my-repo --strict
```

---

## 三、命令行参数

| 参数 | 说明 | 默认值 |
|---|---|---|
| `--repo <path>` | 目标仓库路径 | 当前目录（`.`）|
| `--type <type>` | 强制指定分类（跳过自动检测） | 自动推断 |
| `--format <fmt>` | 输出格式：`md` / `json` / `both` | `both` |
| `--output <path>` | 报告输出目录 | `<repo>/audit-report/` |
| `--llm-provider <p>` | LLM 协议或厂商别名 | `none` |
| `--llm-base-url <url>` | 自定义 API 端点 | 协议默认 |
| `--llm-model <m>` | 模型名称 | `auto` |
| `--strict` | 严格模式：Critical/Major 发现即 exit 1 | 关 |
| `--rules <file>` | 自定义规则文件（可多次） | 无 |
| `--dim <domain>` | 只审计指定维度（可多次） | 全部 |
| `--help, -h` | 显示帮助 | — |

### `--type` 支持的分类

内置分类：`dsh-plugin` / `python-app` / `go-service` / `sandbox` / `content` / `product-oss` / `javascript` / `npm-package` / `rust` / `ruby` / `java-kotlin` / `java-maven` / `unknown`

自定义分类可通过环境变量 `REPO_AUDIT_TYPES` 扩展（JSON 数组）。

### `--dim` 支持的维度

`git` / `docs` / `security` / `quality` / `dsh` / `python` / `go` / `sandbox` / `content` / `oss`

### `--format` 说明

| 值 | 说明 |
|---|---|
| `md` | 只输出 Markdown 报告到 stdout + 文件 |
| `json` | 只输出 JSON 报告到 stdout + 文件 |
| `both` | 同时输出两份（默认） |

---

## 四、环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `LLM_PROVIDER` | LLM 供应商 | `none` |
| `LLM_API_KEY` | API Key（必须手动指定） | 无 |
| `LLM_MODEL` | 模型名称 | `auto` |
| `LLM_BASE_URL` | 自定义 API 端点 | 供应商默认 |
| `REPO_AUDIT_TYPES` | 自定义分类列表（JSON 数组） | 内置默认 |

### 协议与平台

工具按**协议类型**区分，不绑定任何具体厂商。只要 API 兼容 OpenAI 或 Anthropic 格式，就能直接用——包括聚合平台、自建代理、本地运行服务等。

| 协议 | 覆盖范围 | 默认模型 | 默认端点 |
|---|---|---|---|
| `openai` | OpenAI 官方 / 聚合平台 / 国内厂商 / 自建代理 / 本地服务（Ollama/LM Studio 等） | gpt-4o-mini | api.openai.com |
| `anthropic` | Anthropic 官方 / 自建代理 | claude-3-5-haiku-20241022 | api.anthropic.com |
| `none` | 纯规则模式，无 LLM | — | — |

### 核心用法：协议 + 端点 + Key

```bash
LLM_PROVIDER=<协议> LLM_BASE_URL=<端点> LLM_API_KEY=<key> \
  node repo-audit.mjs --repo ./my-repo
```

### 常见平台配置

#### 聚合平台

```bash
# OpenRouter（推荐，支持几乎所有主流模型）
export LLM_PROVIDER=openai
export LLM_BASE_URL=https://openrouter.ai/api/v1
export LLM_API_KEY=sk-or-v1-xxx
export LLM_MODEL=deepseek/deepseek-chat    # 或 any/deepseek-chat
node repo-audit.mjs --repo ./my-repo

# Perplexity
export LLM_PROVIDER=openai
export LLM_BASE_URL=https://api.perplexity.ai
export LLM_API_KEY=xxx
export LLM_MODEL=sonar

# Fireworks AI
export LLM_PROVIDER=openai
export LLM_BASE_URL=https://api.fireworks.ai/inference/v1
export LLM_API_KEY=xxx

# novita.ai
export LLM_PROVIDER=openai
export LLM_BASE_URL=https://api.novita.ai/v3/openai
export LLM_API_KEY=xxx
```

#### 国内厂商

```bash
# DeepSeek
export LLM_PROVIDER=openai
export LLM_BASE_URL=https://api.deepseek.com
export LLM_API_KEY=sk-xxx
export LLM_MODEL=deepseek-chat

# 阿里云通义千问
export LLM_PROVIDER=openai
export LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
export LLM_API_KEY=sk-xxx
export LLM_MODEL=qwen-plus

# 智谱 GLM
export LLM_PROVIDER=openai
export LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
export LLM_API_KEY=xxx
export LLM_MODEL=glm-4-plus

# 硅基流动
export LLM_PROVIDER=openai
export LLM_BASE_URL=https://api.siliconflow.cn/v1
export LLM_API_KEY=xxx
export LLM_MODEL=deepseek-ai/DeepSeek-R1-Distill-Llama-70B
```

#### 官方 API

```bash
# OpenAI（无需指定 BASE_URL）
export LLM_PROVIDER=openai
export LLM_API_KEY=sk-xxx
node repo-audit.mjs --repo ./my-repo

# Anthropic Claude
export LLM_PROVIDER=anthropic
export LLM_API_KEY=sk-ant-xxx
node repo-audit.mjs --repo ./my-repo
```

#### 本地运行服务

```bash
# Ollama
export LLM_PROVIDER=openai
export LLM_BASE_URL=http://localhost:11434/v1
export LLM_API_KEY=ollama
export LLM_MODEL=deepseek-r1:8b
node repo-audit.mjs --repo ./my-repo

# LM Studio
export LLM_PROVIDER=openai
export LLM_BASE_URL=http://localhost:1234/v1
export LLM_API_KEY=lm-studio
export LLM_MODEL=microsoft/Phi-3-mini-4k
node repo-audit.mjs --repo ./my-repo

# vLLM / TGI / 任何 OpenAI 兼容推理服务
export LLM_PROVIDER=openai
export LLM_BASE_URL=http://your-server:8000/v1
export LLM_API_KEY=xxx
export LLM_MODEL=your-model
node repo-audit.mjs --repo ./my-repo
```

### 厂商别名（快捷方式）

以下别名可**直接作为 `LLM_PROVIDER` 的值**，工具自动映射到对应协议：

| 别名 | 映射协议 | 说明 |
|---|---|---|
| `openrouter` | openai | OpenRouter 聚合平台 |
| `deepseek` | openai | DeepSeek |
| `qwen` / `通义千问` | openai | 阿里云通义 |
| `glm` / `智谱` | openai | 智谱 AI |
| `siliconflow` / `硅基流动` | openai | 硅基流动 |
| `perplexity` | openai | Perplexity |
| `fireworks` | openai | Fireworks AI |
| `openai` | openai | OpenAI 官方 |
| `anthropic` / `claude` | anthropic | Anthropic 官方 |

> **注意**：使用非默认端点的别名时仍需设置 `LLM_BASE_URL`。

---

## 五、输出说明

### 报告文件

审计报告写入 `<repo>/audit-report/` 目录：

| 文件 | 格式 | 用途 |
|---|---|---|
| `report.md` | Markdown | 人类阅读，适合 PR 附件 |
| `report.json` | JSON | 程序解析，适合 CI 消费 |

### 报告结构（JSON）

```json
{
  "generated_at": "2026-09-05T...",
  "audit_type": "dsh-plugin",
  "llm_used": false,
  "metadata": {
    "remote": "git@github.com:...",
    "branch": "main",
    "commitCount": 119,
    "fileCount": 2734,
    "lastCommit": "2026-09-05 20:25:29 +0800"
  },
  "summary": {
    "critical": 1,
    "major": 4,
    "minor": 1,
    "info": 0,
    "pass": 22,
    "total": 28,
    "llmUsed": false
  },
  "findings": [
    {
      "id": "SEC-004",
      "title": "publish workflow 含 id-token write",
      "severity": "critical",
      "domain": "security",
      "status": "fail",
      "message": "...",
      "evidence": "字段不存在或值不匹配",
      "hint": "在 workflow 顶部添加 permissions: id-token: write",
      "template_ref": "templates/repo-root/.github/workflows/publish.yml",
      "llm_analysis": null
    }
  ]
}
```

### stdout 摘要

```
分类: dsh-plugin | 评分: 32/100 (F)  |  发现: 🔴1 🟠4 🟡1 🔵0 ✅22  |  LLM 增强: 未启用  |  报告: audit-report/report.md + report.json
```

### 健康评分

```
score = max(0, 100 - critical×25 - major×10 - minor×3)
等级: A(90+) / B(80+) / C(70+) / D(60+) / F(<60)
```

---

## 六、退出码

| 码 | 含义 | 适用场景 |
|---|---|---|
| `0` | 审计通过（无 Critical/Major 或 --strict 未启用） | 日常检查 |
| `1` | 有 Critical/Major 发现且 --strict 启用 | CI 门禁 |
| `2` | 参数错误 / 运行时错误 | 调试 |
| `3` | 目标不是 git 仓库 | 前置校验 |

---

## 七、审计维度说明

### git（4 条）

| 规则 ID | 标题 | 严重度 | 说明 |
|---|---|---|---|
| GIT-001 | Conventional Commits 规范 | major | 最近 20 条提交符合规范 |
| GIT-002 | .gitignore 含机密防护段 | major | 排除构建产物和日志 |
| GIT-003 | 至少有一个有效提交 | critical | 仓库必须有提交 |
| GIT-004 | .scaffold/lock 存在 | info | scaffold 管理仓应有 lock；非 scaffold 仓自动豁免 pass |

### docs（8 条）

| 规则 ID | 标题 | 严重度 | 适用分类 |
|---|---|---|---|
| DOC-001 | README.md 存在且非空 | critical | 所有 |
| DOC-002 | 双语 README 标配 | minor | 工程类 |
| DOC-003 | LICENSE 存在（MIT） | critical | 所有 |
| DOC-004 | AGENTS.md 含 AI 协作守则 | major | 所有 |
| DOC-005 | CONTRIBUTING.md 存在 | minor | 工程类 |
| DOC-006 | DEVELOPMENT.md 存在 | minor | 工程类 |
| DOC-007 | PUBLISHING.md 存在 | minor | 有发布面 |
| DOC-008 | SECURITY.md 存在 | minor | 工程类 |

### security（4 条）

| 规则 ID | 标题 | 严重度 | 说明 |
|---|---|---|---|
| SEC-001 | 无硬编码密钥 | critical | grep 扫描源码 |
| SEC-002 | CI workflow 使用 SHA 固定 | major | 供应链安全 |
| SEC-003 | 无本机绝对路径 | major | 机密红线 |
| SEC-004 | publish workflow 含 id-token write | critical | OIDC 发布 |

### quality（5 条）

| 规则 ID | 标题 | 严重度 | 说明 |
|---|---|---|---|
| QUA-001 | 验证链存在 | major | verify.mjs/scripts/verify.py/Makefile |
| QUA-002 | CI workflow 存在 | major | .github/workflows/ci.yml |
| QUA-003 | pre-commit 钩子配置 | minor | .githooks/pre-commit |
| QUA-004 | 锁文件入库 | major | package-lock.json 等 |
| QUA-005 | CLAUDE.md 桥接 | info | Claude Code 用户友好 |

### 分类专属规则

| 分类 | 规则数 | 核心检查项 |
|---|---|---|
| dsh-plugin | 7 | dsh 字段、peer deps、publish workflow、verify.mjs、build.mjs |
| python-app | 5 | pyproject.toml、tests/、verify.py、PyPI publish |
| go-service | 5 | go.mod、cmd/、Makefile、CI、release |
| sandbox | 3 | 最小集（README+AGENTS）、无 CI |
| content | 3 | 主文 .md、review 分离、README 导航 |
| product-oss | 7 | CHANGELOG、CODEOWNERS、dependabot、release-please |

---

## 八、扩展指南

### 新增维度

在 `rules/domains/` 下加一个新 YAML 文件：

```yaml
rules:
  - id: NEW-001
    title: "新规则标题"
    severity: major
    domain: new-domain
    applies_to: ["*"]
    check: file_exists
    params:
      paths: ["new-file.txt"]
    description: "规则说明"
    template_ref: "templates/common/..."
    fix_hint: "修复建议"
```

然后重新运行审计，新规则自动生效。

### 新增分类

1. 在 `rules/categories/` 下加新 YAML 文件
2. 在 `repo-audit.mjs` 的 `detectType()` 函数加分支

```js
if (hasFile(repoPath, 'Cargo.toml')) scores['rust'] = 8
```

3. 可选：在 `REPO_AUDIT_TYPES` 环境变量中添加新分类名

### 自定义规则

```bash
node repo-audit.mjs --repo ./my-repo --rules ./my-custom-rules.yaml
```

自定义规则叠加到内置规则之上，不替代。

---

## 九、故障排查

### "目标不是 git 仓库"

```bash
# 检查是否是 git 仓
git -C /path/to/repo rev-parse --is-inside-work-tree
# 应该是 true

# 如果不是，初始化
git -C /path/to/repo init
git -C /path/to/repo add -A
git -C /path/to/repo commit -m "chore: initial commit"
```

### "未知参数"警告

检查参数拼写，注意 `--` 双横线：

```bash
# 正确
node repo-audit.mjs --repo ./my-repo --strict

# 错误（会报未知参数）
node repo-audit.mjs -repo ./my-repo   # 单横线
```

### LLM 增强失败

LLM 失败不影响规则结果，静默跳过。查看详细错误：

```bash
# LLM 失败的错误会输出到 stderr
node repo-audit.mjs --repo ./my-repo 2>&1 | grep "LLM"
```

常见原因：
- API Key 缺失或无效 → 检查 `LLM_API_KEY`
- 网络问题 → 检查 `LLM_BASE_URL` 是否可达
- 模型配额用完 → 换模型或等配额恢复

### 分类检测不准

用 `--type` 强制指定：

```bash
node repo-audit.mjs --repo ./my-repo --type python-app
```

或通过 `REPO_AUDIT_TYPES` 环境变量添加自定义分类。

---

## 十、与 scaffold 的配合

| 操作 | 命令序列 |
|---|---|
| 新建仓库后验证 | `scaffold.mjs --type xxx --name yyy` → `repo-audit.mjs --repo ./yyy` |
| **存量仓补齐缺失文档** | `scaffold.mjs --update ./zzz --type xxx --dry-run`（预览）→ `scaffold.mjs --update ./zzz`（执行；adopt 模式零覆盖）→ `repo-audit.mjs --repo ./zzz` 复审 |
| 模板升级后对比 | `repo-audit.mjs --repo ./zzz --output ./before` → `scaffold.mjs --update ./zzz` → `repo-audit.mjs --repo ./zzz --output ./after` |
| CI 门禁 | `repo-audit.mjs --repo . --strict --format json` |
| PR 描述附件 | `repo-audit.mjs --repo . --format md --output ./pr-audit` → 附 `pr-audit/report.md` 到 PR |

> **补 AGENTS.md 提示**（DOC-004 fail 时）：优先 `scaffold --update` 补齐（模板头部自带来源声明二选一）；确需手写时，无 `.scaffold/lock/` 的仓按「自主维护」措辞写头部，勿照抄「单源拼装」行。

---

## 十一、操作授权与完成路径

### 11.1 权限模型

`repo-audit` 是**纯只读工具**，不修改目标仓库任何文件，因此不需要写权限。

| 操作 | 所需权限 | 说明 |
|---|---|---|
| 运行审计 | 仓库读权限 | 只需 `git clone --local` 能读即可 |
| 写入报告 | 输出目录写权限 | 默认写入 `<repo>/audit-report/` |
| LLM 增强 | API Key | 需在环境变量中配置 `LLM_API_KEY` |
| CI 集成 | GitHub Actions `id-token: read` | 读取 OIDC token 用于 LLM 调用（可选） |

### 11.2 执行路径

```
用户/Agent 发起审计请求
  │
  ├─ ① 前置校验
  │     ├─ 目标路径存在？ ── 否 ──→ 报错 exit 2
  │     └─ 是 git 仓库？ ── 否 ──→ 报错 exit 3
  │
  ├─ ② 分类检测
  │     ├─ --type 指定？ ── 是 ──→ 使用指定值
  │     └─ 否 ──→ 自动推断（评分制）
  │            └─ 置信度低？ ── 是 ──→ 告警但继续（记录 reasons）
  │
  ├─ ③ 规则加载
  │     ├─ 内置规则（domains/*.yaml + categories/<type>.yaml）
  │     ├─ --rules 自定义规则叠加
  │     └─ --dim 按维度过滤
  │
  ├─ ④ 规则执行
  │     └─ 逐条检查 → findings 列表
  │
  ├─ ⑤ LLM 增强（可选）
  │     ├─ LLM_API_KEY 已配置？ ── 是 ──→ 对 fail 发现做增强（最多 5 条）
  │     └─ 否 ──→ 跳过，纯规则结果完整可用
  │
  ├─ ⑥ 报告生成
  │     ├─ JSON → <output>/report.json
  │     ├─ Markdown → <output>/report.md
  │     └─ stdout → 摘要行
  │
  └─ ⑦ 退出
        ├─ exit 0 ──→ 通过（无 Critical/Major 或 --strict 未启用）
        ├─ exit 1 ──→ 有 Critical/Major（--strict 启用）
        └─ exit 2/3 ──→ 错误（参数/非 git）
```

### 11.3 典型操作场景

#### 场景 A：人工快速审计

```bash
# 一步到位，stdout 看摘要，文件看详情
node repo-audit.mjs --repo ./my-repo
```

#### 场景 B：CI 门禁（自动化）

```yaml
# GitHub Actions
- name: Audit repo health
  run: |
    node repo-audit.mjs --repo . --strict --format json --output .ci-audit
    SCORE=$(jq '.summary | 100 - (.critical * 25) - (.major * 10) - (.minor * 3)' .ci-audit/report.json)
    echo "Health score: $SCORE"
    # exit 1 if score < 70
    [ "$SCORE" -ge 70 ] || exit 1
```

#### 场景 C：模板升级前后对比

```bash
# 升级前
node repo-audit.mjs --repo ./repo --format json --output ./before
# 升级后
node scaffold.mjs --update ./repo
node repo-audit.mjs --repo ./repo --format json --output ./after
# 对比
diff <(jq '.summary' ./before/report.json) <(jq '.summary' ./after/report.json)
```

#### 场景 D：Agent 批量审计

```bash
# Agent 一次审计多个仓库
for repo in ~/ninjasin-labs/*/; do
  [ -d "$repo/.git" ] || continue
  node repo-audit.mjs --repo "$repo" --format json --output "$repo/.audit/" 2>/dev/null
done
```

### 11.4 完成判定标准

| 场景 | 完成条件 |
|---|---|
| 单次审计 | 报告文件写入 + stdout 摘要输出 + 正确退出码 |
| CI 门禁 | exit 0 + score ≥ 70（可配置阈值）|
| 批量审计 | 所有仓库 exit 0 或可接受的非零码 |
| 升级对比 | before/after 两份报告 + 差异摘要 |
| PR 审查 | report.md 作为 PR 附件 + fail 项清单 |

### 11.5 异常终止路径

| 异常类型 | 触发条件 | 处理方式 |
|---|---|---|
| 参数错误 | 未知 flag / 缺少必填值 | exit 2，打印用法 |
| 非 git 仓 | `--repo` 指向非 git 目录 | exit 3，提示初始化 |
| 规则文件缺失 | `--rules` 指向不存在文件 | 警告跳过，继续审计 |
| LLM API 失败 | Key 无效 / 网络超时 | 静默降级为纯规则模式 |
| 输出目录不可写 | 权限不足 / 磁盘满 | exit 2，提示创建目录 |

---

*最后更新：2026-09-06（v1.2 新增 monorepo 感知 P6）

---

## 十二、新特性说明（2026-09-06）

### 12.1 .auditrc.yaml 仓库级豁免

当某条规则是**已知接受的历史决策**（如 Conventional Commits 个别非标准 commit），可创建 `.auditrc.yaml` 豁免：

```yaml
# .auditrc.yaml（放在仓根，受版本控制）
waive:
  - id: GIT-001
    reason: "历史 commit fix(template)+docs 单条非标准；已知接受不回改"
    since: "2026-09-06"
```

效果：该规则 finding 标 `status: "waived"`，评分排除此项，不阻塞 CI。

### 12.2 项目定位识别（personal 模式）

工具自动检测 README 首段关键词（自用/solo/personal/个人/单机）：
- 命中 → `personal` 模式，自动豁免 7 条 N/A 规则（DOC-002/005/007、QUA-002/005、GO-004/005）
- 等效内容检测：docs/ 有开发文档 → DOC-006 pass；.githooks/ 有钩子 → QUA-003 pass

### 12.3 archive 分类

最后 commit 含 `archived`/`封版` 关键词 → 自动归类为 `archive`：
- 仅 SEC-001（密钥扫描）+ SEC-003（路径泄漏）两条安全规则
- 其余工程规范全部豁免

### 12.4 file_exists fallback

当主验证链路径（verify.mjs/Makefile）不存在时，自动尝试 `package.json scripts.test`：
```yaml
params:
  paths: ["verify.mjs", "Makefile"]
  fallback_paths: ["package.json"]
  fallback_field: "scripts.test"
```

### 12.5 toml_field expect_table

检查 TOML 表头存在性（而非表内键值）：
```yaml
check: toml_field
params:
  field: "tool.pytest.ini_options"
  expect_table: true
```

### 12.6 Monorepo 感知（P6）

工具自动探测 workspace 布局，无需手动指定子目录审计：

**支持布局**：根优先，fallback 搜索 `apps/*/`、`packages/*/`、`workspaces/*/`、`components/*/` 等常见 monorepo 目录。

**自动处理**：
- 分类检测：根无 `package.json` 时递归查找 → 正确识别 `javascript` 而非误判为 `content`
- `file_exists` fallback：锁文件、验证链自动搜索 workspace 子目录
- `QUA-004` 锁文件：`apps/desktop/package-lock.json` 被正确识别

**示例**：
```
neonforge/（ Electron monorepo，405 commits）
  apps/desktop/package.json      ← 工程实体
  apps/desktop/package-lock.json ← 锁文件
  # 根目录无 package.json
```
审计根目录 → 自动识别为 `javascript` 分类，19 条工程规则加载，评分 88/B。

**注意事项**：
- 若 workspace 有多个 package.json（如 apps/web + apps/api），取第一个命中的
- 可显式指定 `--type javascript` 跳过自动分类

**限制**：`json_field` 检查器（如 DOC-003b license 一致性）只读仓根 `package.json`，
不递归 workspace。monorepo 中若子目录有 license 字段而根目录没有，可能误报。
workaround：对工程子目录单独跑审计，或人工确认。

### 12.7 开源仓 workflow 审查清单

首次将 scaffold 生成的仓库发布到 GitHub 前，逐项检查 CI/publish workflow 是否适配目标项目：

| # | 检查点 | 常见问题 | 验证方式 |
|---|---|---|---|
| 1 | **分支名** | workflow 触发 `main`，实际分支为 `master` | `git branch --show-current` vs `on.push.branches` |
| 2 | **依赖管理** | `npm ci` 但无 `package-lock.json`（零依赖项目） | `ls package-lock.json` 存在性 |
| 3 | **脚本路径** | `node scripts/verify.mjs` 但实际为 `verify.mjs` | `ls scripts/verify.mjs` 存在性 |
| 4 | **tag 格式** | `demo-v*` 但实际为 `v*`（匹配 package.json version） | 检查 `on.push.tags` 与 `package.json.version` 格式一致 |
| 5 | **action 版本** | `<commit-SHA>` 占位符未替换 | `grep -r '<commit-SHA>' .github/workflows/` 应为空 |
| 6 | **npm trusted publisher** | publish.yml 配置了 OIDC 但 npm 端未配置 trusted publisher | npmjs.com → Package Settings → Trusted Publishers |

**快速检查命令**：
```bash
# 1) 检查分支名一致性
echo "实际分支: $(git branch --show-current)"
echo "workflow 触发: $(grep -A2 'branches:' .github/workflows/ci.yml | tail -1 | xargs)"

# 2) 检查依赖管理
[ -f package-lock.json ] && echo "✓ 有 lockfile" || echo "✗ 无 lockfile — 移除 npm ci"

# 3) 检查脚本路径
for f in scripts/verify.mjs verify.mjs; do [ -f "$f" ] && echo "✓ $f"; done

# 4) 检查 tag 格式
echo "package.json version: $(node -p "require('./package.json').version")"
echo "workflow tag: $(grep 'tags:' -A2 .github/workflows/publish.yml | tail -1)"

# 5) 检查占位符
grep -rE '<commit-SHA>|dsh-demo|demo-v' .github/workflows/ && echo "✗ 有残留" || echo "✓ 无残留"
```

**教训来源**：`repo-audit` 开源仓首次 push 时，CI workflow 从 dsh-demo 模板直接复制，
`npm ci`（无 lockfile）、`scripts/verify.mjs`（路径错误）、`main` 分支（实际 master）、
`<commit-SHA>`（占位符未替换）四项同时失败，workflow 不触发。

### 12.8 反馈通道

**工具内反馈**（推荐，自动预填环境信息）：
```bash
repo-audit --feedback "在 monorepo 项目中 DOC-003b 规则误报"
```
效果：自动创建 GitHub Issue，包含反馈内容 + 工具版本 + Node.js 版本 + 平台信息。
Agent 可通过 `gh issue list --repo NinjaSln-labs/repo-audit --label audit-feedback` 检测反馈。

**GitHub Issues**：
- [Bug 报告](https://github.com/NinjaSln-labs/repo-audit/issues/new?template=bug_report.yml) — 预填复现步骤/实际输出/期望输出
- [功能反馈](https://github.com/NinjaSln-labs/repo-audit/issues/new?template=feedback.yml) — 建议/文档问题/性能问题
- [全部 Issues](https://github.com/NinjaSln-labs/repo-audit/issues)

**其他渠道**：
- Discord/Slack：见 GitHub Discussions
- 邮件：info@ninjasln-labs.com（仅安全问题）

**Agent 反馈检测协议**：
```bash
# 检测新反馈
gh issue list --repo NinjaSln-labs/repo-audit --label audit-feedback --state open --json number,title,createdAt

# 获取反馈详情
gh issue view <NUMBER> --repo NinjaSln-labs/repo-audit

# 反馈已处理
gh issue close <NUMBER> --repo NinjaSln-labs/repo-audit --comment "已处理，感谢反馈"
```


