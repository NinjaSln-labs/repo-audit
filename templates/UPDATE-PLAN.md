# 更新模式实施方案 v1.0（基于 23 仓实况的最终方案）

> 前置：UPDATE-MODEL.md v2.1（机制设计定稿：值位状态机 / .scaffold/lock / 双门禁 / 自动 commit 回滚点）。
> 本文件回答两个问题：**哪些仓库真正需要 update、分别以什么策略接入**；**实施切分与顺序**。
> 原则（用户裁决）：无缝直接 update、无需人工确认（门禁+回滚兜底）、改动记录可回滚、**零触碰存量内容**。

## 1. 23 仓实况盘点 → update 需求分层

### 第一梯队：A 类 dsh 插件单库 ×6（最大受益者）

| 仓库 | AGENTS | SECURITY | CI | 差距 |
|---|---|---|---|---|
| dsh-context-compass | ✓ | ✓ | ✗（有 publish 无 ci） | 差 ci.yml + 双语 README.en 状态/非目标节 |
| dsh-subagent-router | ✓ | ✓ | ✗ | 同上 |
| dsh-imgdraw | ✓ | ✓ | ✗ | 同上 + AGENTS 部署纪律已自洽（与模板 core 高重合，**可安全快进**） |
| dsh-knowledge-sqlite | ✓ | ✗ | ✗ | 差 SECURITY/CI/ci + 双语 |
| dsh-session-slm-router | ✓ | ✓ | ✗ | 同 context-compass |
| dsh-subagent-cursor | ✓ | ✓ | ✗ | 同上 |

**关键实况**：六库 AGENTS 均为部署纪律成文（与模板 dsh append 高重合）；四库已有 README.en。
**结论：这 6 库是 update 机制的首批真实用户——首次 adopt（lock 建立快照）后，差距文件（ci.yml/
SECURITY/双语增量）以 ADDED 为主，冲突面小，正好验证状态机。**

### 第二梯队：C/D 类 Python/Go ×5（受益者）

| 仓库 | 现状 | 差距 |
|---|---|---|
| chumen | pyproject+src/tests，零治理文件 | AGENTS/CONTRIBUTING/PUBLISHING/verify.py/CI 全新接入——**纯 ADDED，最顺** |
| shisui | pyproject，有 CI（形态待比对） | AGENTS/PUBLISHING 全新；CI 走已修改→merge 路径 |
| shuijing-v2 | pyproject+Dockerfile | 同上 |
| vertical-small-model | adapters/lib/tests | 同上 |
| jinteng | go.mod+Makefile（无 verify target） | AGENTS/CONTRIBUTING/PUBLISHING 全新；Makefile 走 merge |

### 第三梯队：B 类产品库 ×4（overlay，次优先）

qingfu-envoy / neonforge / fuyao-nomad / Voyage——已有自己的 CONTRIBUTING/CHANGELOG/ROADMAP 成文
（形态成熟），**overlay 叠加走 .scaffold-merge/ 全程人工比对**，不急。

### 第四梯队：E 类沙盒 ×11 / F 类内容 ×2 / G 存档 ×1

- E/F：13 仓均**无治理文件**——接入即纯 ADDED，但价值低（最小集本就自洽），按需
- G（dsh-plugins）：**永不接入**（封版纪律）

## 2. 分阶段实施顺序

### 阶段 1：机制实现（scaffold --update 核心）
1. `generate(dir)` 提取复用（跳过 git init）
2. `loadLock/saveLock` + adopt 模式（首次只建快照+缺失直拷）
3. `compare()` 状态机 + `threeWay()`（git merge-file -p --diff3 --histogram）
4. `commitAndRecord`（clean 前置/自动 commit/last-update.json）+ `--rollback`
5. `verifyGate`（复用各分类 verify 链）+ marker 检查双门禁 + QUARANTINED
6. `detectMeta()`（name/desc/org 自动探测）+ `--dry-run`/`--skip`/check-update

### 阶段 2：首批真实用户灰度（A 类 6 库）
1. **试点**：dsh-imgdraw（差距最小：AGENTS 可快进 + ci.yml/SECURITY 增量为 ADDED）
2. 试点验证点：adopt 快照建立 → 二次 update 空跑（应全部 UNCHANGED）→ 改模板 append 后
   update（应 FAST-FORWARD）→ 手改产物 AGENTS 后 update（应走 merge/AGENT-RESOLVE）
3. 试点通过 → 推广至其余 5 库

### 阶段 3：C/D 类接入（chumen 试点 → shisui/shuijing/vsm/jinteng）

### 阶段 4：B 类 overlay（按需，不急）／E/F 按需

## 3. 守卫与回滚（落地即配）

- 首次 adopt commit 后，`.scaffold/lock/` 入库（回滚连带状态）
- pre-commit 三份模板补 `check-merge-conflict` 段（N 系列审计遗留）
- 每次自动 commit message 固定 `chore(scaffold): update template files`——`git log --grep` 可
  枚举全部 update；`git revert` 单次回滚
- `--dry-run`（只报告）作为人工 review 入口

## 4. 风险与对策

| 风险 | 对策 |
|---|---|
| 存量 AGENTS 与模板 append 语义重叠（A 类六库已自成文） | adopt 模式：快照后首次 update 仅 ADDED + merge 区；冲突走 AGENT-RESOLVE+门禁 |
| 中文档案是 LLM 裁决弱项 | 裁决 prompt 内置"保留中文原文"约束 + marker 双门禁 |
| 模板升级本身引入错误 | 分类验证链门禁（ADDED/FAST-FORWARD 也过 verify） |
| 用户手改产物文档（README 状态节等） | lock 基线判定 ours≠base → 三方合并/agent，不盲覆盖 |
