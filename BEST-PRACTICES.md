# 个人仓库脚手架最佳实践调研（2026-09）
> 调研问题：个人仓库（不限 dsh 插件）从零到发布 npm/PyPI/GitHub Release 的最佳实践步骤。涵盖开发语言、npm、git 仓库文件（README / CONTRIBUTING / PUBLISHING / DEVELOPMENT / SECURITY / LICENSE / AGENTS.md）、skills。
> 证据来源分三类：**本地一手**（本生态已跑通两次迁移的沉淀文档 + 两个已发布单库的实战文件）、**外部规范**（npm / GitHub / agentskills 官方文档，web 调研）、**交叉验证结论**。
> 姊妹文档：`../../DSH-PLUGIN-STANDALONE-MIGRATION.md`（迁移与发布的方法论、坑清单、检查清单——本文不重复其细节，引用为主）；
> `templates/`（按本文结论整理的**单库模板集**：文档/工程/发布文件 + 脚手架脚本 + 从零新建与迁移双轨使用顺序）；
> `AUDIT.md`（模板集从零子代理独立审计报告与修复记录）。

---

## 0. TL;DR：全流程 12 步

| # | 步骤 | 关键动作 | 参照 |
|---|---|---|---|
| 1 | 契约预检 | `cordis_inspect_list / query` 查清用到的 Service/Event/Builtin/Slot 精确签名，**不猜 API** | DEVELOPMENT.md §2 |
| 2 | 实现（双 half） | TypeScript host + esbuild client bundle；沙箱禁用全局（setTimeout/fetch/require/process/Buffer） | §1、DEVELOPMENT.md §3 |
| 3 | 验证链 | build → typecheck → 单测/smoke → mount → client-mount（→ visual），全绿才算完 | publish.yml Verify 步骤 |
| 4 | 实机闭环 | `file:` 安装进 profile + 重启 + 运行中 harness 实测；`check:deploy` 自检 | 部署纪律（§7.2） |
| 5 | 仓库文件 | LICENSE / README(.en).md / CONTRIBUTING / DEVELOPMENT / PUBLISHING / SECURITY / AGENTS.md | §2 |
| 6 | package.json | exports（types 在 default 前）/ files 白名单 / peer 宽 caret + 同范围复制进 devDeps / repository 三字段指向本库 | §5 |
| 7 | 机密自查 | `git grep` 本机路径/邮箱/token；commit-msg 等本机私有文件只留本地 + ignore | §7.3 |
| 8 | CI 就绪 | publish.yml：tag 触发 + `id-token: write` + **不加 registry-url** + actions 按 SHA 固定 + npm@latest + `--provenance` | §6.1 |
| 9 | Trusted Publisher | npmjs.com 包设置配 owner/repo/workflow 文件名，与 workflow 逐字段一致 | §6.2 |
| 10 | 发版 | `npm version <semver>` → commit + tag `dsh-<name>-vX.Y.Z` → push；prerelease 走 `--tag next` 灰度 | §6.3 |
| 11 | 发布后验证 | `npm view <name> dist-tags` 确认 latest；npm 页 provenance 徽章；`npm audit signatures` | §6.3 |
| 12 | 沉淀 | PUBLISHING.md 版本历史一行（做了什么+为什么）；新坑进速查表；回顾三问 | DEVELOPMENT.md §6 |

---

## 1. 开发语言与技术栈

### 1.1 两层代码形态（重要区分）

| 形态 | 语言 | 场景 |
|---|---|---|
| **npm 发布的插件单库**（本报告主线） | **TypeScript**（host）+ TSX（client），tsc → `lib/` + esbuild → client bundle | 独立演进、独立发布、独立 CI |
| **会话动态插件**（cordis_define） | **纯 JS**：无 TS/JSX/import/require，`React.createElement`，无打包转换 | 临时运行时扩展、原型验证 |

npm 单库是插件的正式形态；动态插件是开发期的快速验证通道（但建议同一套契约预检 + DoD 纪律）。

