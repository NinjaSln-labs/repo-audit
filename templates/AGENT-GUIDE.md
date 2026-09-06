# scaffold init/update 操作手册（agent 用）

## §A 开始之前

### 1. 适用对象与前提

- 使用对象：AI coding agent（DSH agent、Claude Code、Copilot 等以编程方式调用 scaffold 的场景）。人也可以参考，但本手册假设调用方是 agent——所有输出都可 grep/parse，所有异常都有明确退出码。
- 前置条件：git 可用；node 可用（≥18）；模板集路径可达。
- 反馈路径（绝对路径，写反馈前先确认可达）：
  `./feedback/`
- 参考文档：[UPDATE-MODEL.md](UPDATE-MODEL.md)（机制设计）· [UPDATE-PLAN.md](UPDATE-PLAN.md)（分阶段实施）

### 2. 速查

```sh
S="/path/to/templates/scaffold.mjs"

# 新建仓库（五分类 + overlay）
node $S --type <分类> --name <短名> --org <org> --desc "<一句话>" --target <目录>

# 更新已有仓库（自动探测元数据；可显式覆盖）
node $S --update <仓库路径> [--type <分类>] [--name/--org/--desc/--legal/--surface ...]

# 预览（不写任何文件）
node $S --update <仓库路径> --dry-run

# 回滚最近一次 update
node $S --rollback <仓库路径>
```

### 3. 分类选择

| --type | 适用 | 产物 |
|---|---|---|
| `dsh-plugin`（默认） | dsh 宿主插件 | TS 骨架 + npm 发布链 + 部署纪律 |
| `python-app` | Python 应用/研究 | pyproject + PyPI TP 发布链 |
| `go-service` | Go 服务 | Makefile + GoReleaser 发布链 |
| `sandbox` | 本地实验/dogfood | 最小集（无 CI/发布） |
| `content` | 内容/写作 | 最小集（正文 + review 分离） |
| + `--overlay product-oss` | 上述任一 + 多人协作 | 额外叠加 release-please/PR/issue/CODEOWNERS/dependabot |

判断规则：写代码挂到 dsh 宿主 → dsh-plugin；pyproject 项目 → python-app；go.mod → go-service；一次性实验 → sandbox；文档即制品 → content；会多人协作 → 加 `--overlay product-oss`。

## §B 操作

### 4. init（新建仓库）操作流程

#### 步骤 1：契约预检（写代码之前）

1. `cordis_inspect_list` / `cordis_inspect_query` 查清用到的 Service/Event/Builtin/Slot 精确签名——**不猜 API**
2. 记录宿主包清单 → 决定 package.json peer/devDeps
3. 确认分类：host half only 还是 host+client 双 half（影响 dsh.client.inject 与 build-client.mjs）

#### 步骤 2：出库

```sh
node $S --type dsh-plugin --name myplugin --org NinjaSln-labs \
  --desc "一句话描述" --surface "宿主能力面" --target /path/to/dsh-myplugin
```

- `--name` 不带 dsh- 前缀（自动剥除并告警）；包名/仓库名派生为 `dsh-<name>`
- 产物：全套治理文件（AGENTS/README×2/CONTRIBUTING/DEVELOPMENT/PUBLISHING/SECURITY/LICENSE/CLAUDE.md/.gitignore）+ 工程骨架（package.json/tsconfig/src/scripts/.github/.githooks）
- git init + hooksPath 自动完成

#### 步骤 3：按产物 AGENTS.md 与 TODO 清单执行

出库末尾打印分类专属 TODO（含精确命令）。关键必做项：

1. package.json 填 peer/devDeps（占位符不是合法包名，直接 install 会报 EINVALIDPACKAGENAME）——**dsh-plugin 专属**
2. `npm install --legacy-peer-deps` → `package-lock.json` **必须入库**——**dsh-plugin 专属**
3. `npm run build` → `dsh plugin --profile web install`（file: 接线）→ `npm run check:deploy`——**dsh-plugin 专属**
4. workflow 的 `<commit-SHA>`：从参照库（dsh-context-compass）同名文件抄当前锁定值
5. GitHub 建库：`gh repo create <org>/<repo> --public --source . --description "..." --push`
6. **所有分类通用：出库后必须 `git add -A && git commit`**（工作区脏会阻塞后续 update；pre-commit 钩子因工具链缺失 FAIL 时可用 `--no-verify` 应急）

#### init 后的验证清单（agent 自检，全绿才算完成）

```sh
cd <产物目录>
grep -rn '模板说明' . --include='*.md' | wc -l        # 期望 0
# 依赖占位检查：dsh-plugin 查 package.json；python-app 查 pyproject.toml；go-service 查 go.mod
# 期望 0（依赖占位已填）
# 验证链按分类：dsh-plugin=node scripts/verify.mjs / python-app=python3 scripts/verify.py / go-service=make verify
# （期望"验证链全绿"或 SKIP——工具未装时 exit 2 不阻塞）
git add -A && git commit                              # init 产物必须 commit（否则 update 的 clean 检查拒绝）
```

