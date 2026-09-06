# repo-audit Agent 操作手册

> 机器可读的操作协议。Agent 直接执行，无需人类解释。

---

## 一、工具定位

`repo-audit` 是一个**纯只读**的仓库审计工具。输入：仓库路径 + 可选参数。输出：审计报告（JSON + Markdown）+ 退出码。不修改目标仓库任何文件。

---

## 二、调用协议

### 2.1 基本调用

```bash
node <repo-audit-path>/repo-audit.mjs --repo <repo-path> [options]
```

### 2.2 参数清单

| 参数 | 必填 | 说明 | 示例 |
|---|---|---|---|
| `--repo` | 否 | 目标仓库（默认 `.`）| `--repo /path/to/repo` |
| `--type` | 否 | 强制分类（跳过检测）| `--type python-app` |
| `--format` | 否 | 输出格式 | `--format json` |
| `--output` | 否 | 输出目录 | `--output /tmp/audit` |
| `--strict` | 否 | 严格模式 | `--strict` |
| `--rules` | 否 | 自定义规则（可多次）| `--rules a.yaml --rules b.yaml` |
| `--dim` | 否 | 只审计指定维度（可多次）| `--dim security --dim docs` |
| `--llm-provider` | 否 | LLM 供应商 | `--llm-provider deepseek` |
| `--llm-model` | 否 | 模型名称 | `--llm-model deepseek-chat` |
| `--help` | — | 帮助信息 | `--help` |

### 2.3 环境变量

| 变量 | 必填 | 说明 | 默认 |
|---|---|---|---|
| `LLM_PROVIDER` | 否 | 协议或别名（openai/anthropic/none/openrouter/deepseek/qwen等） | `none` |
| `LLM_API_KEY` | LLM 时需要 | API Key | 无 |
| `LLM_MODEL` | 否 | 模型名称 | `auto` |
| `LLM_BASE_URL` | 非默认端点时必填 | 自定义 API 端点 | 协议默认 |
| `REPO_AUDIT_TYPES` | 否 | 自定义分类列表 | 内置 |
| `REPO_AUDIT_WAIVE` | 否 | 命令行豁免规则 ID（逗号分隔，替代 .auditrc.yaml）| 无 |

### 2.4 退出码

| 码 | 含义 | Agent 行为 |
|---|---|---|
| `0` | 通过 | 记录评分，继续 |
| `1` | 有 Critical/Major + --strict | 告警，报告给调用方 |
| `2` | 参数错误 | 修正参数后重试 |
| `3` | 非 git 仓库 | 报告错误，不继续 |

---

## 三、输出解析

### 3.1 JSON 报告结构（机器可读）

```json
{
  "generated_at": "<ISO timestamp>",
  "audit_type": "<分类名>",
  "llm_used": <bool>,
  "metadata": {
    "remote": "<git remote URL or null>",
    "branch": "<branch name or '(detached)'>",
    "commitCount": <int>,
    "fileCount": <int>,
    "lastCommit": "<ISO date>"
  },
  "summary": {
    "critical": <int>,
    "major": <int>,
    "minor": <int>,
    "info": <int>,
    "pass": <int>,
    "total": <int>,
    "llmUsed": <bool>,
    "waived": <int>
  },
  "findings": [
    {
      "id": "<规则ID>",
      "title": "<规则标题>",
      "severity": "critical\|major\|minor\|info",
      "domain": "<维度>",
      "applies_to": ["<分类列表>"],
      "status": "pass\|fail\|llm\|waived",
      "message": "<描述>",
      "evidence": "<检查结果>",
      "hint": "<修复建议 or null>",
      "template_ref": "<模板路径 or null>",
      "waived_reason": "<豁免原因 or null>",
      "waived_since": "<豁免日期 or null>",
      "llm_analysis": { ... } or null
    }
  ]
}
```

### 3.2 评分计算

```
score = max(0, 100 - critical×25 - major×10 - minor×3)
grade = score≥90→A, ≥80→B, ≥70→C, ≥60→D, <60→F
```

### 3.3 Agent 应关注的字段