### 1.2 沙箱约束（编写期硬规则）

- 全局定时器禁用：`setTimeout/setInterval/...` → `ctx.timeout / ctx.interval`（`inject: ['timer']`）
- `fetch` → `ctx.web`；`process/Buffer` → `btoa/atob/TextEncoder`；`require` → 服务
- 服务访问：`ctx.get(name)` + undefined 检查，硬依赖才 `inject`
- **每次 define 显式提供 `code.host` 和 `code.client`**（省略 client = UI 消失，踩过 4 次，已进速查表）

### 1.3 构建工具（外部调研结论）

- 新项目：**tsdown**（基于 Rolldown，tsup 后继，API 兼容迁移成本低）；存量 tsup 不必急迁
- 本生态现状：tsc + esbuild 直出（自建 `scripts/build-client.mjs`），依赖极简，无额外打包框架——与宿主 `__ModuleLoader__` 工厂格式强耦合，**暂无迁移必要**

---

## 2. git 仓库文件规范（community profile 全绿）

### 2.1 必备文件矩阵

| 文件 | 定位 | 要点 |
|---|---|---|
| `LICENSE` | 必须 | MIT 全文；package.json 声明 MIT ≠ 有文件 |
| `README.md`（中文权威）+ `README.en.md` | 必须 | 双语，顶部相对链接互切（`[English](README.en.md)`，禁绝对 blob URL）；徽章 ≤4；结构：标题→徽章→一句话→安装/使用→配置→文档→贡献→License；README 只放上手信息，长文档进 `docs/` 用相对链接 |
| `CONTRIBUTING.md` | 建议 | 开发环境命令 / 提交规范（中文，改什么+为什么）/ pre-commit 纪律 / 发版指路 PUBLISHING / 行为准则 |
| `DEVELOPMENT.md` | 建议（本生态特色） | 敏捷核心循环、Backlog 用户故事、Sprint 契约预检、实现规范、**DoD 三段清单**、部署纪律全文、高频坑速查表 |
| `PUBLISHING.md` | 建议（本生态特色） | 发布状态表（npm/GitHub/本地验证/双语文档）+ **版本历史**（每版一行：做了什么 + 为什么 + 验证方式）+ 重新安装验证 + 维护要点 + canary 流程 |
| `SECURITY.md` | 建议 | 支持面说明（读什么数据/安全边界如 RPC loopback+Host 校验）+ 漏洞报告渠道（不公开 issue → 私密漏洞报告/邮件）+ 响应 SLA（72h） |
| `AGENTS.md` | 必须（agent 协作仓库） | 部署纪律内联摘要，指向 DEVELOPMENT.md 全文（见 §3） |
| `HANDOFF.md` + `HANDOFF-ARCHIVE/` | 可选 | 工程交接；archive 滚动归档 |
| `docs/` | 可选 | DESIGN / ROADMAP / AUDIT 等长文档 |

配套文件**必须放仓库根** → GitHub community profile 自动识别 health 完成度。

### 2.2 仓库元数据

```bash
gh repo edit <org>/dsh-<name> --description "<一句话>"
gh repo edit <org>/dsh-<name> --add-topic deepseek-harness --add-topic dsh-plugin ...
```

### 2.3 单库化遗留检查（迁移场景）

- 全局 `grep -rn "dsh-plugins"`：README 链接/徽章、src 默认数据 URL（**发版前必改**，0.11.1 踩过：发布物默认 URL 指向弃用仓库）、package.json `repository/homepage/bugs`（OIDC/provenance 依赖正确 repo 字段）
- subtree split 不带仓库级文件：pricing/ 等独有配套手动迁

---

## 3. AGENTS.md 规范

### 3.1 本生态实践（已被两次迁移验证）