### 5. update（已有仓库）操作流程

#### 何时用 update

> **硬性要求：update 时始终显式传 `--type <分类>`**——不传时 lock.template 优先（二次 update 安全），
> 但首次 adopt（无 lock）会 fallback 为 dsh-plugin，可能对非 dsh 仓库产生错误分类的文件。



- 存量仓库要接入模板治理（首次 adopt）
- 已接入的仓库要吸收模板升级（lock 存在时全自动）
- 仓库缺失模板管辖文件（CI/hooks/AGENTS 等）需要补齐

#### 首次 update（adopt 模式）——仓库无 .scaffold/lock/ 时

```sh
# 先 dry-run 看会改什么（不写任何文件）
node $S --update /path/to/repo --type <分类> --dry-run

# 确认后正式执行
node $S --update /path/to/repo --type <分类>
```

**adopt 行为**：

- 建立状态层：`.scaffold/lock/`（base 快照 + manifest）+ `last-update.json`
- 仓库**缺失**的模板文件 → ADDED 直拷（写仓库）
- 仓库**已有**的文件 → 不覆盖！模板版写入 `.scaffold-merge/<相对路径>` 供比对采纳
- git 自动 commit（回滚点）+ `.gitignore` 增补过程目录

**agent 必做的 adopt 收尾**：

1. 逐个查看 `.scaffold-merge/` 的 diff（`diff <仓库文件> <merge文件>`），决定采纳策略
2. 采纳 = 用模板版覆盖仓库文件（或人工合并两边内容）
3. `git add -A && git commit`（收口 adopt，否则下次 update 会被 clean 检查拒绝）
4. 确认 `.scaffold/lock/` 已入库（回滚连带状态）

#### 后续 update（lock 存在时）——全自动

```sh
node $S --update /path/to/repo
```

**状态机**（对每个模板管辖文件）：

| 判定 | 处置 | agent 需要做 |
|---|---|---|
| 仓库缺失 | ADDED 直拷 | 无（自动 commit） |
| ours == lock.base | FAST-FORWARD 采纳模板新版 | 无（自动 commit）——用户未改过，安全 |
| 模板未变 | UNCHANGED 保持 | 无 |
| ours ≠ base ≠ new | 三方合并（git merge-file --zdiff3）| 见下方冲突处理 |

**冲突处理（QUARANTINED）**：三方合并无法自动解决时，冲突文件（含 zdiff3 markers）落盘到 `.scaffold/conflicts/<路径>.rej`，不阻塞其他文件。

agent 裁决步骤：

1. 读 `.rej` 文件（zdiff3 格式：current/base/template 三段）
2. 结合上下文决定保留/合并——**保留用户已填的占位值与自定义段，吸收模板新条款**
3. 把裁决结果写回仓库文件（替换含 markers 的原文件）
4. `git add -A && git commit`
5. 删除 `.scaffold/conflicts/` 对应文件
6. 下次 update 该文件将走 UNCHANGED 或正常合并（lock 已吸收裁决）

#### update 后收口（agent 必做）

- 全部 UNCHANGED/FAST-FORWARD/MERGED-CLEAN → 工具已自动 commit，无需操作
- 有 MERGE-REVIEW → 查看 .scaffold-merge/ 并采纳（或忽略），然后 `git add -A && git commit`
- 有 QUARANTINED → 按"冲突裁决 6 步"处理，然后 commit + 删 .scaffold/conflicts/
- **update 后不收口会阻塞下一次 update**（clean 检查拒绝）

#### update 输出解读

每个文件的状态标记：

| 标记 | 含义 | agent 动作 |
|---|---|---|
| `ADDED` | 新文件已写入 | 无 |
| `FAST-FORWARD` | 仓库未改→采纳模板新版 | 无 |
| `UNCHANGED` | 与模板一致或模板未变 | 无 |
| `MERGED-CLEAN` | 三方合并干净 | 无 |
| `MERGE-REVIEW` | adopt 首见差异→.scaffold-merge/ | **人工/agent 比对采纳** |
| `QUARANTINED` | 三方合并冲突→.scaffold/conflicts/ | **agent 裁决（见上）** |
| `SKIP` | 用户在 --skip 清单中 | 无 |

#### update 后的验证清单（agent 自检）

```sh
cd <仓库>
# 按分类选验证链：dsh-plugin=node scripts/verify.mjs / python-app=python3 scripts/verify.py / go-service=make verify
git status --porcelain | wc -l                 # 期望 0（全部已 commit）
grep -rn '<<<<<<<\|>>>>>>>' <管辖文件> 2>/dev/null | wc -l  # 期望 0（无残留 marker）
test -f .scaffold/lock/manifest.json && echo "lock ✓"
test -f .scaffold/last-update.json && echo "更新记录 ✓"
```

