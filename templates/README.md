# 个人仓库模板集（templates/）

> 依据上级目录 `../BEST-PRACTICES.md` 的调研结论整理，dsh 插件基类（repo-root/）
> 以已跑通发布的 `dsh-context-compass` / `dsh-subagent-router` 单库实底文件为蓝本，不是凭空设计。
> 适用两条路线：**A. 从零新建库**（主路线）与 **B. 从 dsh-plugins monorepo 迁移**（增量路线，另见
> `../../DSH-PLUGIN-STANDALONE-MIGRATION.md`）。
> **分类体系**：全仓 23 个 git 仓库按模板差异分 7 类（见 `../REPO-CLASSIFICATION.md`），
> `scaffold.mjs --type <分类>` 路由；`categories/` 为各分类 delta 与说明。

## 分类与脚手架路由

| --type | 分类 | 覆盖仓库（实证数） | 产物 |
|---|---|---|---|
| `dsh-plugin`（默认） | A · dsh 插件单库 | dsh-* 6 库 | repo-root 基类全量 |
| （overlay） | B · 产品/多人 OSS | qingfu-envoy / neonforge / fuyao-nomad / Voyage | 语言基类 + `categories/product-oss/` 叠加（`--overlay product-oss`）：release-please v5 版本晋升自动化 / YAML issue forms / CODEOWNERS / dependabot / dependency-review / SUPPORT.md 升级检查清单 |
| `python-app` | C · Python 应用/研究 | chumen / shisui / shuijing-v2 / vertical-small-model | 基类换 pyproject/verify.py/ruff+pytest CI |
| `go-service` | D · Go 服务 | jinteng | 基类换 Makefile 四件套/go CI |
| `sandbox` | E · 本地实验/dogfood | fuyao-* 11 库 + weather-outfit-assistant | 最小集（README+AGENTS，无 CI/发布） |
| `content` | F · 内容/写作 | rsi-unit-of-evolution / part-time-job | 最小集（正文+review 分离） |
| （不套模板） | G · 存档只读 | dsh-plugins（封版） | 遵守仓内封版纪律 |

```sh
node scaffold.mjs --type python-app --name chumen2 --desc "..."   # 例
```

## 单源原则（AGENTS / CONTRIBUTING / .gitignore / README / DEVELOPMENT / PUBLISHING / SECURITY）

