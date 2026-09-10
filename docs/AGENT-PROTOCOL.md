---
title: repo-audit Agent Protocol
version: "1.4.1"
audience: agent
format: markdown+metadata
schema: /SCHEMA.json
index: /AGENT-INDEX.json
---

# repo-audit Agent Protocol

> 机器可读的操作协议。Agent 直接执行，无需人类解释。

## 1. 工具身份

```json
{
  "name": "repo-audit",
  "npm": "repo-audit-tool",
  "version": "1.4.1",
  "bin": "repo-audit",
  "language": "JavaScript ESM",
  "runtime": "Node.js >= 18",
  "dependencies": [],
  "license": "MIT",
  "readonly": true
}
```

## 2. 调用协议

### 2.1 基本调用

```
repo-audit [--repo <path>] [--type <type>] [--format <fmt>] [--output <path>]
           [--llm-provider <p>] [--llm-model <m>] [--strict]
           [--rules <file>] [--dim <domain>] [--feedback <msg>]
```

### 2.2 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `--repo` | string | 否 | `.` | 目标仓库路径 |
| `--type` | string | 否 | 自动检测 | 强制指定分类 |
| `--format` | enum | 否 | `both` | `md` / `json` / `both` |
| `--output` | string | 否 | `<repo>/audit-report/` | 输出目录 |
| `--llm-provider` | string | 否 | 环境变量 | LLM 协议 |
| `--llm-model` | string | 否 | 自动 | 模型名称 |
| `--strict` | bool | 否 | `false` | Critical/Major 即 exit 1 |
| `--rules` | string[] | 否 | — | 自定义规则 YAML |
| `--dim` | string[] | 否 | 全部 | 只审计指定维度 |
| `--feedback` | string | 否 | — | 提交反馈 |

### 2.3 退出码

| 码 | 含义 | Agent 应执行 |
|---|---|---|
| 0 | 审计通过 | 正常继续 |
| 1 | Critical/Major 发现 + --strict | 读取 findings 并报告 |
| 2 | 参数错误 | 修正参数后重试 |
| 3 | 目标不是 git 仓库 | 提示用户切换到 git 仓库 |

## 3. 输出格式

### 3.1 JSON 报告结构

```json
{
  "generated_at": "2026-09-06T12:00:00.000Z",
  "audit_type": "dsh-plugin",
  "llm_used": false,
  "metadata": {
    "remote": "https://github.com/org/repo.git",
    "branch": "master",
    "commitCount": 42,
    "fileCount": 117,
    "lastCommit": "2026-09-06 12:00:00 +0800",
    "path": "/path/to/repo"
  },
  "summary": {
    "critical": 0,
    "major": 0,
    "minor": 0,
    "info": 0,
    "pass": 19,
    "total": 19,
    "waived": 0,
    "llmUsed": false
  },
  "findings": [
    {
      "id": "DOC-001",
      "title": "README.md 存在",
      "severity": "critical",
      "domain": "docs",
      "applies_to": ["*"],
      "status": "pass",
      "message": "符合",
      "evidence": "✓ README.md (3.1kB)",
      "hint": null,
      "template_ref": null
    }
  ]
}
```

### 3.2 评分公式

```
score = 100 - (critical × 25) - (major × 10) - (minor × 3)
```

| 等级 | 分数 |
|---|---|
| A | ≥ 90 |
| B | ≥ 80 |
| C | ≥ 70 |
| D | ≥ 60 |
| F | < 60 |

### 3.3 发现状态

| 状态 | 含义 | Agent 处理 |
|---|---|---|
| `pass` | 检查通过 | 忽略 |
| `fail` | 检查失败 | 读取 `message` + `evidence` + `hint` |
| `waived` | 已豁免 | 读取 `waived_reason` + `waived_since` |

### 3.4 严重级别

| 级别 | 扣分 | Agent 优先级 |
|---|---|---|
| `critical` | -25 | P0 — 立即处理 |
| `major` | -10 | P1 — 优先处理 |
| `minor` | -3 | P2 — 正常处理 |
| `info` | 0 | P3 — 参考信息 |

## 4. 标准操作流程

### 4.1 新建仓库后验证

```bash
repo-audit --repo /path/to/new-repo --format json
```

Agent 读取 JSON，检查 `summary.grade`：
- `A` → 通过，报告成功
- `B/C` → 报告需改进项（列出 fail findings）
- `D/F` → 警告，建议修复 critical/major 问题