- **角色**：面向 AI agent 的硬性纪律入口，README 面向人、AGENTS.md 面向 agent，两者分工不重叠
- **写法**：一页以内、编号硬规则、每条给"为什么"或指向全文（`DEVELOPMENT.md` 部署纪律节），避免 agent 断章取义；末尾附单库化澄清（monorepo 机制哪些不需要，防误抄）
- **内容**：部署纪律 5 条（file: 安装 / 官方入口安装 / check:deploy / 禁手动软链 / 机密不入库）+ git 钩子启用方式

### 3.2 外部规范（agents.md 开放标准，2025-2026 现状）

- **定位**："给编码代理的 README"，开放 Markdown 格式、无必填 schema；由 Linux 基金会旗下 Agentic AI Foundation 托管，60,000+ 开源项目在用。来源：https://agents.md/
- **推荐章节**：Project overview / Setup commands / Build & test commands / Code style / Testing instructions / PR & commit 说明 / Security considerations——"凡是会告诉新同事的话都适合写在这里"
- **与 README 分工**：README 面向人（上手/介绍），AGENTS.md 面向代理（会"弄脏 README"的构建/测试/约定细节）
- **嵌套优先级**：monorepo 可分层放置；冲突时**离被编辑文件最近者胜**，用户聊天中的显式提示覆盖一切
- **工具读取现状**：Codex/Jules/Cursor（与 .cursor/rules 并存）/Copilot/Aider 等直接读 AGENTS.md；**Claude Code 读 CLAUDE.md**，桥接做法 = 建 CLAUDE.md 写 `@AGENTS.md` 导入（官方推荐，可追加 Claude 专属指令）或 symlink；Gemini CLI 默认 GEMINI.md，可在 settings 改指 AGENTS.md
- **对本生态的启示**：本单库 AGENTS.md 的"内联硬规则 + 指向 DEVELOPMENT.md 全文"写法与官方推荐一致；唯一缺口是若贡献者用 Claude Code，需补一条 CLAUDE.md → `@AGENTS.md` 导入（一行成本）

---

## 4. Skills 规范

### 4.1 本机实践

- 分发位置：用户级 `~/.agents/skills/<skill-name>/`，单 skill 一目录：`SKILL.md`（+ 辅助文件如 `agents/`、审计报告）
- frontmatter 实例（skill-description-audit 1.5.0）：
  ```yaml
  ---
  name: skill-description-audit
  description: >-
    一段话：做什么 + 何时用（Use when...）+ 边界（NOT for...，指路替代 skill）
  metadata:
    version: "1.5.0"
    standard: agentskills.io
    scope: user
  ---
  ```
- **description 是触发器**：必须含触发词与 NOT-for 边界（防止误触发与漏触发）；这是 description 审计 skill 本身的存在理由
- 本生态 skill 与插件的关系：skill 教 agent *怎么做*（流程/契约/坑），插件提供 *运行时能力*——DEVELOPMENT.md 的 DoD 与速查表承担了"仓库内 skill"的职能，无需为单库再拆独立 SKILL.md；确有跨仓库复用的流程（如 description 审计）才沉淀为独立 skill

### 4.2 外部规范（Agent Skills 开放标准，agentskills.io）

