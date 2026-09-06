# 更新模式策略方案 v2.1（scaffold --update）——无缝自动 + 记录可回滚

> 状态：**设计定稿，待裁决实施**。v2.1 = v2 骨架 + 两路调研收敛（Copier/update 机制深度调研 +
> agent 冲突裁决学术实证）。依据：① 用户裁决——无缝直接 update、无需人工确认、改动记录、可回滚；
> ② Copier 官方文档（readthedocs.io/en/stable/updating/ 等 5 页）；③ git merge-file 手册（本机 2.43
> 实测：退出码 0=干净合/>0=冲突数）；④ 三篇 arXiv 合并裁决实证（2605.25890 Merge-Bench 等）。

## 0. 设计立场（调研证据决定的三原则）

1. **主路径零冲突**：模板管辖集 = 文档七件套 + 工程件；仓库对它们的典型改动是"按 TODO 填占位"。
   双端都改同一文件的概率低 → 无缝快进是可承诺的主路径（Copier 同款：重放生成→diff→re-apply）。
2. **自动裁决只做机械类；语义类挂确定性验证门禁**：学术实证 LLM 自由裁决正确率 <60%（Merge-Bench，
   7938 真实冲突 hunk），且 agent 自评发现不了结构错误（LLM judge 接受 5 个结构错误解中的 4 个）——
   唯一可靠门禁是 parser/lint/build。**证据支持的姿势 = agent 裁决 + 自动验证 + 自动 commit +
   事后可 review 可 revert**（用户"无需人工确认"由门禁与回滚兜底，而非跳过验证）。
3. **可回滚 = git 自动 commit，不发明备份系统**：clean tree → update → `git add -A && git commit`
   （消息含模板版本）→ `git revert` 即回滚。官方语义：revert 硬性要求工作区 clean——前置检查因此
   不是习惯而是回滚语义的充分条件。不碰 `reset --hard`（会吞用户改动）。

## 1. 状态层：`.scaffold/lock/`（入库，Copier answers 惯例）

```
.scaffold/
├── lock/
│   ├── manifest.json     # 模板指纹(版本/分类/参数快照) + 文件 hash 表 + "NEVER EDIT MANUALLY"头注
│   └── base/<file>       # 上次采纳后的文件内容快照（三方合并的 base）
│                         #  ——本模板无 git tag 版本序列，无法学 Copier"重渲染合成 base"，
│                         #    base 快照是目录模板的标准替代（调研 §5：无 tag 必须 lock 快照）
└── last-update.json      # { preUpdateHEAD, commitSha, 模板版本, 文件四态清单 }
```

- **入库**（Copier/buf 惯例）：lock 是 update 状态机输入（丢了只能 recopy）；不入库会让 git
  clean 检查永远失败；回滚 commit 必须包含 lock 才能连状态一起回滚
- 红线同 Copier："**NEVER EDIT MANUALLY**"——手改 lock 会欺骗合并算法
- **gitignore 增补**：`.scaffold-update/`、`.scaffold-merge/`、`.scaffold/conflicts/` 不入库
  （过程产物）；`.scaffold/lock/` 与 `last-update.json` 入库

## 2. 状态机（对模板管辖集逐文件）

base = `lock/base/<file>`（上次采纳快照），new = 模板新输出，ours = 仓库当前：

```
ours 缺失             → ADDED         直接写入 new
ours == base          → FAST-FORWARD  仓库未改 → 直接写入 new          【无缝主路径】
new  == base          → UNCHANGED     模板没变 → 保持 ours
ours ≠ base ≠ new     → git merge-file -p --diff3 --histogram ours base new
    │                   （-p 先出 stdout 不落盘；exit 0=干净 1..127=冲突数）
    ├─ exit 0          → MERGED-CLEAN  写入合并结果
    └─ exit >0         → 分级裁决（§3）
ours 手动接管          → .scaffold-ignore 清单内的文件（openapi-generator-ignore 同款）：
                         从自动更新域退出，仅在报告中提示"模板有更新可选同步"
```

合并选项固定：`-p`（先试合不落盘）+ `--diff3`（冲突块内附 base，易解）+ `--histogram`（官方：
避免"不同函数相同花括号"的 mismerge）+ `-L template@old -L current -L template@new`（可读标签）。

## 3. 冲突分级裁决（学术护栏：机械自动 / agent+双门禁 / 隔离）

> 裁决证据链（三篇 arXiv + 社区实验）：LLM 自由裁决正确率 <60%（Merge-Bench）；
> **结构性正确性绝不能交给 LLM 自评**（LLM judge 放行了 5 个未过结构检查中的 4 个，arXiv
> 2607.27674）；**非英文内容是 LLM 裁决弱项**（大输入截断/空裁决，arXiv 2605.16646）——
> 本模板文档全中文，此项风险↑。故语义冲突的裁决输出**不直接落盘**，必须过双门禁：
> 确定性验证 + 独立 commit 供 review/revert。