- 共性内容**只存在于 `common/*-core.md` 一份**：
  - `AGENTS-core.md`——概览/提交规范/**「AI 协作守则」7 条**（不猜契约 / 完成的定义 = 验证链全绿 /
    机密红线 / 不静默绕过门禁 / 改动最小化 / 文档同步 / 冲突处理）/ 安全考虑
  - `CONTRIBUTING-core.md` · `gitignore-core.md` · `README-core.md`（标题/简介/文档/贡献/License）
  - `DEVELOPMENT-core.md`（核心循环/Backlog/Sprint 契约预检/DoD 三段/回顾/速查表机制）
  - `PUBLISHING-core.md`（发布状态/版本历史/发布后验证）· `SECURITY-core.md`（通用，无分类差异）
- 分类差异只写 `categories/<type>/*-append.md`（npm/PyPI/GoReleaser 的安装段与发布通道、
  dsh 部署纪律全文等）；scaffold 拼装生成，产物内**不要手改**拼装段
- **双语 README 标配**：各分类均提供 `README.en.md` 模板；语言切换行在 README-core（单源），
  英文镜像回链 `README.md` 并声明中文权威；英文镜像与中文同步更新（DoD 文档项）
- 改规则 → 改 common/append 源 → 重新 scaffold；**漂移由 `check-single-source.mjs` 把守**
  （core 指纹扫描 / append 命名 / 基类残留，CI/审计可挂，发现多源 exit 1）

## 更新模式（--update，v2.1 设计定稿）

已初始化仓库可通过 `scaffold --update <仓库路径>` 吸收模板更新：生成-对比（Copier 同款语义）→
状态机（快进/三方合并 git merge-file --diff3）→ 冲突分级裁决（机械自动 / agent 裁决 + 确定性验证
门禁 / QUARANTINED `.rej` 兜底）→ 自动 commit（回滚点）→ 报告与回滚（`--rollback`）。
状态层 `.scaffold/lock/`（base 快照 + manifest）入库。**完整设计：[UPDATE-MODEL.md](UPDATE-MODEL.md)（机制 v2.1）· [UPDATE-PLAN.md](UPDATE-PLAN.md)（分阶段实施方案）——已实施，agent 操作手册：[AGENT-GUIDE.md](AGENT-GUIDE.md)。**

## Agent 参与优化

所有工程分类的 AGENTS.md 内置「AI 协作守则」；AI 入口三桥接——`CLAUDE.md`（`@AGENTS.md` 导入）、
`.github/copilot-instructions.md`（工程分类自动配，sandbox/content 最小集不带）、AGENTS.md 本体
（DSH 实证有效）。pre-commit 验证链前门即 agent 防呆：FAIL 修根因，`--no-verify` 必须留痕。

## 占位符约定

| 占位符 | 含义 | 示例 |
|---|---|---|
| `<name>` | 插件短名（不带 dsh- 前缀） | `context-compass` |
| `<repo>` | 仓库名，scaffold 按分类派生：dsh-plugin = `dsh-<name>`，其余 = `<name>` | `dsh-context-compass` / `chumen` |
| `dsh-<name>` | npm 包名（A 类专属派生） | `dsh-context-compass` |
| `<org>` | GitHub 组织 | `NinjaSln-labs` |
| `<一句话描述>` | repo description / README 首句 / package.json description | `DSH 上下文占用罗盘` |
| `<year>` / `<org 法律名>` | LICENSE 版权行 | `2026 ninjasln` |
| `<宿主能力面>` | 插件挂在 dsh 的哪一层（工具/命令/设置页/Slot UI…） | `多会话上下文健康面板` |
| `<用到的宿主包>` 等 | package.json peer/devDeps 占位 | 按 `cordis_inspect_query` 契约预检结果填 |

模板内的 **HTML 注释 `<!-- 模板说明：… -->` 与引用块说明在使用时删除**；正文是可保留的成文。

## 文件 → 单库目标路径映射

> **七份文档（README/README.en/CONTRIBUTING/DEVELOPMENT/PUBLISHING/SECURITY/AGENTS）+ .gitignore
> 已迁单源拼装**：源在 `common/*-core.md` + `categories/<type>/*-append.md`，由 scaffold 拼装生成
> （见上方「单源原则」）——**repo-root 已无这些文件**，勿在此表找复制路径。

### 文档与仓库治理（拼装生成 / 分类提供）

| 模板 | 产物 | 作用 | 拼装后必改 |
|---|---|---|---|
| `common/README-core.md` + `<type>/README-append.md` | 根 `README.md` | 通用骨架（Standard Readme 三档 + 状态/非目标节）+ 分类徽章/安装/使用/配置 | 标题/描述/安装命令/配置项 |
| `categories/<type>/README.en.md` | 根 `README.en.md` | 英文镜像（双语标配，各分类提供，回链中文）；结构为 Standard Readme 核心节（Features/Install/Usage/Configuration/Docs/Contributing/License）——状态/非目标两节仅中文版提供（中文权威的扩展节） | 同步中文版对应节 |
| `common/CONTRIBUTING-core.md` + append | 根 `CONTRIBUTING.md` | 分支/提交规范/机密红线 + 分类开发环境命令 | 验证链命令按本库改 |
| `common/DEVELOPMENT-core.md` + append | 根 `DEVELOPMENT.md` | 通用开发→验证→构建→发布流程 + 分类纪律/DoD/速查表 | 验证链/插件名 |
| `common/PUBLISHING-core.md` + append | 根 `PUBLISHING.md` | 发布状态 + 版本历史 + 分类发布通道（npm OIDC/PyPI TP/GoReleaser） | 发布状态表填实际值 |
| `common/SECURITY-core.md` | 根 `SECURITY.md` | 通用安全策略（无分类差异） | 支持面描述 |
| `common/AGENTS-core.md` + append | 根 `AGENTS.md` | AI 协作守则 7 条 + 分类纪律（agent/humen 双入口） | 包名 |
| `common/gitignore-core.md` + append | 根 `.gitignore` | 机密/编辑器通用段 + 语言忽略段 | 视库增删 |
| `common/copilot-instructions.md` | `.github/copilot-instructions.md` | Copilot 桥接（指向 AGENTS.md） | 无 |
| `categories/dsh-plugin/CLAUDE.md`（基类 `repo-root/CLAUDE.md`） | 根 `CLAUDE.md` | Claude Code 桥接（`@AGENTS.md` 导入） | 无（原样复制） |
| `skill/SKILL.md` | `~/.agents/skills/<skill-name>/SKILL.md`（已验证）；项目级分发 Claude Code 用 `.claude/skills/`，DSH 项目级未验证 | 跨仓库可复用流程的 skill 骨架 | name/description（description 写法见模板内注释） |

### 工程与发布

| 模板 | 复制到单库 | 作用 | 复制后必改 |
|---|---|---|---|
| `repo-root/package.json` | 根 | 字段骨架（type: module / exports / **dsh 字段**（client half 必需：bundle.patch + client.inject + platform）/ peer/devDeps 规范，对齐两实践库） | 全部占位符 + 真实 peer/devDeps（见实践报告 §5.2）；纯 host 插件删除 `dsh` 字段；`test` 已指向 verify.mjs 单源 |
| `repo-root/tsconfig.json` | 根 | IDE/typecheck 配置（noEmit） | 无（可选调 target/lib） |
| `repo-root/tsconfig.build.json` | 根 | 构建配置（outDir lib + declaration） | 无 |
| `repo-root/src/index.ts` | `src/index.ts` | host half 入口骨架（OBJECT form 默认导出 + 生命周期注释） | 替换为本插件能力；**OBJECT form 注释保留** |
| `repo-root/src/config.ts` | `src/config.ts` | schemastery Config + resolveConfig 骨架 | 配置项（编译依赖 schemastery/@types/node 已预置在 devDeps） |
| `repo-root/scripts/verify.mjs` | `scripts/verify.mjs` | **验证链单源入口**：build→typecheck→探测式 smoke/vitest/mount/client-mount | 无（探测式，接入即自动进链；visual 留作本地发布前门） |
| `repo-root/scripts/build.mjs` | `scripts/build.mjs` | build 链探测包装：tsc 后按存在性跑 build-client.mjs（无 client 的库不再死在缺失脚本） | 无 |
| `repo-root/scripts/check-deploy.mjs` | `scripts/check-deploy.mjs` | 部署纪律装后自检（单库/多包自适应） | 只核对默认 profile 名（脚本头部注释） |
| `repo-root/.github/workflows/ci.yml` | `.github/workflows/ci.yml` | push(main)/PR 验证链（坏提交拦在进 main 当下，不等打 tag） | 无（与 publish.yml 同调 verify.mjs；action SHA 同步更新） |
| `repo-root/.github/workflows/publish.yml` | `.github/workflows/publish.yml` | OIDC Trusted Publishing 发布流水线 | tag pattern、node 版本、可选 environment 审批门 |
| `repo-root/.githooks/pre-commit` | `.githooks/pre-commit` | 部署纪律硬拦截 | 无（原样复制后 `git config core.hooksPath .githooks`） |
| `scaffold.mjs` | **不随库分发**（模板集工具） | 一条命令完成阶段 2：复制 + 占位符替换 + 删模板注释 + git init/hooks + TODO 清单 | — |

> 从零新建且有 client half 时需 `scripts/build-client.mjs`（client bundle）——与 client 格式
> 强耦合，**从 `dsh-context-compass/scripts/build-client.mjs` 复制适配**，模板不固化；
> `package.json` 的 build 经 `scripts/build.mjs` 探测包装，接入即生效，无 client 的库不受影响。
> 纯 host 插件删除 package.json 的 `dsh` 字段；cordis.patch.yml 仅 client half 插件需要。

## 明确不模板化的项

| 项 | 处理方式 |
|---|---|
| `scripts/build-client.mjs` / smoke/mount 测试脚本 | **从参照库复制适配**（与 client bundle 格式、验证策略强耦合）；路由 A 第 8 步 |
| `.githooks/commit-msg` | **本机私有，禁止入库**——只留本地 + `.gitignore` 已忽略 |
| `cordis.patch.yml` | profile 自有但**随发布物分发**（package.json files 已引用）——按本 profile 实况填写，不模板化 |
| `lib/`、`visual/baselines/` | 构建产物/实机基线，非模板 |

## 已知限制（诚实标注）

- `typecheck` 模板用严格版（`tsc -p tsconfig.json --noEmit`）；实践库实际带 `|| true` 宽松后缀（消化 SlotMap augmentation 双副本类报错的实战 hack）——从零起步建议先严格，遇到 augmentation 报错再按实践库放宽并注释原因
- `tsconfig.build.json` 的 `allowImportingTsExtensions` + `declaration` 组合要求 TypeScript ≥ 5.7（模板 devDeps 已钉 `^5.7.0`）
- DSH harness 的项目级 skills 目录机制未经验证（见 skill 模板注释）；agent 读取的 AGENTS.md 已由本会话实证有效
- 首版 bootstrap 描述基于 2025-12 npm 新规的公开报道，发布当日以 npm 官方文档为准
- 模板骨架未含 lockfile——脚手架产物首次 `npm install` 后**必须把 package-lock.json 入库**（CI npm ci 依赖；scaffold TODO 第 5 步与 ci.yml 头注释均有提示）
- 客户端 bundle 格式（`__ModuleLoader__` 工厂）与宿主强耦合，build-client.mjs 不模板化；client half 插件的 `dsh` 字段值需按本库宿主包实际填写

---

## 路线 A：从零新建插件库（通用步骤）

> 前提：宿主 dsh 可运行（本机 profile）、GitHub org 有建库权限、npm org 可发包。
> 阶段划分的原则来自实践报告：**先跑通最小闭环，再补发布面；每版一个关注点**。

### 阶段 1：契约预检（写代码之前）

1. 明确插件要挂在 dsh 的哪一层（工具/命令/投影/设置页/Slot UI），列 host/client 各自做什么（两个 half 都想清楚）
2. `cordis_inspect_list` → `cordis_inspect_query` 查清用到的 Service/Event/Builtin/Slot **精确签名**——不猜 API
3. 记录要依赖的宿主包清单（决定 package.json 的 peer/devDeps）

### 阶段 2：仓库脚手架（一条命令）

4. **首选脚手架**：`node templates/scaffold.mjs --name <name> --org <org> --desc "<一句话>"`（缺省参数且 TTY 时交互问答；非 TTY 必须全旗标）——自动完成第 5-7 步的**本地部分**并打印手工 TODO 清单（**GitHub 建库、npm install 等远端/网络操作不在其中**，见 TODO 第 5/7 步）
5. （手动替代）`gh repo create <org>/dsh-<name> --public`（public：provenance 需要；`--description "<一句话>"`）→ 本地 init → 复制 `repo-root/` 全部文件 → 逐文件替换占位符 → 删模板说明注释
6. `package.json`：按阶段 1 的契约清单填 peerDependencies（宽 caret + 预发布下界）、peerDependenciesMeta、devDependencies（peer 同范围复制 + 运行时可达宿主包全量）
7. `git config core.hooksPath .githooks` 启用 pre-commit；首次 `git grep` 机密自查后 commit

### 阶段 3：最小实现闭环（先跑通再补齐）

8. 复制适配 `scripts/build-client.mjs`（不做 client 的插件跳过）→ 写 `src/`（入口骨架 + config 骨架起步）→ `npm install --legacy-peer-deps` → build/typecheck 全绿
9. 按 DEVELOPMENT.md 核心循环开发：Backlog → Sprint（契约预检）→ 实现 → **DoD 三段**；部署纪律遵守：`file:` 安装 + `check:deploy` PASS 才算改过源码
10. 每个"类发布"节点跑完整验证链（build → typecheck → 测试 → mount；有 client 加 client-mount/visual）

### 阶段 4：发布面补齐（首个公开版之前）

11. 文档定稿：README 双语同步、DEVELOPMENT 速查表已积累、SECURITY 支持面写实
12. `gh repo edit` 设 description + topics；GitHub community profile 检查（LICENSE/README/CONTRIBUTING/SECURITY）
13. npmjs.com 配 Trusted Publisher（org/repo/`publish.yml` 文件名逐字段一致）；granular token 选不到未发布包 → **首版手动 `npm publish` bootstrap**，随后立即切 OIDC
14. 首发验证：`npm view dsh-<name> dist-tags` + npm 页 provenance 徽章 + `npm audit signatures`

### 阶段 5：例行发版（此后每版）

15. `npm version <semver>` → push tag → CI 验证链 → （environment 审批门）→ 自动发布；灰度走 `--preid=next` 的 canary 通道（PUBLISHING.md 模板）
16. 每版在 PUBLISHING.md 记一行（做了什么 + 为什么 + 怎么验证）；新坑进速查表

## 路线 B：从 dsh-plugins monorepo 迁移（增量，在路线 A 基础上）

前置与切库步骤（subtree split、拉历史、推仓库）**见 `DSH-PLUGIN-STANDALONE-MIGRATION.md` §3**，
本模板集只覆盖迁移后的"规范化"增量：

1. 迁移后仓库已有 src/lib/package.json —— 复制本模板集**文档与治理文件**（README/LICENSE/CONTRIBUTING/DEVELOPMENT/PUBLISHING/SECURITY/AGENTS/CLAUDE/.gitignore）
2. 对照模板补工程文件：`.github/workflows/publish.yml`（monorepo 时代的已在封版仓删除）、`tsconfig*.json`、`.githooks/pre-commit`、`scripts/check-deploy.mjs`（参照库复制或用本模板，核对 `localSrcFor()` 单库分支）
3. 全局 `grep -rn "dsh-plugins"` 清旧引用（src 默认数据 URL **发版前必改**；package.json repository/homepage/bugs 指向新库——OIDC/provenance 依赖）
4. rebuild lib → 验证链全绿 → `git grep` 机密自查 → npm 配 Trusted Publisher → tag 发布
5. 迁移后按迁移文档 §9 分版本推进（v+1 宿主适配/URL 修正，v+2 规范化，v+3+ 功能）

## 两路线共同的红线（模板已内建，勿删）

- **OBJECT form 默认导出**（`src/index.ts` 模板注释）——工厂写法被静默忽略
- **部署纪律**（AGENTS.md 5 条 + DEVELOPMENT.md 全文 + pre-commit + check-deploy）——同版本号不同内容事故的唯一拦截链
- **机密不入库**——`.gitignore` 模板已忽略 HANDOFF/commit-msg；提交前 `git grep -nE '/home/[a-z]|/mnt/[a-z]|/Users/[a-z]'`
- **验证链单源**——package.json `test`、ci.yml 与 publish.yml 都只调 `scripts/verify.mjs`（结构保证，非纪律约束）；链内增删步骤只改 verify.mjs

## 将来可选：GitHub template repo

模板集成熟（≥2 个插件用 scaffold.mjs 建库跑通）后，可把 `templates/repo-root/` 推成独立
GitHub 仓库并勾选 Settings → "Template repository"，即可用 "Use this template" 一键建库；
scaffold.mjs 的占位符替换则由 GitHub 变量或首次 commit 后的 sed 替代。本步为可选项，
当前双文件模板（templates/ + scaffold.mjs）已够用。
