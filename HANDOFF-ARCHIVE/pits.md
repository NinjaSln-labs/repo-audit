# HANDOFF-ARCHIVE/pits.md — 已确认修复的坑

> 按 HANDOFF §6 维护规则：确认已修的坑从 HANDOFF §4 迁入本文件，不在正文停留。

---

## P-001: AGENTS.md 缺失导致 CLAUDE.md 悬空引用 + 多文档断链

- **发现时间**：2026-09-06（接手 session）
- **来源**：用户反馈"只有 CLAUDE.md 没有 AGENTS.md"
- **症状**：
  - `CLAUDE.md` 第 1 行 `@AGENTS.md` 引用不存在
  - `CONTRIBUTING.md`（§2）、`DEVELOPMENT.md`（§16/20/63/97/111）、`BEST-PRACTICES.md`、`AUDIT.md`、`REPO-CLASSIFICATION.md` 多处引用悬空
  - 规则 `DOC-004`（AGENTS.md 存在且含 AI 协作守则）的 `applies_to` 不含 `javascript`，故自审计未 fail
- **根因**：scaffold 生成 repo-audit 时，`templates/categories/` 下无 `javascript` 分类的 AGENTS-append.md，`AGENTS-core.md` 虽被 `assemble()` 拼装但产物未落盘（或开源清理时被删）；AGENTS.md 从未提交到 git
- **修复**：创建 `AGENTS.md`（基于 `templates/common/AGENTS-core.md` + 项目定制分类纪律节），验证链全绿、自审计 100/A 保持
- **关联文件**：`AGENTS.md`（新增）、`CLAUDE.md`（引用修复）、`templates/common/AGENTS-core.md`（模板源）
- **修复 commit**：待提交
- **回归测试**：`node repo-audit.mjs --repo . --format json`（DOC-004 虽不检查 javascript 分类，但 repo-audit.mjs 第 356 行 `hasFile(repoPath, 'AGENTS.md')` 加分至 `agent-collab` 分类特征）

---

## P-002: publish workflow EBADENGINE — npm@latest 与 runner node 20 不兼容

- **发现时间**：2026-09-06（Trusted Publisher 首次 tag 验证）
- **症状**：v1.2.1 tag 触发 publish workflow，`npm install -g npm@latest`（npm@12）报 `EBADENGINE`：要求 node `^22.22.2 || ^24.15.0 || >=26`，runner 实际 node 20.20.2
- **根因**：npm≥11.5.1 才支持 OIDC Trusted Publishing，原 workflow 用「升级到最新 npm」满足该要求，但 npm@12 的 engine 门槛超出 setup-node 固定的 node 20
- **修复**：runner 升 node 22（自带 npm 11.19.1 ≥11.5.1），升级步骤改为条件兜底 `npm@11`（`2d63f8a`）
- **回归验证**：v1.2.2/v1.2.3 tag 的 publish run 均无 EBADENGINE；v1.2.3 `+ repo-audit-tool@1.2.3` 成功

## P-003: npm provenance E422 — package.json 缺 repository 字段

- **发现时间**：2026-09-06（同轮验证）
- **症状**：OIDC token 交换 201 成功后 `npm publish` 报 422：`package.json: "repository.url" is ""`，expected 匹配 `https://github.com/NinjaSln-labs/repo-audit`
- **根因**：provenance（`--provenance`）要求包元数据 repository 与实际构建仓库一致；本仓 package.json 从未配置 repository
- **修复**：package.json 补 `"repository": {"type":"git","url":"https://github.com/NinjaSln-labs/repo-audit"}`（`3220da1`）
- **回归验证**：v1.2.3 publish 成功，`npm view repo-audit-tool dist.attestations` 返回 SLSA provenance v1

## P-004: npm 版本不可重发 — tag 撞已发布版本

- **发现时间**：2026-09-06（同轮验证）
- **症状**：v1.2.2 tag 的 publish 报 `You cannot publish over the previously published versions: 1.2.1`（1.2.1 此前已手动发布）
- **根因**：npm registry 版本一旦发布不可覆盖；workflow 版本守卫只查 tag↔package.json 一致，不查 registry 已存版本
- **修复**：工作流不改（版本守卫语义正确）；流程约束——打 tag 前先 `npm view <pkg> versions` 确认版本未占用，已占用则 bump
- **流程落点**：已写入 HANDOFF §4「npm 发版链」坑区与 PUBLISHING.md