| 级 | 判定 | 处置 |
|---|---|---|
| **机械冲突** | 仅单边实质改动（如 ours 只改了 TODO 占位、new 只是模板版本更新）| 规则自动裁决 → 写入 |
| **语义冲突** | 双边都改同一区域 | **AGENT-RESOLVE**：冲突文件（含 markers）+ base/new/ours 三方 + **模板意图说明**（本次模板变更了什么、为什么）打包交 agent 裁决 |
| **验证门禁（硬闸）** | agent 裁决结果 | ① 确定性验证链（verify.mjs / verify.py / make verify，探测式）——失败把错误喂回重试 ≤2（generate-validate-retry，arXiv 2607.27674 设计）；② **marker 残留检查**（结果含 `<<<<<<<` 即失败）——两关全过才写仓库 |
| **QUARANTINED** | 重试仍失败 | `.scaffold/conflicts/<file>.rej` 落盘（Copier rej 模式），不阻塞整体；AGENTS.md 追加待办指向 |
| **中文特别注意** | 裁决 prompt 需显式声明"保留中文原文，译文内容以中文为准"（arXiv 2605.16646：非英文是弱项） | prompt 模板内置此约束 |

**冲突标记防漏门禁**（Copier 官方姿势）：三份 pre-commit 钩子补 `check-merge-conflict` 段——
产物中出现未解决的 `<<<<<<<` 即拒绝提交。

## 4. 流程总览

```
前置：git status --porcelain 必须 clean（Copier 官方要求 + revert 回滚语义前提）
      非干净 → 拒绝并提示 commit/stash
① 生成   generate(.scaffold-update/)  —— 复用现有拼装逻辑（core+append+delta+overlay+占位符）
② 对比   状态机分类（§2）—— 有 lock 走全自动；无 lock 走 adopt 模式（§5）
③ 落位   ADDED/FAST-FORWARD/MERGED-CLEAN/AUTO-RESOLVE → 写仓库
         AGENT-RESOLVE → agent 裁决 + 双门禁（验证链 + marker 检查）→ 写仓库
         QUARANTINED → .scaffold/conflicts/
④ 验证   分类验证链（若存在）全绿
⑤ 记录   git add -A && git commit "chore(scaffold): update template files"
         + 更新 lock/last-update.json（preUpdateHEAD/commitSha/文件四态清单）
         （commit 粒度：AGENT-RESOLVE 的裁决 diff 独立成 commit——与模板快进改动分开，
          便于单独 review/revert；证据：裁决 diff 与用户改动分 commit 是社区共识折中）
⑥ 报告   .scaffold/report.md：四态清单 + agent 裁决说明（每文件保留哪边/为什么/验证结果）
         ——供人事后 review；不满意 = git revert（§回滚）
```

**"无需人工确认"的边界（诚实标注）**：零确认适用于 ADDED/FAST-FORWARD/MERGED-CLEAN/
AUTO-RESOLVE（主路径，绝大多数情况）；AGENT-RESOLVE 与 QUARANTINED 有门禁与回滚兜底但仍属
"低置信自动化"——事后 review report.md 是推荐习惯，语义冲突多的仓库建议 review 后再 push。

## 5. adopt 模式（首次 update，无 lock）

存量库第一次接入：lock 建立快照后，仅「仓库缺失的文件」直拷 +「已存在文件」写 `.scaffold-merge/`
（含 diff）供首轮对齐——**不覆盖任何已有内容**。第二次 update 起全自动（lock 就是 base）。

## 6. 回滚（三条路）

```
git revert HEAD                          # 标准撤销（推荐——留审计历史）
git reset --hard <preUpdateHEAD>         # 彻底回到 update 前（lock 随 commit 一起回退）
scaffold --rollback                      # 读 last-update.json 自动执行 revert
```

## 7. 自动化接口（对齐 Copier 已验证形态）

| 接口 | 说明 |
|---|---|
| `--dry-run` | 只出对比报告不落位（Copier --pretend 同款） |
| `--defaults` | 元数据探测缺省时全部采用默认，不交互 |
| `--skip <path>`（可多次） | 用户接管的文件退出自动更新域（openapi-generator-ignore 同款） |
| check-update | 报告模板管辖集差异统计（退出码区分有无更新） |

## 8. 实现切分（scaffold.mjs）

| 模块 | 内容 | 量级 |
|---|---|---|
| `generate(dir)` | 出库逻辑提取复用（delta/overlay/占位符/TODO） | 小（搬运+参数化） |
| `loadLock()/saveLock()` | base 快照 + manifest（含头注） | 小 |
| `detectMeta()` | name/desc/org 从仓库元数据探测（package.json/pyproject/go.mod/remote） | 中 |
| `compare()` | 状态机分类（§2） | 中 |
| `threeWay()` | git merge-file 封装（-p/--diff3/--histogram/-L + 退出码分流） | 小 |
| `verifyGate()` | 语言验证链（复用 verify.mjs/verify.py/make verify 探测式）+ 重试 | 小 |
| `commitAndRecord()` | clean 检查/自动 commit/last-update.json | 小 |
| `--rollback` | 读 last-update.json 执行 revert | 小 |

## 9. 边界与明确不做（首版）

- 非 git 目录：`--update` 拒绝（回滚依赖 git）
- lock 损坏：降级为 v1 双方向对模式（安全），提示重建 lock
- 工作区不干净：拒绝（回滚点唯一性的前提），提示 commit/stash
- agent 裁决永不触碰：非模板管辖文件（仓库自己的 src 实现/data/用户手写文件）
- `--skip` 清单内的文件：只在报告中提示"模板有更新可选同步"
- QUARANTINED 文件的处理：留给人工（或后续 agent 会话读 `.scaffold/conflicts/` 定向解决）