| 场景 | 关注字段 |
|---|---|
| CI 门禁 | `summary.critical`, `summary.major`, `exit_code==1` |
| 生成后验证 | `findings.filter(f=>f.status==='fail')` 列表 |
| 升级前后对比 | `summary` 中的各级别计数差值 |
| LLM 增强 | `findings[*].llm_analysis.root_cause` |

### 3.4 仓库级豁免（.auditrc.yaml）

当某条规则为**已知接受的历史决策**（非工具缺陷），可创建 `.auditrc.yaml` 豁免，避免每次审计重报：

```yaml
# .auditrc.yaml（受版本控制，团队共享）
waive:
  - id: GIT-001
    reason: "历史 commit fix(template)+docs 单条非标准；Conventional Commits 145 条 1 miss，已知接受不回改"
    since: "2026-09-06"
  - id: DOC-002
    reason: "纯中文项目，无英文镜像需求"
    since: "2026-09-06"
```

**行为**：
- 规则照常运行，finding 标 `status: "waived"` + `waived_reason`
- 评分**排除 waived 项**（`summary.waived` 计数）
- 命令行批量豁免：`--waive GIT-001 --waive DOC-002`

**触发条件**（自动识别，无需手动配置）：
- README 首段含 `自用/solo/personal/个人` → `personal` 模式，自动豁免 7 条规则
- 最后 commit 含 `archived`/`封版` → `archive` 分类，仅 SEC-001/SEC-003

---

### 3.5 Monorepo 感知（P6）

工具自动探测 workspace 布局，无需手动指定子目录：

```yaml
# neonforge 结构示例
neonforge/
  apps/
    desktop/
      package.json        ← 工程实体
      package-lock.json   ← 锁文件
  package.json            ← 根（可能无或仅为 workspace 根）
```

**行为**：
- `detectType`：根无 `package.json` 时递归搜索 `apps/*/packages/*/workspaces/*` 等常见布局
- `file_exists` fallback：`package.json` 不存在于根时自动使用 workspace 位置
- `QUA-004` 锁文件：根无锁文件时搜索 workspace 子目录

**分类影响**：monorepo 正确识别为 `javascript`/`npm-package`，而非误判为 `content`。

**已知限制**：
- `json_field` 检查器（DOC-003b 等）仍只读仓库根路径，不递归 workspace
- 若规则依赖 `package.json` 字段（如 `license`），monorepo 下可能 false negative
-  workaround：`--type` 强制分类 + 人工确认子目录配置

---

## 四、标准操作流程

### 4.1 新建仓库后验证

```bash
# 1. scaffold 生成
node scaffold.mjs --type <type> --name <name> --org <org> --desc "<desc>"

# 2. 进入新仓
cd <name>

# 3. 跑审计
node ../repo-audit.mjs --format json --output ./audit-report

# 4. 检查关键发现
cat audit-report/report.json | jq '.findings[] | select(.status=="fail") | .id'

# 5. 如有 Critical 发现，阻断生成流程
```

### 4.2 存量仓库补齐缺失文档（Issue#3 动线）

审计 fail 后需要补 AGENTS.md / CONTRIBUTING.md 等模板文档时，**优先用 `scaffold --update` 而不是手写**：

```bash
# 1. 存量仓首次接入（无 .scaffold/lock/）——adopt 模式，零覆盖保证
node scaffold.mjs --update <repo> --type <type> --dry-run   # 先看会落位什么
node scaffold.mjs --update <repo> --type <type>            # 实际执行

# 2. 行为：
#    - 仓库缺失的文件（如 AGENTS.md）→ ADDED 直拷
#    - 仓库已有且与模板不同 → .scaffold-merge/ 人工评审区（不覆盖你的内容）
#    - 工作区必须 clean（先 commit/stash）
# 3. 补齐后重跑审计确认
node repo-audit.mjs --repo <repo> --format json
```

要点：
- `--update` 对**从未被 scaffold 管理的仓**同样可用（自动 adopt，建立 `.scaffold/lock/`）
- 手写 AGENTS.md 时，**按来源声明二选一**：无 lock 的仓删除「单源拼装」行、保留「自主维护」行（模板头部已内置两种措辞）
- `--skip <path>` 可排除不想让模板接管的文件（可多次）

### 4.3 模板升级后校验