#### 各分类自动探测源差异（update 模式元数据探测）

| 分类 | name 来源 | desc 来源 | org 来源 | 限制 |
|---|---|---|---|---|
| dsh-plugin | package.json（剥 dsh-）→ 目录名 | package.json description | git remote origin | 探测最完整 |
| python-app | pyproject.toml name → 目录名 | pyproject description | git remote origin | 需显式传 desc（探测可能为空） |
| go-service | 目录名 | **无自动探测**（必须显式传 --desc） | git remote origin | 需显式传 --desc/--surface |
| sandbox/content | 目录名 | **无自动探测** | 默认 NinjaSln-labs | 最小集，建议全显式传参 |

#### update 后收口（agent 必做）

- 全部 UNCHANGED/FAST-FORWARD/MERGED-CLEAN → 工具已自动 commit，无需操作
- 有 MERGE-REVIEW → 查看 .scaffold-merge/ 并采纳（或忽略），然后 `git add -A && git commit`
- 有 QUARANTINED → 按"冲突裁决 6 步"处理，然后 commit + 删 .scaffold/conflicts/
- **update 后不收口会阻塞下一次 update**（clean 检查拒绝）

## §C 安全网

### 6. 使用前备份（agent 必做）

> 实测覆盖不可能穷尽所有仓库状态；使用反馈尚不足以确认所有边界安全。**update 前的备份是 agent 的责任，不是工具的责任。**

#### update 前必须做的备份（按仓库状态选择）

| 仓库状态 | 备份命令 | 恢复方式 |
|---|---|---|
| **git 仓且工作区 clean**（标准场景） | 无需额外备份——前置 clean + 自动 commit 已构成回滚点 | `git revert <sha>` 或 `git reset --hard <preUpdateHEAD>` |
| **git 仓但有未提交改动** | `git stash push -m "scaffold update 前备份"`（update 拒绝 dirty，先 stash 后再跑） | `git stash pop` |
| **非 git 目录** | `cp -r <目录> <目录>.bak.<日期>` | `rm -rf <目录> && mv <目录>.bak.<日期> <目录>` |
| **不确定 / 首次接触该仓** | `git tag scaffold-pre-update-$(date +%s)` + `cp -r <目录> <目录>.bak.<日期>` | tag: `git reset --hard <tag>`；目录：同上 |

#### agent 备份自检（update 前逐条过）

1. `git status --porcelain` 是否为空？→ 空则安全（git 可回滚）
2. 仓库是否有 `.scaffold/lock/`？→ 有则走自动模式（比 adopt 安全）
3. 仓库是否有大量非模板管辖的自定义文件？→ 有则**额外** `cp -r` 目录备份
4. 是否为首次接触该仓库？→ 是则**额外** `cp -r` 目录备份（不信任探测结果）

#### 备份完成后才允许调用 update

```sh
# 标准场景（git clean）：跳过额外备份
node $S --update <仓库路径>

# 非标准场景（有自定义内容 / 首次接触）：先备份
cp -r <仓库目录> <仓库目录>.bak.$(date +%Y%m%d%H%M%S)
# 确认备份存在后才执行 update
ls <仓库目录>.bak.* >/dev/null && node $S --update <仓库路径>
```

### 7. 回滚

```sh
node $S --rollback /path/to/repo
# 等价于：git reset --hard <preUpdateHEAD>（回到 update 前状态）
```

前置：工作区必须 clean。回滚后审计历史保留（revert 生成新 commit；update 的 last-update.json 记录 preUpdateHEAD）。
紧急情况（revert 失败）：`git reset --hard <preUpdateHEAD>`（last-update.json 有记录）。

#### 回滚能力边界（agent 必知）

| 能力 | 机制 | 限制 |
|---|---|---|
| 撤销最近一次 update 的全部改动 | `--rollback`（git reset --hard preUpdateHEAD） | **只保留最近一次**（last-update.json 每次覆盖） |
| 回到 update 前的精确状态 | `git reset --hard <preUpdateHEAD>` | 同上；且会连 lock 一起回退 |
| 撤销最近一次 update 的全部改动 | `--rollback`（git reset --hard preUpdateHEAD） | **只保留最近一次**（last-update.json 每次覆盖） |
| 回到 update 前的精确状态 | `git reset --hard <preUpdateHEAD>` | 同上；且会连 lock 一起回退 |
| 恢复单个文件 | `git log --oneline -- <file>` 找到 commit → `git checkout <sha> -- <file>` | 手动操作（**不要用 last-update.json 的 commitSha**——amend 后 SHA 可能变化） |
| 两次前的 update | 不支持（lock 只有一层） | 如需多次回滚：update 前手动打 tag |
| 恢复"update 前工作区未提交改动" | 不存在此场景 | update 前置 clean 检查已保证 |