### 4.2 CI 门禁集成

```yaml
# GitHub Actions 示例
- name: Audit
  run: repo-audit --repo . --format json --strict
```

`--strict` 使 Critical/Major 发现返回 exit 1，自动阻断 CI。

### 4.3 自定义规则

```yaml
# my-rules.yaml
rules:
  - id: COM-001
    title: "提交信息规范"
    severity: major
    domain: git
    applies_to: ["*"]
    check: commit_message
    params:
      pattern: "^(feat|fix|docs|chore|refactor|test):"
```

```bash
repo-audit --repo . --rules my-rules.yaml
```

### 4.4 反馈处理

```bash
# 检测新反馈
gh issue list --repo NinjaSln-labs/repo-audit --label audit-feedback --state open --json number,title,createdAt,body

# 获取详情
gh issue view 42 --repo NinjaSln-labs/repo-audit --json title,body,labels

# 处理完成
gh issue close 42 --repo NinjaSln-labs/repo-audit --comment "已处理：修复了 X 问题"
```

## 5. 错误处理协议

| 错误 | 原因 | Agent 处理 |
|---|---|---|
| `目标不是 git 仓库` | 目录无 `.git/` | 提示 `git init` 或切换到正确路径 |
| `未知参数` | 参数拼写错误 | 检查 `--help` |
| `LLM 增强失败` | API Key 无效/网络问题 | 降级为非 LLM 模式 |
| `规则加载失败` | YAML 语法错误 | 报告错误行，不阻断审计 |
| `分类检测不准` | 文件结构特殊 | 使用 `--type` 强制指定 |

## 6. Agent 决策树

```
收到审计请求
  ├─ 有 --repo 参数？
  │   ├─ 否 → 默认当前目录
  │   └─ 是 → 使用指定路径
  ├─ 有 --format 参数？
  │   ├─ json → 只输出 JSON
  │   ├─ md → 只输出 Markdown
  │   └─ both/默认 → 同时输出
  ├─ 有 LLM 配置？
  │   ├─ 是 → 启用 LLM 增强
  │   └─ 否 → 纯规则审计
  ├─ 执行审计
  ├─ 解析 summary
  │   ├─ grade A → 报告通过
  │   ├─ grade B/C → 报告改进项
  │   └─ grade D/F → 警告严重问题
  └─ 输出结果
```

## 7. 反馈通道

### 7.1 检测协议

```bash
# 列出未处理反馈
gh issue list --repo NinjaSln-labs/repo-audit --label audit-feedback --state open --json number,title,createdAt,body

# 获取详情
gh issue view <NUMBER> --repo NinjaSln-labs/repo-audit --json title,body,labels,createdAt

# 关闭已处理
gh issue close <NUMBER> --repo NinjaSln-labs/repo-audit --comment "已处理：[说明]"
```

### 7.2 创建反馈

```bash
# CLI 方式
node repo-audit.mjs --feedback "在 xxx 场景下出现 yyy 问题"

# API 方式
gh issue create --repo NinjaSln-labs/repo-audit \
  --title "Feedback: <标题>" \
  --body "<正文>" \
  --label "feedback,audit-feedback"
```

### 7.3 处理优先级

| 级别 | SLA | 描述 |
|---|---|---|
| critical | 24h | 工具崩溃/数据损坏 |
| major | 72h | 功能严重受损 |
| minor | 1周 | 功能部分受损 |
| info | 排期 | 建议改进 |

## 8. 快速参考卡

```bash
# 安装
npm install -g repo-audit-tool

# 基本审计
repo-audit --repo /path/to/repo

# JSON 输出
repo-audit --repo /path/to/repo --format json

# 严格模式（CI 用）
repo-audit --repo . --format json --strict

# LLM 增强
LLM_API_KEY=sk-xxx repo-audit --repo . --llm-provider deepseek

# 自定义规则
repo-audit --repo . --rules my-rules.yaml

# 指定维度
repo-audit --repo . --dim security --dim docs

# 生成脚手架
node templates/scaffold.mjs --type dsh-plugin --name my-plugin

# 提交反馈
repo-audit --feedback "问题描述"

# 检测反馈
gh issue list --repo NinjaSln-labs/repo-audit --label audit-feedback --state open
```