```bash
# 1. 审计当前状态
node repo-audit.mjs --repo <repo> --format json --output ./audit-before

# 2. 跑 scaffold update
node scaffold.mjs --update <repo>

# 3. 再次审计
node repo-audit.mjs --repo <repo> --format json --output ./audit-after

# 4. 对比
before=$(cat ./audit-before/report.json | jq '.summary')
after=$(cat ./audit-after/report.json | jq '.summary')
# 如果 after.critical > before.critical → 告警：模板升级引入了问题
```

### 4.4 CI 门禁集成

```yaml
# GitHub Actions 示例
- name: Audit repo
  run: |
    node repo-audit.mjs --repo . --strict --format json --output ./.ci-audit
    echo "Score: $(jq '.summary | 100 - (.critical * 25) - (.major * 10) - (.minor * 3)' ./.ci-audit/report.json)"
```

### 4.5 增量维度审计

```bash
# 只审计安全（快速）
node repo-audit.mjs --dim security --format json

# 只审计文档
node repo-audit.mjs --dim docs --format json

# 审计所有工程类维度
node repo-audit.mjs --dim git --dim docs --dim security --dim quality --format json
```

### 4.6 自定义规则叠加

```bash
# 创建自定义规则
cat > /tmp/my-rules.yaml << 'EOF'
rules:
  - id: CUSTOM-001
    title: "检查特定文件存在"
    severity: minor
    domain: custom
    applies_to: ["*"]
    check: file_exists
    params:
      paths: ["SPECIAL_FILE.md"]
    description: "项目需要 SPECIAL_FILE.md"
EOF

# 叠加运行
node repo-audit.mjs --repo /path/to/repo --rules /tmp/my-rules.yaml --format json
```

---

## 五、错误处理协议

### 5.4 GIT-004 非 scaffold 仓豁免

`GIT-004` 检查 `.scaffold/lock/manifest.json` 是否存在。对**从未被 scaffold 管理的仓库**（如 monorepo subtree split 迁出的仓），工具会自动识别父目录 `.scaffold` 不存在并记 `pass`（evidence 提示「非 scaffold 管理仓，豁免」）。Agent 无需特殊处理，视为正常通过即可。

### 5.1 非 git 仓库（exit 3）

```bash
# 检测
if ! git -C <repo> rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: <repo> is not a git repository"
  exit 3
fi
```

### 5.2 LLM 不可用时

LLM 未配置时工具自动降级为纯规则模式，不影响结果完整性。Agent 不应将其视为错误：

```bash
# 检查 LLM 是否启用
if [ -z "$LLM_API_KEY" ]; then
  echo "INFO: LLM not configured, running in rule-only mode"
fi
```

### 5.3 参数错误（exit 2）

```bash
# 捕获 stderr
output=$(node repo-audit.mjs --repo <repo> 2>&1)
exit_code=$?
if [ $exit_code -eq 2 ]; then
  echo "ERROR: $output"
  # 打印帮助
  node repo-audit.mjs --help
fi
```

### 5.4 规则加载失败

如果自定义规则文件不存在或格式错误，工具会输出警告并继续（只加载成功的规则）。

### 5.5 Windows 调用形态（v1.3.2 起）

v1.3.2 修复了 v1.3.1 在 Windows 上 CLI 全形态静默不执行的回归（Issue#4）。Agent 在 Windows 上的注意事项：

- 入口守卫已跨平台归一化（`pathToFileURL`），`node repo-audit.mjs` / npm bin / shim 全形态可用
- `command`/`command_result` 检查（GIT-001/GIT-003/QUA-002）自动探测 Git for Windows bash；未装 Git for Windows 时这些项降级 fail，其余规则正常
- 守卫不命中时 stderr 有 `ℹ 未作为 CLI 入口执行` 诊断提示——若审计"成功"但 0 规则输出，先查 stderr 这一行

---

## 六、性能参考

| 指标 | 值 |
|---|---|
| 规则检查（28 条） | ~50ms |
| LLM 增强（5 条 fail） | ~5-15s（取决于网络和模型）|
| 大仓（2000+ 文件）grep 扫描 | ~200-500ms |
| 总耗时（无 LLM） | <100ms |
| 总耗时（有 LLM） | <20s |