**不是备份系统**：`--rollback` = git reset --hard preUpdateHEAD（回到 update 前状态），不是文件快照恢复。update 的安全模型 = 前置 clean + 自动 commit（回滚点）+ revert（撤销）。多次 update 需多次回滚时，建议 update 前手动打 tag（`git tag pre-update-<N>`）。

## §D 排障

### 8. 异常与退出码

| 退出码 | 场景 | agent 处置 |
|---|---|---|
| 0 | 成功 | 按 TODO/report 继续 |
| 1 | 拒绝执行（非 git 仓/脏工作区/lock 损坏/未知旗标/参数缺失） | 读 stderr 修复调用条件后重试 |
| 2 | verify.py 工具未安装（SKIP 语义） | 不阻塞 update；建议 `pip install -e ".[dev]"` 后重跑 |
| 129 | git merge-file usage 错误 | 更新模式下自动降级 MERGE-REVIEW；如复现报 issue |

### 9. 注意事项（硬性）

1. **不要手改 `.scaffold/lock/`**：manifest/base 是三方合并的 base，手改会欺骗算法
2. **不要手改 `last-update.json`**：rollback 依赖它
3. **不要把 `.scaffold/lock/` 加入 .gitignore**：lock 必须入库（Copier/buf 惯例）
4. **update 前必须 commit/stash**：工作区不干净时拒绝执行（回滚点唯一性）
5. **每次 update 后立即 commit**：未 commit 状态会阻塞下一次 update
6. **非模板管辖文件 update 永远不碰**：src 实现、data、用户手写文件不在管辖集内
7. **`--skip <path>` 让文件退出自动更新域**：对"这个文件我手管"的文件使用（可多次）
8. **update 前做备份（见 §C"使用前备份"）**：实测覆盖不可能穷尽，agent 自己兜底
9. **lock 损坏（非法 JSON）→ 自动降级为 adopt 模式**：仍安全，但失去三方合并能力；修复=删除 .scaffold/lock/ 后重跑 update 重建快照
10. **类型不可中途切换**：update 时 --type 与 lock.template 不一致会被拒绝；切换分类需删 .scaffold/lock/ 重新 adopt

## §E 参考

### 10. 完整参数参考

```
--type <分类>          分类（默认 dsh-plugin）
--name <短名>          名称（不带 dsh- 前缀，自动剥除+告警）
--org <org>            GitHub 组织（默认 NinjaSln-labs）
--desc "<一句话>"      一句话描述（与 GitHub about 一致）
--surface "<能力面>"   宿主能力面（默认=desc）
--legal "<版权主体>"   LICENSE 版权行（默认=org）
--target <目录>        目标目录（generate 模式；默认 ../dsh-<name>）
--force                空目录复用（含 .git 时仍拒绝）
--update <仓库路径>    更新模式（自动探测元数据）
--overlay <名>         叠加 overlay（product-oss）
--dry-run              只对比不写文件（update 模式）
--skip <path>          退出自动更新域（update 模式，可多次）
--rollback <仓库路径>  回滚最近一次 update
--help                 帮助
```

### 11. 反馈通道

模板集仍在实测阶段，以下情况请记录并反馈给模板维护者：

| 类型 | 示例 | 反馈内容 |
|---|---|---|
| **误覆盖** | update 后仓库文件内容丢失/被改 | 仓库路径 + .scaffold/lock/manifest.json + 丢失前后的 diff |
| **误判分类** | 某仓库用 A 分类出库但行为不符 | 仓库名 + 使用的 --type + 期望 vs 实际 |
| **merge-file 失败** | exit 129/负数/空输出 | .scaffold/conflicts/ 的 .rej 文件 + stderr |
| **探测错误** | name/desc/org 自动探测结果不对 | 仓库元数据文件（package.json 等）+ 探测输出 |
| **模板内容错误** | 产物中的规范/命令与实际不符 | 具体文件 + 正确做法 |

#### 反馈存放路径（agent 必读）

```
./feedback/
```

#### agent 写反馈的执行步骤

1. **确认路径可达**：`test -d "./feedback/"` → 不存在则 `mkdir -p`
2. **确认可写**：`test -w` 同路径 → 不可写则**用 ask_user 向用户确认正确的反馈存放路径**，不要猜
3. 路径确认后写入：`<feedback路径>/<YYYY-MM-DD>-<主题>.md`

#### 反馈文件内容要求

- 仓库绝对路径
- 使用的完整命令（含全部旗标）
- 期望 vs 实际（附相关文件 diff 或报错原文）
- 如涉及 update：附 .scaffold/lock/manifest.json 快照副本