- **开放标准时间线**：2025-10-16 Anthropic 发布 Agent Skills；**2025-12-18 开放为标准**（agentskills.io）；数十个客户端（Claude/Codex/Gemini CLI/Cursor/Copilot 等）已支持——SKILL.md 正在成为"代理能力的 npm 包格式"
- **结构**：一目录一 skill，最少 `SKILL.md`（YAML frontmatter + 正文）；可选 `scripts/`（可执行）、`references/`（按需参考）、`assets/`；校验用 `skills-ref validate`
- **frontmatter**：`name`（≤64 字符，小写-连字符，须与目录名一致）+ `description`（≤1024 字符，说清"做什么 + 何时用"）必填；可选 `license/compatibility/metadata/allowed-tools`
- **渐进式披露**：元数据级（name+description，~100 token 常驻）→ 指令级（SKILL.md 全文，建议 <500 行）→ 资源级（scripts/references 按需）；文件引用相对路径、一层深、写明"何时读"
- **description 写法**：祈使句 "Use when..."；写用户意图不写实现；宁可显式列场景（pushy）；用 ~20 条查询（应触发/不应触发各半，near-miss 负例最有价值）做触发评测迭代
- **内容写法**：从真实故障/runbook 合成不凭空写；只写"代理不知道会做错"的内容（**Gotchas 段价值最高**）；重复逻辑固化成 scripts/；本生态插件速查表正是此模式的仓库版
- **分发位置（Claude Code）**：项目 `.claude/skills/`（随仓库分发，推荐）> 个人 `~/.claude/skills/` > 企业；skill 目录加 `.claude-plugin/plugin.json` 可升级为插件；安装前审计脚本与网络指令
- **与本生态对齐**：`~/.agents/skills/` 的 frontmatter（standard: agentskills.io）已遵循该标准；插件单库如需沉淀跨仓库流程（如发版检查），可放 `.agents/skills/` 或 `.claude/skills/` 随库分发

---

## 5. npm 包工程

### 5.1 package.json 关键字段（外部规范 × 本地实践交叉）

```jsonc
{
  "name": "dsh-xxx",
  "exports": { ".": { "import": { "types": "...", "default": "..." },
                       "require": { "types": "...", "default": "..." } },
               "./package.json": "./package.json" },   // types 条件必须在 default 前
  "files": ["lib"],                                     // 显式白名单；lockfile 不随 tarball 发布（正确）
  "engines": { "node": ">=20" },
  "peerDependencies": { "@deepseek-ai/dsh-session": "^0.1.2-alpha.4", "react": "^18.2.0" },
  "peerDependenciesMeta": { "...": { "optional": true } },  // 可选集成
  "devDependencies": { /* peer 同范围复制 + 运行时可达的宿主包全量 */ }
}
```

### 5.2 依赖声明规范（本地沉淀，比社区默认更严）

1. **peer 宽范围，不精确 pin**：`^0.1.2-alpha.4`，绝不 `0.1.2-alpha.4`；宿主预发布期必须写同元组预发布下界（裸 `^0.1.2` 匹配不到 alpha）
2. **peer 同范围复制进 devDependencies**（社区事实标准）：peer 不进自身依赖树 → tsc/测试/CI 找不到类型
3. **单库化坑（subagent-router 实战）**：单库独立安装不装宿主包的 peer——**运行时可达的宿主 peer 包全部显式进 devDependencies**；判定法：`npm test` 报 `Cannot find package` 逐个补
4. **devDep 精确 pin 特例**：`dsh-client-ui-slots` 的 module augmentation 要求与 runtime 解析副本一致，caret 会漂移致 SlotMap 双副本 → 该包 pin 精确版本（0.2.0 踩过 TS2664/TS2345）
5. **版本锁定分工**：范围写 package.json（caret），具体版靠提交入库的 `package-lock.json`；CI `npm ci --legacy-peer-deps`（dsh alpha 生态 peer 链不完整）。锁文件的核心价值在**被消费**：CI/验证链必须实际安装它（`npm ci` / `pip install -r requirements.lock`）——只入库不安装是装饰性合规；`requirements.lock` 非 pip 原生锁格式，没有默认消费者，CI 须显式安装；零依赖仓（依赖声明为空）无锁对象，可豁免。

### 5.3 dual ESM/CJS（外部调研结论）

2025-2026：Node 20/22 ESM 成熟，dual 可行但非必须——**按消费方判断**：只服务 Node 且消费方接受 ESM 可单发 ESM；需被 CJS require 则 dual。本生态插件只被 dsh 宿主加载，双构建非刚需。

### 5.4 验证链（发布门）

| 单库 | 链 |
|---|---|
| context-compass | build → typecheck → smoke（stub 服务 107+）→ mount（真实 cordis 挂载）→ client-mount → visual（Playwright，需运行中 harness，本地发布前门不进 CI） |
| subagent-router | build → typecheck → vitest 132（驱动真实 ToolRuntime）→ mount |