---

## 七、Agent 决策树

```
接收任务：审计仓库 <path>
  │
  ├─ 检查是否是 git 仓库 ── 否 ──→ 报错 exit 3
  │
  ├─ 自动检测分类 ── 置信度低 ──→ 询问用户或强制 --type
  │
  ├─ 加载规则 ── 内置 + 自定义 ──→ 按 applies_to 过滤
  │
  ├─ 执行规则检查 ── 全量覆盖 ──→ 生成 findings
  │
  ├─ 检查 LLM 配置 ── 有 ──→ 对 fail 发现做增强（最多 5 条）
  │                          ── 无 ──→ 跳过
  │
  ├─ 生成报告 ── JSON + Markdown ──→ 写入 <output>/
  │
  └─ 输出摘要 + 退出码
       ├─ exit 0 ──→ 通过
       ├─ exit 1 ──→ 有 Critical/Major，报告详情
       └─ exit 2/3 ──→ 报错
```

---

## 八、操作授权与完成路径

### 8.1 权限需求

`repo-audit` 是**纯只读工具**，Agent 无需任何写权限即可执行。

| 操作 | 权限 | Agent 行为 |
|---|---|---|
| 读仓库 | 读权限 | 直接执行，无需确认 |
| 写报告 | 输出目录写权限 | 自动创建 `mkdir -p` |
| LLM 调用 | `LLM_API_KEY` | 环境变量已配置才启用 |
| CI 集成 | GitHub OIDC | 已在 workflow permissions 中配置 |

### 8.2 执行路径（Agent 视角）

```
Agent 接收审计任务
  │
  ├─ ① 参数构建
  │     ├─ repo 路径来自任务参数
  │     ├─ type 优先用参数，否则自动推断
  │     └─ format 默认 json（机器可读）
  │
  ├─ ② 执行命令
  │     cmd = `node repo-audit.mjs --repo <path> --format json [--strict] [--dim <dims>]`
  │     timeout = 30s（无 LLM）/ 120s（有 LLM）
  │
  ├─ ③ 结果解析
  │     ├─ exit 0 ──→ 审计通过，解析 summary
  │     ├─ exit 1 ──→ 有 Critical/Major，提取 fail findings
  │     ├─ exit 2 ──→ 参数错误，检查 stderr 修正后重试
  │     └─ exit 3 ──→ 非 git 仓，报告错误不重试
  │
  ├─ ④ 行动决策
  │     ├─ exit 0 ──→ 记录评分，返回结果
  │     ├─ exit 1 + strict ──→ 告警调用方，附 findings 详情
  │     └─ LLM 增强成功 ──→ 附加 llm_analysis 给调用方
  │
  └─ ⑤ 完成
        ├─ 报告文件已写入 <output>/report.json
        ├─ stdout 摘要已捕获
        └─ 返回结构化结果给调用方
```

### 8.3 Agent 标准调用模板

```python
# 伪代码：Agent 调用 repo-audit
def audit_repo(repo_path: str, strict: bool = False, dims: list[str] = None) -> dict:
    cmd = [
        "node", "repo-audit.mjs",
        "--repo", repo_path,
        "--format", "json",
        "--output", f"{repo_path}/.audit/{timestamp}"
    ]
    if strict:
        cmd.append("--strict")
    if dims:
        for d in dims:
            cmd.extend(["--dim", d])

    result = run_command(cmd, timeout=120)

    if result.exit_code == 0:
        return {"status": "pass", "score": calculate_score(result.json)}
    elif result.exit_code == 1:
        return {"status": "fail", "findings": result.json["findings"], "score": calculate_score(result.json)}
    elif result.exit_code == 3:
        return {"status": "error", "reason": "not_git", "repo": repo_path}
    else:
        return {"status": "error", "reason": "runtime", "stderr": result.stderr}
```

### 8.4 完成判定（Agent）

| 指标 | 通过条件 |
|---|---|
| exit code | `0` 或 `1`（可接受，有报告）|
| 报告文件 | `<output>/report.json` 存在且可解析 |
| 关键发现 | `critical == 0` 且 `major < 3`（可配置）|
| 耗时 | `< 30s`（无 LLM）/ `< 120s`（有 LLM）|