## P-005: HTTPS git push 间歇性挂起（历史坑，已根治）

- **发现时间**：2026-09-06 前次 session 记录（HANDOFF §3 风险提醒）
- **复测一**：2026-09-06 上午 4 次 HTTPS push（master×2、tag×2）全部秒级成功 → 当时误判自愈
- **复测二（复发）**：2026-09-06 下午 push 报 `GnuTLS recv error (-110): The TLS connection was non-properly terminated`，重试一次直接 120s 超时挂起
- **结论修正**：**间歇性坑，非自愈**——上午成功是侥幸窗口，下午复发推翻自愈判定
- **规避**：远端已切 `git@github.com:NinjaSln-labs/repo-audit.git`（SSH），push 立即恢复秒级
- **根治（2026-09-06 用户裁定）**：push 一律 SSH 不用 HTTPS；另配全局重写 `git config --global url."git@github.com:".insteadOf "https://github.com/"`——即使远端被工具改回 HTTPS URL，实际传输仍走 SSH（已实测 HTTPS URL ls-remote/push 均秒级）
- **副作用残留**：HTTPS URL 时期 push 时 `git: 'credential-gh' is not a git command` 警告——远端 URL 内嵌凭证与 credential helper 配置不匹配所致，推送实际成功，无害噪音；切 SSH 后此噪音消失

## P-006: npm bin symlink 下入口守卫误判 — CLI 静默不执行（v1.3.0 回归）

- **发现时间**：2026-09-06（v1.3.0 发布后实机复测）
- **症状**：`npm install -g repo-audit-tool` 后跑 `repo-audit --repo …`——exit 0 但零输出，JSON 解析空输入报错
- **根因**：为修 Issue#1 加的入口守卫 `import.meta.url === \`file://${process.argv[1]}\``——npm 全局安装的 bin 是 **symlink**（`bin/repo-audit → …/lib/node_modules/repo-audit-tool/repo-audit.mjs`），`process.argv[1]` 是 symlink 路径、`import.meta.url` 是真实路径，守卫误判为「被 import」→ main() 不执行
- **为什么本地没测出**：本地直跑 `node repo-audit.mjs` 时两者一致；只有 npm 安装形态才有 symlink 差异——**入口/路径类改动必须过「npm pack → 干净目录安装 → bin 实测」链**
- **修复**：`realpathSync(process.argv[1])` 归一化后再比对（`d833c87`，v1.3.1）
- **回归验证**：干净 prefix 安装后三复现仓 + 反例仓实测，行为全部符合预期

## P-007: win32 URL/路径转换手工拼接 — Windows 全形态静默不执行（v1.3.1 回归）

- **发现时间**：2026-09-06（Issue#4 用户反馈，Windows 11 + Node v24.19.0 实测）
- **症状**：v1.3.1 在 Windows 上 `repo-audit` 任何参数组合都 exit 0 无输出（CLI 全形态 DOA）
- **根因**：P-006 修复引入的守卫（比对式 `import.meta.url === "file://" + realpathSync(argv[1])`）——win32 上 realpathSync 返回反斜杠路径，手工拼接产出非法 URL 形态 `file://C:\Users\...`（双斜杠+反斜杠），而 import.meta.url 是 `file:///C:/Users/...`（三斜杠+正斜杠），两侧永不相等 → isDirectRun 恒 false → main() 永不执行
- **连带坑**：修复过程中自写的回归测试也踩了同类坑——`new URL(x).pathname` 在 win32 产出 `/D:/...`（前导斜杠+盘符），不能直接 realpathSync（ENOENT `D:\D:`）——CI windows-latest 矩阵首跑抓到
- **修复**：`pathToFileURL(realpathSync(argv[1])).href`（Issue#4 反馈者方案，win32 实测背书）+ 测试改 `fileURLToPath`（`a758398` + `d8b89a0`，v1.3.2）
- **配套加固**：守卫不命中时 stderr 诊断提示（不再静默 exit 0）；CI 加 windows-latest 矩阵 + npm pack→安装→bin smoke；command 检查器 win32 Git Bash 探测
- **教训**：**win32 URL↔路径转换必须走 node:url 的 pathToFileURL/fileURLToPath 正解，禁止手工拼接**；入口/路径类代码本地 Linux 全绿不算数，必须过 CI windows 矩阵实跑