另有 `scripts/release-check.mjs`（一条命令收敛完整验证链，任一失败 exit 1 禁发）与 `contract-check.mjs`（对运行中 harness 断言挂载+注入链路）。

---

## 6. 发布管道（OIDC Trusted Publishing）

### 6.1 workflow 安全要点（本地实例 = 外部规范全对齐）

```yaml
on:
  push:
    tags: ['<name>-v*']            # tag 触发 = 发布是显式人工决策
permissions:
  contents: read
  id-token: write                  # OIDC 唯一必需权限
# steps:
#   actions/checkout@<SHA>        # 按 SHA 固定，不用 mutable tag（供应链防护）
#   actions/setup-node@<SHA>      # node 24 + cache: npm
#     ⚠️ 不加 registry-url！它写占位 _authToken 的 .npmrc shadow 掉 OIDC → E404
#   Guard: tag 版本 == package.json version（守卫）
#   npm ci --legacy-peer-deps → 验证链全绿
#   npm install -g npm@latest     # trusted publishing 需 npm ≥ 11.5.1
#   npm publish --access public --provenance（prerelease 加 --tag next）
```

可选加成：`environment: npm-publish` + GitHub required reviewers = 人工审批门（context-compass 在用）；`concurrency` 组防并发发布。

### 6.2 Trusted Publisher 配置

npmjs.com 包设置 → Trusted Publisher：owner / repo / workflow 文件名逐字段精确（npm 不预校验，配错只在 publish 时报错）；org 与包 maintainer 身份须一致；首次配置可能未保存成功——publish 失败先重配一次。

### 6.3 版本策略

- 稳定版：`npm version patch -m "chore: release v%s"` → push tag → CI 全绿自动发 latest
- 灰度：`npm version prerelease --preid=next` → CI 自动发 `next` dist-tag（**忘加 --tag next 是最常见事故：用户会装到 prerelease**）→ 实测通过后 `npm dist-tag add <name>@x.y.z latest` 晋级
- 弃用旧名/旧版：`npm deprecate`（subagent-router 更名时对旧包 0.1.x 全量 deprecate 指向新包）
- 首发引导（granular token 时代遗留但流程仍适用）：granular token 选不到未发布包 → 首版手动 publish bootstrap，随后立即建限权 token / 切 Trusted Publishing

### 6.4 发布坑清单（已实战验证，见迁移文档 §6.4）

registry-url shadow OIDC · trusted publisher 配置错不预校验 · OIDC "package not found"=owner 身份不一致 · npm 版本旧 · 私有仓库无 provenance（源仓库须 public）· workflow step name 含冒号 YAML 无效静默不触发 · setup-node cache 找不到 lockfile

### 6.5 发布自动化选型（外部调研结论）

单包小库：**`npm version` + tag 触发 CI（推荐默认，本生态现状）** 或 changesets（要规范 changelog/未来多包）；不推荐 semantic-release（配置成本 > 收益，且其 tag 逻辑与 Trusted Publisher 绑定的 tag pattern 易冲突）。

---

## 7. 开发流程纪律（DEVELOPMENT.md 承载）

### 7.1 敏捷核心循环

Backlog（用户故事格式）→ Sprint（1-2 条/迭代，只做必要设计决策+契约预检）→ 实现 → **DoD 三段**（功能：可复现+实测；质量：AI 风险检查 9 项；文档：README/PUBLISHING/速查表）→ 交付试用（给可复制命令）→ 回顾三问（答案落盘）。

### 7.2 部署纪律（2026-08-31 事故沉淀，最重要的一条本地经验）

> 事故：改了源码并 build，但 profile 装的仍是 registry 旧版——**同版本号不同内容**，版本校验失效，行为错位极难排查。

| 插件状态 | profile 安装方式 |
|---|---|
| 联调中/已入库未发版 | `file:` 指向本目录 |
| 已发版且 lib 一致 | registry `^x.y.z` |