### 8.5 异常处理路径

| 异常 | Agent 行为 |
|---|---|
| 参数错误 (exit 2) | 检查 stderr → 修正参数 → 最多重试 1 次 |
| 非 git 仓 (exit 3) | 报告错误，不重试，标记仓库状态为 "invalid" |
| LLM 超时/失败 | 静默降级为纯规则模式，结果仍然完整 |
| 输出目录不可写 | 尝试父目录 → 再尝试 /tmp → 报告错误 |
| 规则文件缺失 (--rules) | 警告跳过该规则文件，继续审计 |

---

## 九、快速参考卡

```bash
# 最常见用法
node repo-audit.mjs --repo <path> --format json

# CI 门禁
node repo-audit.mjs --repo <path> --strict --format json

# Agent 批量审计（多仓库）
for repo in $(find /path -maxdepth 2 -name ".git" -type d | xargs dirname); do
  node repo-audit.mjs --repo "$repo" --format json --output "$repo/.audit/" 2>/dev/null &
done
wait
```

# 快速文档审计
node repo-audit.mjs --repo <path> --dim docs

# 带 LLM 增强（任意 OpenAI 兼容厂商/平台）
LLM_PROVIDER=openai LLM_BASE_URL=https://api.deepseek.com LLM_MODEL=deepseek-chat LLM_API_KEY=sk-xxx \
  node repo-audit.mjs --repo <path> --format both

# OpenRouter 聚合平台
LLM_PROVIDER=openrouter LLM_BASE_URL=https://openrouter.ai/api/v1 LLM_MODEL=deepseek/deepseek-chat LLM_API_KEY=sk-or-v1-xxx \
  node repo-audit.mjs --repo <path> --format both

# 本地 Ollama
LLM_PROVIDER=openai LLM_BASE_URL=http://localhost:11434/v1 LLM_MODEL=deepseek-r1:8b LLM_API_KEY=ollama \
  node repo-audit.mjs --repo <path> --format both

# 仅看 fail 项
node repo-audit.mjs --repo <path> --format json \
  | jq '.findings[] | select(.status=="fail") | "\(.id) [\(.severity)]: \(.title)"'
```

---

## 十、反馈通道

### 10.1 Agent 检测协议

Agent 可通过 GitHub Issues API 检测用户反馈：

```bash
# 列出未处理的反馈（label: audit-feedback + state: open）
gh issue list --repo NinjaSln-labs/repo-audit --label audit-feedback --state open --json number,title,createdAt,body

# 获取单条反馈详情
gh issue view <NUMBER> --repo NinjaSln-labs/repo-audit --json title,body,labels,createdAt

# 反馈已处理，关闭 Issue
gh issue close <NUMBER> --repo NinjaSln-labs/repo-audit --comment "已处理：[处理说明]"
```

**标签语义**：
- `audit-feedback` — 所有工具反馈（Agent 过滤条件）
- `feedback` — 通用反馈（与 audit-feedback 同时存在）
- `bug` — Bug 报告
- `enhancement` — 功能建议
- `documentation` — 文档问题

### 10.2 Agent 创建反馈

Agent 可通过 CLI 或 API 创建反馈 Issue：

```bash
# CLI 方式（自动预填环境信息）
node repo-audit.mjs --feedback "在 xxx 场景下出现 yyy 问题"

# API 方式（更灵活）
gh issue create --repo NinjaSln-labs/repo-audit \
  --title "Feedback: <简要标题>" \
  --body "<Markdown 正文>" \
  --label "feedback,audit-feedback"
```

### 10.3 反馈处理流程

```
用户反馈 → audit-feedback label → Agent 检测 → 分类处理 → 关闭 Issue
    ↓                                    ↓
GitHub Issues                    修复 / 文档 / 不采纳
```

**处理优先级**：
1. `critical` — 工具崩溃/数据损坏（24h 内响应）
2. `major` — 功能严重受损（72h 内响应）
3. `minor` — 功能部分受损（1 周内响应）
4. `info` — 建议改进（排期处理）

*Agent 操作手册 v1.3.2 · 2026-09-07（§5.5 Windows 调用形态；v1.3.2 修复 Windows 入口回归 Issue#4）*