- 安装一律 `dsh plugin --profile web install`（禁裸 npm install——会把 peer 装进 profile 产生第二套宿主包）
- 每次 install/build 后必跑 `check:deploy`（FAIL 非零退出：registry 差异 / 宿主包阴影 / 软链或 lib 不一致）
- pre-commit 钩子硬拦截（`.githooks/pre-commit`，`git config core.hooksPath .githooks`）
- **改 lib 必须同步进 src/**——CI 从 src 重建，只手改 lib 的修复发布时全丢（context-compass 丢过两个版本）

### 7.3 机密纪律（硬性）

- ❌ 本机绝对路径 / 个人邮箱 / token / 部署实况快照（会过时）；✅ 末尾目录名不构成泄露
- 入库前：`git grep -nE '/home/[a-z]|/mnt/[a-z]|/Users/[a-z]' -- src/ README.md`
- 本机特有配置（commit-msg 钩子）只留本地 + ignore

---

## 8. 参考来源

### 本地一手
- `DSH-PLUGIN-STANDALONE-MIGRATION.md`（迁移与发布方法论/坑清单/检查清单）
- `dsh-context-compass/`：AGENTS.md、DEVELOPMENT.md、PUBLISHING.md、CONTRIBUTING.md、SECURITY.md、`.github/workflows/publish.yml`、package.json、`scripts/`、`.githooks/`
- `dsh-subagent-router/`：PUBLISHING.md（0.4.0 OIDC trusted publishing 首次跑通 + devDeps 全量坑）、AGENTS.md
- 本机 skill 惯例：`~/.agents/skills/`（agentskills.io frontmatter 实例）

### 外部规范（web 调研，2026-09）
- npm Docs — provenance: https://docs.npmjs.com/generating-provenance-statements/ · trusted publishers: https://docs.npmjs.com/trusted-publishers/ · access tokens: https://docs.npmjs.com/about-access-tokens/ · dist-tag: https://docs.npmjs.com/cli/v11/commands/npm-dist-tag · deprecate: https://docs.npmjs.com/cli/v11/commands/npm-deprecate · peerDependencies: https://docs.npmjs.com/cli/v11/configuring-npm/package-json#peerdependencies
- GitHub Changelog — Trusted Publishing GA（2025-11-25）: https://github.blog/changelog/2025-11-25-npm-trusted-publishing-ga/ · TOTP/classic token 弃用（2025-09-29）: https://github.blog/changelog/2025-09-29-strengthening-npm-security-deprecating-totp-based-publishing/ · 发布认证收紧（2025-12-09）: https://github.blog/changelog/2025-12-09-npm-tightens-publishing-security-with-new-authentication-rules/
- GitHub Docs — Actions 安全加固: https://docs.github.com/en/actions/reference/security/secure-use
- tsdown（tsup 后继）: https://tsdown.dev/ · tsup: https://github.com/egoist/tsup · changesets: https://github.com/changesets/changesets · TypeScript 模块解析: https://www.typescriptlang.org/docs/handbook/modules/reference.html
- AGENTS.md 开放规范: https://agents.md/ · AAIF 托管公告: https://openai.com/index/agentic-ai-foundation/
- Claude Code 记忆/导入: https://code.claude.com/docs/en/memory · Skills: https://code.claude.com/docs/en/skills · Cursor Rules: https://cursor.com/docs/rules
- Agent Skills 规范: https://agentskills.io/specification · description 优化: https://agentskills.io/skill-creation/optimizing-descriptions · 写作最佳实践: https://agentskills.io/skill-creation/best-practices · 客户端生态: https://agentskills.io/clients
- Anthropic 工程博客（Agent Skills）: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills · 官方 skill 仓库: https://github.com/anthropics/skills
- 开源指南（README/CONTRIBUTING）: https://opensource.guide/how-to-contribute/ · GitHub 安全策略: https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/add-security-policy · 私密漏洞报告: https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/report-privately
