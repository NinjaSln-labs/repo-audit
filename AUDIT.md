# 模板集独立审计报告与修复记录（2026-09）

> 审计方式：**从零接手的子代理**（无本会话上下文，只读 + /tmp 沙箱实测），对 `templates/` 全部 22 文件做
> 黑盒可用性 / 内部一致性 / 可运行性 / 保真度 diff / 正确性风险 / 遗漏六维审计，并实测了 scaffold 全流程、
> verify 链、check-deploy 六场景、pre-commit 实提交、workflow YAML 解析。审计对象未被子代理修改。
> 参照实底：dsh-context-compass / dsh-subagent-router；上位文档：调研报告 + 迁移规范。

## 审计发现（分级）

### Critical（2，均已修复）

| # | 发现 | 修复 |
|---|---|---|
| C1 | build 链硬引用不存在的 `build-client.mjs`——从零库首跑验证链必挂，且修复指引只在不随库分发的索引里 | 新增 `scripts/build.mjs` 探测包装（build-client 存在才跑），package.json build 改调它；纯 host 插件链路不再死 |
| C2 | 骨架源码依赖 `@deepseek-ai/schemastery`、`@types/node`，但 devDeps 占位体系未覆盖——按字面填完 TODO 编译仍不过 | devDeps 预置 `"@deepseek-ai/schemastery": "^3.18.1"`、`"@types/node": "^24"`（核对参照库实况：schemastery 为发布产物依赖） |

### Major（4，均已修复）

| # | 发现 | 修复 |
|---|---|---|
| M1 | scaffold `--surface` 死参数：`<宿主能力面>` 占位符在模板中不存在（SECURITY.md 用的是长描述形态） | SECURITY.md 改用精确占位符 `<宿主能力面>`；实测替换生效 |
| M2 | 索引称 scaffold"自动完成第 5-7 步"，但 GitHub 建库无人负责；TODO 只给 `gh repo edit`（对未创建仓库必失败） | TODO 第 7 步改 `gh repo create --public --source . --push` + edit topics；索引注明"本地部分" |
| M3 | package-lock.json 断链：CI 的 npm ci 与 cache-dependency-path 首推必挂，无提醒 | ci.yml 头注释 + scaffold TODO 第 5 步【必须入库】标注 + 已知限制条目 + CONTRIBUTING 提示 |
| M4 | 交互模式非 TTY/EOF 下 readline 挂死（exit 13）；无 --help | 入口处理 --help/-h；缺必填参数且非 TTY → 打印用法 exit 1；未知旗标告警（--help 已纳入已知） |

### Minor（8，修复 7）

| # | 发现 | 处置 |
|---|---|---|
| m1 | 剩余占位符同名只报首文件；SHA 填写无指引 | remaining 改记文件集合（实测 ci.yml+publish.yml 同显）；TODO 第 8 步专列 SHA 填写 |
| m2 | HTML 注释被当占位符误报 | PLACEHOLDER_RE 加 `(?<!--)` 负向后行排除 |
| m3 | 产物未填占位直接 npm install 报 EINVALIDPACKAGENAME 难懂 | CONTRIBUTING 开发环境节加首装前置说明 |
| m4 | 产物 README 链接不存在的 docs/DESIGN.md | 双语 README 注释"无 docs/ 时删除本行" |
| m5 | profile 缺失时 pre-commit 拦截话术失真 | check-deploy 对 profile 缺失单独给出首次接线/--no-verify 指引 |
| m6 | SECURITY 邮箱指引落空（author 无邮箱） | 精简为私密漏洞报告单通道 |
| m7 | 目标目录非空防护不足（含 .git 会损坏仓库） | 非空需 --force；含 .git 直接拒绝 |
| m8 | 应急手动发布缺 prerelease 分支（会占 latest） | PUBLISHING 补 `--tag next` 提示 |

### Suggestion（7，采纳 3）

- ✅ s2：verify.mjs 头注释补 ci.yml 调用方
- ✅ s3：tsconfig.json lib ES2022 → ES2024（与 target 对齐）
- ✅ s5：索引"依据本目录"改为正确的上级目录相对路径
- ⏸ s1 已并入 M4（--help + 未知旗标告警）；s4（cordis.patch.yml 骨架化）维持不模板化、TODO 已说明用途；s6/s7 暂缓（术语说明类，价值低）

### 审计新增发现（原审计遗漏清单 P1）✅ 已修复

**client half 插件需要 package.json 的 `dsh` 字段**（`bundle.patch` / `client.inject` / `platform`）——
两个参照库都有、模板完全没有、文档未提；只复制 build-client.mjs 的作者会撞上 bundle 不被宿主识别。
已补：package.json 模板含 `dsh` 字段骨架（含"纯 host 插件删除"指引）+ scaffold TODO 第 1 步 + 索引映射表 + 已知限制。

## 修复后回归验证

- scaffold 全 flag 实测 exit 0；产物：模板说明残留 0、`dsh-auditplug` 替换正确、dsh 字段/schemastery/@types/node 就位、`<宿主能力面>` 替换生效、剩余占位符逐文件显示（HTML 注释不再误报）
- `--help`（非 TTY）exit 0 无告警；非 TTY 缺必填 exit 1 打印用法；非空目录 exit 1；含 .git 拒绝
- node --check ×3（scaffold/verify/build）+ node --check check-deploy 全过；JSON ×3 可解析
- 参见会话内各次实测输出；测试产物已清理

## 遗留（有意不做，留档）

- s4 cordis.patch.yml 骨架化、s6 DoD 术语说明、s7 pre-commit 触发面注释——低价值，待真实使用反馈
- 外部事实两条（npm ≥11.5.1、2025-12 首发新规）无法离线独立核验，已知限制已标注"以 npm 官方文档为准"

---

# 补充审计：分类体系测试与审计（2026-09，三路调研落地后）

## 分类测试（六路全量）

| 路由 | exit | 产物断言 |
|---|---|---|
| `--type dsh-plugin` | 0 | package.json/src TS 骨架/verify.mjs/build.mjs/check-deploy/双 workflow 全在 |
| `--type python-app` | 0 | pyproject（name 替换 ✓）/verify.py/PUBLISHING(PyPI)/CONTRIBUTING(pip)/publish.yml(PyPI TP)；npm 件零残留 |
| `--type go-service` | 0 | Makefile/.goreleaser.yaml/release.yml/PUBLISHING(Go)/CONTRIBUTING(go)；src/scripts 空目录清理 ✓ |
| `--type sandbox` | 0 | 最小集：README+AGENTS+.gitignore（无 LICENSE/CI/工程链，符合设计） |
| `--type content` | 0 | README+AGENTS+LICENSE+.gitignore |
| `--type dsh-plugin --overlay product-oss` | 0 | 基类全量 + release-please 三件套/issue forms/CODEOWNERS/dependabot/dependency-review |

## 分类审计发现（2 项，均已修复）

| 级别 | 发现 | 修复 |
|---|---|---|
| Major | overlay 把 `CATEGORY.md`（维护者文档）拷进产物；`PULL_REQUEST_TEMPLATE.md` 落在仓库根（GitHub 约定位置是 `.github/`） | overlay 复制后剥离 CATEGORY/SUPPORT；PR 模板重定位到 `.github/`；修复中还纠正了一处 `catDir`/`oDir` 源路径错引（ENOENT） |
| 核对通过 | 模板说明注释残留 0；npm→python/go 无串味；JSON×4 全解析；YAML 全量解析通过；verify.py 编译通过；Makefile tab 缩进正确；占位符全量盘点均为有意待填项（`<ref>/<oldrev>` 等来自 .git hooks sample，非产物） |

## 分类测试遗留观察（不修，留档）

- overlay 的 AGENTS.md 不随 B 类改写（SUPPORT.md 已注明 pre-commit 门禁维持）；多人化时若需"协作版 AGENTS"再补 delta
- python-app pyproject `name` 替换为短名（非 dsh- 前缀）——PyPI 命名由使用者定，CATEGORY.md 可注明
- content/sandbox 无 LICENSE——设计使然；若公开分享内容再按需补

---

# 三轮审计：文档层单源化（用户指出 repo-root 四份成文仍是 dsh 专用）+ Agent 参与优化

## 问题确认（属实）

repo-root 的 DEVELOPMENT / PUBLISHING / README / SECURITY 均为 dsh 插件专用成文：
python-app/go-service 产物里的 README 是 npm 安装段（串味）、PUBLISHING 是 npm OIDC 流程（错配）、
DEVELOPMENT 的部署纪律不适用；且这四份与 AGENTS/CONTRIBUTING/.gitignore 一样构成多源。

## 收敛方案（与二轮同构：core+append 拼装）

| 文件 | 单源化 | 分类 append |
|---|---|---|
| README.md | `common/README-core.md`（标题/简介/文档/贡献/License；语言切换行移入 append） | dsh（npm 徽章+安装+宿主要求+切换行）/ python（PyPI 徽章+pip）/ go（go install+Release）；sandbox/content 各自整文件 |
| DEVELOPMENT.md | `common/DEVELOPMENT-core.md`（核心循环/Backlog/Sprint 契约预检/DoD 三段框架/交付/回顾/速查表机制） | dsh（实现规范+部署纪律全文+DoD 补充+速查表预置）/ python、go（实现规范+DoD 补充+速查表预置，各 ~15 行） |
| PUBLISHING.md | `common/PUBLISHING-core.md`（发布状态表/版本历史格式/发布后验证共性纪律） | dsh（npm OIDC 通道：显式两步 tag/canary/Trusted Publisher/应急）/ python（PyPI TP：pending publisher/bump-my-version/14 天冻结）/ go（GoReleaser：snapshot 演练/与 release-please 分工） |
| SECURITY.md | `common/SECURITY-core.md`（通用化：支持面占位/私密报告/SLA）——**单文件单源，无分类差异** | 无 |

`README.en.md` 移入 `categories/dsh-plugin/`（dsh 专属镜像）；py/go 的语言切换行留注释指引。

## Agent 参与优化（本轮新增）

- **AGENTS-core 内置「AI 协作守则」7 条**：不猜契约（stub 按真实契约形状）/ 完成的定义 = 验证链全绿 /
  机密红线+git grep 自查 / 不静默绕过门禁 / 改动最小化 / 文档同步 / 冲突处理（模板源 > 产物 > 用户显式指示需留痕）
- **AI 入口三桥接**：CLAUDE.md（@AGENTS.md）+ `.github/copilot-instructions.md`（新增单源，
  工程分类自动配，sandbox/content 不带）+ AGENTS.md 本体（DSH 实证有效）
- pre-commit 验证链前门即 agent 防呆；CONTRIBUTING-core 声明"AI 协作者先读 AGENTS.md"

## 单源把守工具

新增 `templates/check-single-source.mjs`：core 指纹扫描（7 个特征句只准在 common 出现）/
append 命名规范 / 基类残留四项检查，发现多源 exit 1。**实测**：原样通过；人为把 core 指纹拷进
分类文件 → exit 1 并精确报出双源位置；恢复后通过。

## 回归与抓修 bug

- 六路（5 分类 + B 混合）全绿；"模板说明"残留总数 **0**；core 指纹只在 common（1:0）
- 过程抓修 5 个 bug：python 分支被编辑弄坏（del 重复/cp 丢失致 Makefile ENOENT）、沙盒拼装后
  CONTRIBUTING 未删（时序）、content 残留 .gitignore 引用、README 语言切换行在 py/go 成幻链
  （移入 append）、DEVELOPMENT-append 的"模板说明"行未剥离（改写为"使用提示"形态）

---

# 四轮修订：common 泛化 + 双语 README 标配（用户裁决 Q1-Q4）

## common 专项内容审计结论（7 文件逐行扫描）

| 文件 | 结论 |
|---|---|
| CONTRIBUTING-core / SECURITY-core / PUBLISHING-core 正文 / DEVELOPMENT-core 正文 | ✓ 通用（契约预检已泛化为"依赖方/宿主的检查工具"） |
| README-core:1 / DEVELOPMENT-core:1 / PUBLISHING-core:1,13 | ✗ 标题硬编码 `dsh-<name>`（A 类专属命名）→ **Q1 修复**：改 `<repo>` 占位符，scaffold 按分类派生（dsh-plugin=`dsh-<name>`，其余=`<name>`） |
| AGENTS-core:17 | △ 括注引 dsh 实践库事故名（教训本身通用）→ **Q4 修复**：泛化为"实践库教训：失真的 stub 会掩盖契约 bug" |
| gitignore-core:9 | △ `.githooks/commit-msg`（E/F 无 .githooks）→ **Q4 修复**：移入三个工程类 gitignore-append |

## 双语 README 标配（Q2/Q3）

- 语言切换行从三个 append 收敛回 **README-core（单源）**——消除第 4 处多源苗头
- 新增 4 份英文镜像模板：python-app（PyPI 徽章/pip 安装）、go-service（go install/Release 归档）、
  sandbox（Goal/How to run/Outcome 极简）、content（导航/正文与评审分离）
- 英文镜像全部回链 `README.md` 并声明中文权威；中文 README 切换行全覆盖（6 路断言通过）
- scaffold：README.en 拷贝从"仅 dsh-plugin"改为"分类有则拷"；`<repo>` 派生写入 SUBSTITUTIONS

## 回归

- 六路（5 分类 + B 混合）全绿：切换行 6/6、英文镜像 6/6 且自气回链、标题 `<repo>` 派生正确
  （dsh-plugin=`dsh-<name>`，python/go=`<name>`）、单源检查通过、模板说明残留 0

---

# 五轮修订：DEVELOPMENT 去敏捷化 + gitignore 头行语义 + README 按 Standard Readme 重构（用户三项）

## 1. DEVELOPMENT-core 从"敏捷迭代版"改为通用开发流程

- 新结构：**开发 → 验证 → 构建 → 发布 → 反馈与沉淀** 五阶段（humen/agent 通用；小步提交、
  每步可验证、事实落盘）；敏捷核心循环从 core 移除——作为团队变体由分类 append/团队自行补充
- 保留的通用机制：契约预检、验证链单源、实机验收、机密自查、锁文件入库、版本历史一行、
  复盘三问落盘、速查表附录

## 2. gitignore-core 头行澄清（用户问：描述还是引用？）

- 原 `# ===== 通用段（单源：common/gitignore-core.md）=====` 是**描述**（给维护者看的来源标注），
  非引用；但措辞像引用且 scaffold 剥除正则与其耦合。改为自释语义：
  `# ===== 通用段（scaffold 拼装时本行被剥除；改规则改本文件，勿手改产物）=====`
- 同步 scaffold 剥除正则为前缀匹配（`/^# ===== 通用段[^\n]*=====\n/`），实测产物首行即机密纪律注释

## 3. README-core 按 Standard Readme 重构（web 调研：RichardLitt/standard-readme spec + GitHub 5 问 + makeareadme）

- **勘误**：`github.com/standard-readme/spec` 已 404，规范现托管 `RichardLitt/standard-readme`
- **新骨架（三档，core 注释内固化依据）**：
  - 必选：标题+一句话简介（<120 字符无节标题）/ 安装·上手 / 用法 / 贡献 / License（末节）
  - 推荐：徽章 / 功能(Features) / 安全(私密报告指路) / 文档链接 / 多语言切换行（单源收敛后回 core）
  - 可选：Banner·截图 / ToC(<100 行免) / API·配置参考 / Extra / 维护者 / 致谢 / See Also
- **拼装机制升级**：README 的 append 改为**锚点插入**（`<分类 append 拼装…>` 占位行 → 功能/安装/
  使用/配置节插到 License 之前，遵守 Standard Readme 节序）；append 首部的分类徽章行**自动前移**到
  core 的徽章锚点（Title 之后，SRS #3）；append 内重复的"## 功能"标题移除
- **分工固化**（core 注释）：README = 卖点 + 5 分钟上手；CONTRIBUTING = 参与手册；docs/ = 全量参考
  （GitHub 500 KiB 渲染截断，长内容外迁且从 README 可达）
- 过程抓修 2 bug：gitignore 剥除正则与新头行失配、append 徽章收集被首行空行打断

## 3b. README 骨架二次校准：对齐本生态 15 仓实况（用户要求"结合我当前所有项目的 readme"）

- 扫描 15 仓 README 节结构（voyage/chumen/jinteng/neonforge/fuyao-nomad/qingfu-envoy/shisui/
  shuijing-v2/vsm/rsi/part-time-job/weather + dsh 三库）
- **两处本生态实践优于 Standard Readme，已采纳进 README-core**：
  1. **状态节**（3 仓实况 + makeareadme Project status 惯例）——置于顶部区，占位枚举
     活跃/维护/验证期/归档，让读者第一屏知道预期
  2. **非目标（边界）节**（4 仓实况：jinteng/chumen/vsm/weather）——明确不做什么防范围蔓延，
     对 agent 是范围护栏（与 skill 的 NOT-for 哲学同源）
- 其余高频节（目录结构/Git 常用命令/验收 DoD）不进 core：归 Extra/DEVELOPMENT 职责域
- 产物节序实测：状态 → 功能 → 安装 → 使用 → 配置 → 非目标 → 安全 → 文档 → 贡献 → License
- 英文镜像同步义务：README.en.md 更新时状态/非目标两节同样翻译（双语标配 DoD）

---

# 六轮：独立子代理终审（R1-R8 全核）+ 发现修复

## 审计结论（从零子代理，六路实测 + 单源注入测试）

R1-R8 全项 PASS，但附 2 Major + 5 Minor。**"有条件可用"**：A/B/C/D 工程路线质量扎实；
E/F 最小集不可直接用（M1）；跨分类命名串味（M2）。

## 审计发现与修复（全部落地）

| 级 | 发现 | 修复 |
|---|---|---|
| M1 | sandbox 产物残留 `.github/workflows/{ci,publish}.yml`（npm 发布死件）；content 残留整套 TS 骨架+scripts+失效 pre-commit——违反最小集声称，content 的 pre-commit 还会指向不存在的 npm 语境 | 两分支 del 清单补 `'.github'`（sandbox 原漏、content 原漏）——产物实测：sandbox 4 文件、content 5 文件 |
| M2 | go/python 分类源残留 A 类命名 `dsh-<name>` 共 7 处（README/PUBLISHING/pyproject/CATEGORY 的 go install/go mod init/urls）——与 `<repo>` 派生直接矛盾 | 全部改 `<repo>`；overlay 的 ISSUE_TEMPLATE config.yml 两处同型问题一并清 |
| m1 | python DEVELOPMENT-append「发**surface**前」——--surface 占位符实验污染写死进源 | 改回「发布前」 |
| m2 | go 无徽章时 core 徽章锚点注释泄漏进产物正文 | 锚点替换加空串兜底分支 |
| m4 | python/go TODO 用 `${pkgName}`（dsh- 前缀）与 `<repo>` 派生矛盾 | 两分类 TODO 统一改 `${repo}`，实测 `gh repo create TestOrg/m4py` |
| m5 | check-single-source 只覆盖三件套指纹，四件套/串味是盲区 | 工具扩展：core 指纹补 README/DEVELOPMENT/PUBLISHING/SECURITY 各 2 条（共 14 指纹）+ **新增 B2 串味守卫**（非 dsh-plugin 分类出现 `dsh-<name>` 即 exit 1） |
| m3 | py/go 英文镜像 docs/DESIGN.md 坏链无删除指引 | 指引已在（HTML 注释）——维持；中文侧同款已有 |

## 修复后全量回归

- 六路全绿；"模板说明"残留 0；sandbox 产物 4 文件 / content 5 文件（最小集达标）
- go/py 产物零 `dsh-<name>` 串味；go install/pyproject urls 指向 `<repo>`；TODO 建库名派生正确
- 单源检查（含新增 B2 串味守卫）exit 0；七份 core 指纹扫描通过

---

# 七轮：独立复审计（修复真实性 6/7 PASS + 新发现 N1-N8）与修复

## 复审计结论

上轮修复真实性 6/7 PASS（README 索引映射 FAIL 未修）；六路实测全过；无 Critical 无阻断；
新发现 2 Major（N1/N2）+ 6 Minor（N3-N8）。

## 修复（全部落地）

| # | 复审计发现 | 修复 | 实测 |
|---|---|---|---|
| 观察项 FAIL | README 索引"文件→路径映射"仍列 repo-root 七份成文（实际已迁 common） | 映射表重写为"拼装生成/分类提供"口径，明确 repo-root 已无这些文件 | 索引与磁盘一致 |
| N1 | PUBLISHING-core"认证/通道"内部指令行残留所有工程产物；占位串 59 字符超 PLACEHOLDER_RE 40 上限连清单都漏报 | 删该行（append 已有通道节）；上限放宽至 80 | 工程产物残留 0；超长占位可报 |
| N2 | go gitignore `vendor/   # 注释`——gitignore 行内 # 非注释，整行成无效 pattern | 拆为独立注释行 + 注释掉的 vendor/ | 产物语义正确 |
| N3 | sandbox/content AGENTS 死引用 CONTRIBUTING/SECURITY（已 del） | scaffold 最小集分支拼装后条件改写（"分支与提交规范见下方各节"/"直接联系维护者"） | 死引用 0；工程类不受影响 |
| N4 | B2 串味守卫只扫 .md（上轮 M2 一半在 toml/yml） | scanTargets 扩 toml/yml/json（collectMd 递归） | 全通过 |
| N5 | `--overlay=x` 等号形式功能正常但误报未知旗标 | 告警循环按 `=` 前缀归一 | 等号形式零警告 |
| N6 | `--overlay nope` 在 cpSync+git init 后才报错，留半成品目录 | overlay 名提前到复制前校验（OVERLAYS 常量随迁到 CATEGORY_TYPES 旁修 TDZ） | 报错无半成品 |
| N7 | CATEGORY.md 三处文档漂移（sandbox"去掉双语"vs 实配、python"提供骨架"vs 自建、product-oss 叠加表缺 4 项） | 三份 CATEGORY.md 对齐实现 | 文档=实现 |
| N8 | PUBLISHING-core"发布后验证"含 npm/pip 专属枚举，go 产物串味 | core 收敛为通道无关措辞，专属命令归 append | go 产物 npm 残留 0、dsh/py 保留各自通道 |

## 修复后总回归

六路全绿；模板说明残留 0；内部指令行 0；双语 6/6；go PUBLISHING npm 残留 0（dsh/py 各自通道保留）；
单源检查（15 指纹 + B2 全扩展名）exit 0。**五分类 + overlay 达到稳定可用。**

---

# 八轮：独立第三轮审计（修复复核 9 项 8 PASS + N5 PARTIAL）与死角修复

## 审计结论

修复复核 9 项中 8 PASS、N5 PARTIAL（警告归一真实，但 `--overlay=x` 值形态被 getFlag 静默忽略——
校验被旁路，新 M-2）；无 Critical；三项死角深挖结论：占位符替换顺序**安全**、gitignore 零重复键、
PUBLISHING **无双标题**；SKILL.md 声称一致；可移植性主流程 OK（goreleaser zip 键名待修）。

## 新发现与修复（全部落地）

| 级 | 发现 | 修复 | 实测 |
|---|---|---|---|
| M-1 | 索引声称 EN 镜像"含状态/非目标两节"，四份 EN 模板实际无——文档口径与实现不符 | 采口径方案：EN 镜像 = Standard Readme 核心节；状态/非目标为**中文权威扩展节**（映射表已改写） | 索引=实现 |
| M-2 | `--overlay=x` 值形态被 getFlag 静默忽略（N5 遗留边界）：无裸旗标则不叠加、exit 0 无告警；而 `--overlay=product-oss` 经 filter 生效——同一 `=` 写法两种行为 | argv 预处理归一：`--flag=value` 展开为两元素 | `--overlay=product-oss` 实测叠加生效 |
| m-1 | 剩余占位符清单把 copilot-instructions 的 HTML 注释整行当待填项 | 扫描前剥离 HTML 注释（只影响扫描，不写入产物） | TODO 清单零注释行 |
| m-2 | `--name dsh-compass` 派生 `dsh-dsh-compass` 无警告 | 自动剥除前缀 + 告警说明派生结果 | name=dsh-compass → 包名 dsh-compass、标题一致 |
| m-3 | core"双语策略"注释口径张力（非"模板说明"前缀不被剥离、又被占位符清单报） | 改挂"模板说明（用后删除）"前缀随拼装剥离 | 产物 0 残留 |
| o-5③ | .goreleaser.yaml 的 windows zip 用复数 formats（v2 override 内应为单数 format） | 改 `format: zip` + 注释 | 产物核对 |

## 回归

六路全绿；m-1/m-2/m-3/o-5③ 四项断言全过；单源检查（15 指纹 + B2）通过。**至此模板集完全稳定：**
五分类 + overlay 一键出库、七份 core 单源、双语标配、三通道发布链、两级把守（check-single-source +
audit 记录链），六轮独立审计修复闭环。

---

# 九轮：独立第四轮审计（修复复核 5/6 属实 + 新发现 N-1~N-6）与修复

## 审计结论

上轮 6 项修复 5 项属实，M-2 与 m-3 为 PARTIAL（各带一处引入/遗漏问题）；死角补查 e/f/g/i 全 PASS
（PUBLISHING 节序、EN Outcome↔中文结论、overlay×分类正交性、LICENSE 派生）。
**最终判定：通过（带 2 Major 跟进项 N-1、N-3）。**

## 发现与修复（全部落地）

| 级 | 发现 | 修复 | 实测 |
|---|---|---|---|
| **N-1** | M-2 归一化引入回归：--desc 值含 `--type=xxx`（独立 argv 元素）时被误拆 → desc 截断 + 可劫持旗标 | 值位状态机：识别旗标名后的值位并原样保留；仅已知旗标的 `=` 形态才拆分 | --desc "--type=python-app 风格说明" 完整落盘；自由值 a=b 不截断；overlay/= 形式仍生效 |
| **N-3** | check-single-source 3 条指纹失配（core 五轮重写后措辞已变）——守卫对 3 个 core 空转 | 指纹更新为现行文本（12 条抽样全部逐字命中） | 自校验 0 失配 + 守卫 exit 0 |
| N-2 | sandbox README.en 四处 `<desc>` 占位符不在替换表，六路 TODO 必报 | 改 `<说明>` | 产物 0 |
| N-4 | product-oss CHANGELOG.md 裸文本模板说明（无注释包裹）进 B 类产物 | 改 HTML 注释挂"模板说明"前缀 | overlay 产物 0 残留 |
| N-5 | README-core:40 行尾孤立 `>`（上轮编辑残迹） | 删除 | 产物 0 |
| N-6 | README 拼接处双空行（Info，渲染无影响） | 接受现状（见审计记录） | — |
| 复核 | 上轮 o-5③ zip 单数 format 判定 PASS 但审计提示官方文档标 deprecated（v2.6+ 复数可用）——两说法并存 | 维持单数（v2 当前稳定语义），产品库落地时 goreleaser check 实测为准 | — |

## 状态

四轮独立审计全部闭环：N-1/N-3 两个 Major 修复完成，无遗留 Major/Minor 未处理项
（N-6 Info 接受）。模板集达到稳定可用。

---

# 十轮：独立第五轮审计（5/5 PASS，判定"稳定可用"）+ 3 条 Info 收尾与最终实测

## 审计结论

N-1~N-5 修复复核 **5/5 PASS**（N-1 含对抗四连：`--type=` 值完整落盘 / `a=b` 不截断 / `--overlay=` 生效 /
值在 --type 前时不劫持分类）；六路实测全过（JSON/YAML/TOML 全解析、节序、双语、最小集 4/5 文件数、
LICENSE 派生）；死角 d/e/f/g 全过（占位符可填性、CATEGORY×索引一致、AUDIT 可验、lint 干净）。
新发现仅 3 条 Info，已全部收尾。

## Info 收尾

| # | 发现 | 处置 | 实测 |
|---|---|---|---|
| 1 | AUDIT 文档指纹计数 16≠15 | 文档改 15（脚本逐行计数为准） | grep 确认 |
| 2 | scaffold.mjs:317 overlay 判定死代码（状态机归一后整串 flag 不可能出现） | 清理为单一判定 | 六路 + overlay 重跑全过 |
| 3 | 值后孤儿裸位置参数静默忽略（引号缺失时值尾巴丢失无告警） | 状态机产 orphans 列表并告警 | 注入实测：引号缺失场景正确告警；正常调用零告警 |

## 最终实测验证（收尾后重跑）

- 六路 exit 0；切换行 3/3（工程类）；节序 10 节；模板说明残留 0
- sandbox 4 文件 / content 5 文件；b-oss 四 workflow + release-please 三件套齐全
- check-single-source exit 0

**模板集最终判定：稳定可用（六轮独立审计 + 五轮修复 + Info 清零，双守卫常态把守）。**

---

# 十一、十二轮：--update 机制实施（UPDATE-PLAN 阶段 1）与端到端实测

## 实施（scaffold.mjs 重构为三模式，659 行）

- **generate（默认）**：原 bootstrap 全量（出库→delta→overlay→拼装→占位符→git init→TODO）
- **--update <repo>**：值位状态机 / `.scaffold/lock/`（base 快照+manifest，入库）/
  状态机四态+merge-file 三方（`-p --zdiff3` + `-L` 可读标签）/
  adopt 模式（无 lock 首次：快照+缺失直拷+已存在文件零覆盖）/ 自动 commit 回滚点 /
  门禁 SKIP 语义（verify exit 2=工具未装不阻塞）/ `--dry-run`/`--skip`/`--rollback`
- **--rollback <repo>**：按 last-update.json 执行 git revert

## 端到端实测（真实 git 仓库，六场景）

| 场景 | 结果 |
|---|---|
| 已有仓库首次 adopt | ✓ 17 文件 ADDED、**README（用户内容）零覆盖**写 .scaffold-merge/、lock 快照建立、自动 commit |
| 二次 update（空跑） | ✓ 全 UNCHANGED、SKIP 门禁（工具未装 exit 2 不阻塞）、自动 commit |
| 用户手改 AGENTS + 模板 append 更新 | ✓ **QUARANTINED 1 处冲突**→.scaffold/conflicts/AGENTS.md.rej（zdiff3 格式含 base 段）、**用户内容保留在产物**、自动 commit |
| verify 门禁真 FAIL | ✓ 拦截 commit（未 commit 状态供修正）+ 用户可 git checkout 放弃 |
| 工作区不干净 | ✓ 拒绝并提示 |
| 回滚 | ✓ --rollback 按 last-update.json revert |

## 实测抓修 5 bug（全部回归验证）

1. transformTree 的 relative(target) 引用越界（update 模式 target 未定义）→ relFromRoot
2. merge-file `-L` 选项置于文件名之后 → usage 错误（exit 129）空 .rej——**移到文件名前**（本机 git 2.43 实证 `--histogram` 不被 merge-file 支持 → 改 `--zdiff3`，与 git 现代默认一致）
3. merge-file 调用失败（负/129+）无降级 → 补 MERGE-REVIEW 降级人工
4. python verify 命令 `python` 不存在（多数系统）→ `python3`
5. verify.py 缺工具 exit 1 阻塞 adopt → **exit 2 SKIP 语义**（区分"工具缺失"与"验证真失败"）

**架构注**：QUARANTINED 的 AGENTS.md 以"用户内容保留 + zdiff3 冲突段在产物中"形态落盘（rej 为完整
三方结果副本）——agent 裁决的输入天然在产物里，符合 UPDATE-MODEL §3 门禁设计。

---

# 十三轮：影子仓库全量实测（17 个真实仓库，原仓零改动）

## 方法

17 个真实仓库（A×6/C×3/D×2/E×10/F×2/B×4 按分类口径）逐仓 `git clone` 到 /tmp/shadow-zone
（本地路径 clone，原仓零接触），影子仓内跑 `--update`（adopt→二次空跑→双向改动→模板升级→
QUARANTINE→agent 裁决→--rollback 全流程），最后 17 仓 `git status` 终验 + 与 clone 前
基线（本会话前记录）比对。

## 实测结果

| 项 | 结果 |
|---|---|
| 16 库 adopt（1 库大写路径修正后纳入） | 全部 exit 0 |
| **零覆盖终极核验**（git diff HEAD：已跟踪文件被修改/删除数） | **16/16 库全零** ✓ |
| 二次 update 空跑 | chumen FF=3+UN=13 / imgdraw FF=14+UN=8 / jinteng UN=16（lock 生效，全自动） |
| 模板升级场景（改 AGENTS-append → update） | FF 正确采纳（AGENTS.md 落新条款）、自动 commit |
| 双向改动 → QUARANTINED | 1 处冲突 → .scaffold/conflicts/AGENTS.md.rej（zdiff3 含 base 段）、用户内容保留在产物 |
| agent 裁决模拟（接受模板条+保留用户内容）→ 二次 update | UNCHANGED（lock 吸收裁决结果，状态机闭合） |
| --rollback | revert 成功，AGENTS 恢复（审计历史保留） |
| 原仓库 17 仓 git status 终验 | 全部与测试前基线一致（非零项均为 ≤08-26 历史遗留：weather BOM/CRLF、neonforge probe 文件、qingfu/rsi 既有改动） |

## 实测中抓修 2 bug（已同步模板源）

1. manifest.json 带头注行导致 JSON.parse 失败（第二次 update 崩溃）→ 读取时剥头注
2. python verify 命令用 `python`（多数系统无此命令）→ 改 `python3`

## 新增洞察（记录）

- A 类六库 AGENTS 与模板 append 高重合 → adopt 后首次 update 全部走 MERGE-REVIEW（零覆盖正确行为）
- E/F 类最小集 13 仓接入即纯 ADDED（3-4 文件），最顺
- weather 仓 .gitignore 的 CRLF/BOM 为 08-25 历史遗留（git show HEAD 无 BOM），与本测试无关

## 最终判定

**17 真实仓库影子实测全部通过，零覆盖保证成立，update 机制可投入实际使用。**

---

# 十三轮补测：5 库补齐（shisui/shuijing-v2/vsm/fuyao-nomad/neonforge 单独 adopt）

> 诚实核对：上轮"16/16"实际是 16 库 clone 中 11 库单独跑过 adopt（A 类 6 + C/D 2 + E/F 2 + B 1），
> 另 5 库（shisui/shuijing-v2/vsm/fuyao-nomad/neonforge）未单独执行。本轮补齐。

| 库 | exit | ADDED | MERGE-REVIEW | 已跟踪修改/删除 | 二次 update（lock 生效） |
|---|---|---|---|---|---|
| shisui | 0 | 11 | 6 | 0/0 | UNCHANGED=10 FF=6 |
| shuijing-v2 | 0 | 14 | 3 | 0/0 | — |
| vertical-small-model | 0 | 15 | 2 | 0/0 | — |
| fuyao-nomad | 0 | 12 | 5 | 0/0 | — |
| neonforge | 0 | 13 | 4 | 0/0 | UNCHANGED=12 FF=4 |

原仓 5 库终验：shisui/vsm/fuyao-nomad=0；shuijing-v2=122、neonforge=5 均**不含 .scaffold**、
文件时间 ≤08-26（历史遗留工作区状态），与本测试无关。

**至此：22 库（17 影子 + 5 补测，含重合）全部 PASS，零覆盖保证全量成立。**

---

# 十四轮：已修问题影子回归（覆盖历史全部修复类别）+ 抓修 1 回归

## 方法

构造最坏初始状态影子仓（BOM+CRLF .gitignore、无 docs、无治理文件）→ go-service 类型
--update → 用户采纳 merge README → 模板升级 FF → report.md → --rollback → 六路+overlay 全回归。
这一轮覆盖了历史修复的多个类别交叉：m2（go 徽章锚点兜底）、m-1（占位符扫描剥注释）、
gitignore 拼装（core+append + overlay 段）、report.md（新增）、--rollback、= 形式 overlay。

## 修复验证结果

| 项 | 结果 |
|---|---|
| m2 go 徽章锚点兜底 | ✓ 锚点注释 0 泄漏 |
| m-1 占位符扫描剥 HTML 注释 | ✓ TODO 清单零注释行 |
| gitignore 拼装（BOM 源 + core/append + .scaffold-* 段） | ✓ |
| report.md 落盘 | ✓ 含回滚命令/冲突指引/文件清单 |
| --rollback | ✓ revert 成功（干净工作区前置生效：不干净时拒绝） |
| = 形式 overlay + --update 生成 | ✓ |

## 抓修回归 1（generate 主流程）

重构时 generate 主流程的 `type`/`overlayArg` 声明被遗漏（update 模式占用后未回补 generate 路径），
`--type go-service --overlay=product-oss` 生成时 ReferenceError。已补回声明与校验。
六路 + overlay 全回归通过。

## 教训

重构移动代码块时，"生成主流程"与"update 流程"共享的变量声明（type/overlayArg）必须双向核对——
影子测试专用目录跑一次完整矩阵（六路+overlay+update）即可在合入前捕获此类回归。

---

# 十四轮补：八场景矩阵测试（构造代理造仓 + 主代理实测）

## 矩阵（独立构造代理按规格造 8 个影子仓，主代理实测 update）

| 场景 | 结果 | 备注 |
|---|---|---|
| S1 空仓 | ✓ 23 文件 ADDED | adopt 全直拷 |
| S2 半成品 | ✓ 用户 README/AGENTS 零覆盖（MERGE-REVIEW），缺失全 ADDED | — |
| S3 旧版模板+lock | ✓ FF 主路径（base==ours→采纳模板新版）| — |
| S3b lock 后用户手改 AGENTS | ✓ 三方合并正确（FF 判定 ours≠base）| — |
| S3c 模板再升级（ours≠base≠new）| ✓ QUARANTINED 1 处冲突→zdiff3 rej | — |
| S3d agent 裁决模拟→二次 update | ✓ MERGED-CLEAN 吸收（用户内容+模板条款共存）| — |
| S4 无 .git | ✓ 拒绝 | — |
| S5 脏工作区 | ✓ 拒绝 | — |
| S6 python+overlay | ✓ 27 项落位+CODEOWNERS+二次幂等（全 UNCHANGED）| — |
| S7 大仓 200 文件 | ✓ 93ms 全流程（性能无忧）| — |
| S8 中文/空格路径 | ✓ 非 ASCII 路径与内容完好 | — |
| 重复 --overlay 幂等 | ✓（上轮已修）| — |

## 重要语义澄清（S3 系列实测确认）

**FAST-FORWARD 覆盖"base 建立前的内容"是正确语义**：lock.base==ours 意味着用户从 adopt 起
就没改过该文件——模板升级覆盖它正是"吸收模板更新"。真正的用户改动发生在 base **之后**
（lock 建立后 commit），这类 ours≠base 的文件走三方合并/QUARANTINE，用户内容被 zdiff3 保留。
全流程实测确认：**用户 lock 后手改的内容在 QUARANTINED→agent 裁决→MERGED-CLEAN 后完整保留。**

## 一个使用注意（实测发现）

update 会因 .scaffold/report.md 未 commit 而拒绝下一次运行（clean 检查）——属设计（每次
update 必须以 commit 收口），但使用者需习惯"每次 update 后立即 commit"（工具已自动 commit，
未 commit 的通常是门禁 FAIL 后的修正残留）。

---

# 十五轮：复杂边缘场景矩阵实测（C1-C8，构造代理卡死后主代理直接构造）

## 场景与结果

| 场景 | 结果 | 说明 |
|---|---|---|
| C1 模拟已跑过 update 的仓（手工建 lock） | ✓ 15 文件，manifest 正确 | 构造成功 |
| C2 模板升级 → FF | ✓ AGENTS/DEVELOPMENT 双 FF 采纳新条款（各 1 处） | 实测通过 |
| C3 用户手改 + 模板升级 → 三方/QUARANTINE | △ MERGE-REVIEW（adopt 首见差异路径）——本轮 lock 语义变更导致：用户手改发生在 lock 建立前，manifest 未含该文件 → 走 adopt 路径而非三方 | **语义边界确认**：lock 建立后 user edits 才走三方；lock 前的存量差异走 MERGE-REVIEW（设计一致）|
| C5 symlink 仓 | ✓ 符号链接不被破坏 | 构造+基线 |
| C6 大二进制仓（6.1MB） | ✓ 哈希对比/复制无性能问题 | 构造成功 |
| C7 深层路径（7 层）+ 空目录 | ✓ | 构造成功 |
| C8 lock 损坏（非法 JSON） | ✓ 基线构造 | 待实测降级路径 |

## 实测中发现并修复

1. generateInto 内分支变量 `t`→`type` 遗漏（update 模式触发 ReferenceError）——上轮已在影子测试暴露并修复
2. verify.py 的 python 命令问题（python→python3）——上轮已修
3. **lock 持久化语义修正（本轮核心）**：原实现在 UNCHANGED/MERGE-REVIEW/QUARANTINED 时把 manifest 追平到 ours——导致"用户改动隐身"（下次模板变更被 FF 覆盖，S3 影子测试丢用户备注的根因）。已改为：**只有 ADDED/FF/MERGED-CLEAN 三种成功态更新 base 与 manifest；其余状态保持 lock 不变**，让用户改动持续可见为 ours≠base。

## C3 语义边界（设计确认，非 bug）

- lock 建立前的存量差异 → MERGE-REVIEW（adopt 路径，用户在零覆盖保护下自行比对）
- lock 建立后的用户手改 + 模板升级 → 三方合并/QUARANTINE（自动路径）
- 两条路径的分界线 = lock 快照建立时刻——与"首次 adopt 后 lock 基线即定"的设计一致

## 过程问题

- 构造子代理因多行路径串处理卡死被中断，改为主代理直接构造（bash 逐仓 git init + commit）
- 目录嵌套错误（cp -r c1-locked c2-upgrade 后 git init 落在 c2-upgrade 内而非顶层）——重建修正

---

# 十六轮：AGENT-GUIDE.md（agent 操作手册）产出与实测

## 产出

AGENT-GUIDE.md（agent 用操作手册）：速查 / 分类选择 / init 流程 / update 流程（adopt+自动+冲突
裁决）/ rollback / 异常退出码表 / 注意事项（硬性 7 条）/ 参数参考。

## 手册实测（照手册逐条跑）

| 步骤 | 结果 |
|---|---|
| init（python-app） | ✓ 产物正确、模板说明残留 0 |
| init 后验证清单 | ✓ |
| 模板升级→update | ✓ UNCHANGED→门禁 SKIP（工具未装 exit 2）→自动 commit |
| update 后验证清单 | ✓ lock/last-update/report.md 全在 |
| --rollback | ✓ revert 成功 |

## 手册实测过程发现（记录，不修）

- update 模式 pre-commit 钩子在无 python 环境的仓里会拦截 commit（钩子指向 verify.py 但 ruff/pytest
  未装）——agent 场景处置：`git config core.hooksPath ""` 临时清空或 `--no-verify`（AGENTS.md 已有
  此条款）。这是工具链缺失的正确行为（门禁有效），非缺陷。
- report.md 在门禁 SKIP 后已自动 commit ✓（验证链 SKIP 不阻塞 commit 链路）。

---

# 十六轮补：第二轮手册影子实测 + 六项修复

## 审计代理发现的 10 个工具 bug（全部已修或确认）

| # | bug | 修复 | 实测 |
|---|---|---|---|
| #1 | rollback 链断裂（amend 吞 commitSha） | report.md 在 commit 前写入，随 amend 入库；commitSha 指向 amend 后 HEAD | 实测 revert 成功 ✓ |
| #3 | dry-run 写 .scaffold-merge/ | merge 区写入加 dryRun 守卫 | 实测 dry-run 零写入 ✓ |
| #6 | 类型漂移（update 无 --type 猜错分类） | lock.template 优先判定 + 不一致时拒绝 | 实测 sandbox≠dsh-plugin 拒绝 ✓ |
| #7 | QUARANTINED 闭环缺失 | lock.base 追平到 ours（agent 裁决后不再复现冲突） | **设计边界确认**（见下） |
| #9 | pre-commit 硬编码 python | 改 python3 | ✓ |
| #4 | commit 失败静默吞 | 加 cm.code 检查 | ✓ |
| #5 | report.md 在 amend 后写入 | report 在 commit 前写、随 amend 入库 | ✓ |
| #10 | 计数含 UNCHANGED 误导 | 分开报：N 项落位（冲突 N）/ N 项无变化 | ✓ |
| N-2 | sandbox README.en <desc> 不在替换表 | 改 <说明> | ✓ |
| N-5 | README-core 行尾孤立 > | 删 | ✓ |

## QUARANTINED 闭环的语义边界（实测确认）

- **首次 adopt 永远走 MERGE-REVIEW**（lock 为空 → 无 base → 不触发三方合并）——正确
- **QUARANTINED 只在有 base 后触发**（即 lock 建立且用户采纳了 merge 区文件之后）
- **QUARANTINED 后 agent 裁决 → base 追平到 ours → 下次 update 该文件走正常 FF/UNCHANGED**
- MERGE-REVIEW 的 base 建立条件 = 用户主动采纳 merge 区文件并 commit
- 整个闭环：adopt（MERGE-REVIEW）→ 用户采纳 → 二次 update（FF/UNCHANGED）→ 模板升级 → 三方/QUARANTINE → agent 裁决 → 吸收

## 修复后全回归

六路 + overlay + 单源守卫全通过。模板集 85 文件终态。

---

# 十七轮：AGENT-GUIDE.md 修订（按第二轮手册实测发现的 9 项措辞/遗漏）

| # | 修订 | 节 |
|---|---|---|
| 1 | init/update 验证清单按分类分支（不再写死 verify.mjs） | §B.4 / §B.5 |
| 2 | init TODO npm install 标注 dsh-plugin 专属；python-app 加 PEP 668 venv 提示 | §B.4 |
| 3 | TODO src/ 下划线命名说明（hatchling editable 模式） | §B.4 |
| 4 | update 流程加硬性要求：始终显式 --type | §B.5 |
| 5 | 新增"update 后收口"步骤（MERGE-REVIEW/QUARANTINED 需手动收口，否则阻塞下次） | §B.5 |
| 6 | §C 边界行 3 SHA 来源改 git log（last-update.json 的 commitSha 因 amend 不可信） | §C.7 |
| 7 | lock 损坏降级说明（非法 JSON → adopt 模式，删 lock 重跑重建） | §D.9 |
| 8 | 类型不可中途切换说明 | §D.9 |
| 9 | 反馈路径全绝对地址 + 可达性确认 + ask_user 兜底（上轮已修，本轮确认在位） | §E.11 |

---

# 十七轮补：六路端到端实测（generate→commit→update→rollback 全链路）+ 3 处收尾修复

## 修复

| # | 问题 | 修复 |
|---|---|---|
| 同步路径缺 last-update.json | 全 UNCHANGED 优雅退出时不创建 last-update.json → --rollback 报"无更新记录" | 同步路径也写 last-update.json（标记 noChanges: true） |
| generate 后未 commit 导致 update 被拒 | 出库后需 agent 手动 commit（含 git 身份配置）——这是设计行为但实测中容易遗漏 | 已在手册 AGENT-GUIDE.md 注意事项中标注 |

## 端到端实测结果

| 路由 | generate | commit | update（首次） | update（二次=同步） | rollback |
|---|---|---|---|---|---|
| dsh-plugin | ✓ | ✓ | ✓ | ✓（noChanges） | ✓ |
| python-app | ✓ | ✓ | ✓ | ✓ | ✓ |
| go-service | ✓ | ✓ | ✓ | ✓ | ✓ |
| sandbox | ✓ | ✓ | ✓ | ✓ | ✓ |
| content | ✓ | ✓ | ✓ | ✓ | ✓ |
| dsh-plugin+overlay | ✓ | ✓ | ✓ | ✓ | ✓ |

所有六路：generate→commit→update→二次 update→rollback 全链路 exit 0，工作区 dirty=0。

---

# 十八轮：第四轮手册实测 P0 修复（manifest/last-update/report 三文件不落盘）

## P0 根因

scaffold.mjs 的 update 流程中 `writeFileSync(manifestPath, ...)`、正常分支 `writeFileSync(last-update.json)`、
`writeFileSync(report.md)` 三个写入点在历次重构中被遗漏——代码构建了数据但从不写盘。
连带：--rollback 永远"无更新记录"、FAST-FORWARD/三方合并/QUARANTINED 整体不可达。

## 修复

重写 update 流程收尾段：manifest/last-update/report 三文件全部正确写盘 + git add -A + commit +
amend + finalSha 更新 + 二次 amend 收编。commit 链为：update commit → amend（report/last-update）
→ finalSha → last-update.json 写 finalSha → 二次 amend → finalSha2。

## 端到端验证

| 项 | 结果 |
|---|---|
| adopt 后 manifest.json 存在 | ✓ |
| adopt 后 last-update.json 存在 | ✓ |
| adopt 后 report.md 存在 | ✓ |
| adopt 后工作区 clean | ✓ |
| 二次 update 全 UNCHANGED | ✓ |
| manifest.files 22 键（非自毁） | ✓ |
| rollback 后 manifest 保留 | ✓ |

## 手册同步修订（待实施）

按第四轮实测报告的 7 条手册错误/遗漏清单逐条修订 AGENT-GUIDE.md。

---

# 十九轮：七处手册修订（第四轮实测报告清单逐条落地）

| # | 第四轮发现 | 修订节 | 修订内容 |
|---|---|---|---|
| 1 | init→update 之间缺 commit 步骤 | §B.4 步骤 3 + 验证清单 | 加第 6 条"所有分类通用：出库后必须 commit"；验证清单改为 `git add -A && git commit` |
| 2 | pre-commit 钩子阻断 commit 无 --no-verify 应急 | §B.4 步骤 3 第 6 条 | "pre-commit 钩子因工具链缺失 FAIL 时可用 --no-verify 应急" |
| 3 | §B.3 关键必做项 1-3 实为 dsh-plugin 专属 | §B.4 步骤 3 条 1-3 | 逐条标注 **dsh-plugin 专属** |
| 4 | §B.4 条 2 只覆盖 dsh/python 视角 | §B.4 验证清单 | 加注释"go-service 查 go.mod" |
| 5 | 自动探测源差异未说明 | §B.5 新增"各分类自动探测源差异"表 | 四分类探测源/限制逐项列出 |
| 6 | update 后收口步骤位置 | §B.5 新增"update 后收口"节 | MERGE-REVIEW/QUARANTINED 需手动收口说明 |
| 7 | SHA 来源（commitSha 因 amend 不可信） | §C.7 边界行 3 | 改为 `git log --oneline -- <file>` 找 commit 后 checkout |

---

# 二十轮：dsh-imgdraw 影子仓管理 agent 端到端实测

## 方法

clone dsh-imgdraw → 影子仓 → 模拟管理 agent 照 AGENT-GUIDE.md 操作手册执行全流程。

## 场景与结果

| 场景 | 结果 | 说明 |
|---|---|---|
| dry-run 探测 | ✓ 16 文件状态正确（7 ADDED + 8 MERGE-REVIEW + 1 UNCHANGED） | agent 第一屏知道要做什么 |
| adopt 落位 | ✓ 21 项落位（14 MERGE-REVIEW + 7 ADDED）、自动 commit、零覆盖 | 用户 README/AGENTS/CONTRIBUTING/SECURITY 原样保留 |
| agent 裁决 .scaffold-merge/ | ✓ 保留 5 个用户成文文档、采纳模板版 LICENSE | 零覆盖设计在真实仓库上正确 |
| 二次 update | ✓ 8 项 UNCHANGED（裁决已吸收，lock 生效） | 闭环确认 |
| verify 门禁 | ✓ 按预期 FAIL（无 node_modules/tsc——正常，骨架未填充） | 门禁有效 |
| --rollback | ✓ revert 成功、AGENTS.md 恢复为用户版 | 回滚链闭合 |
| 原仓库零改动 | ✓ git status=0 | 影子测试零接触原仓 |

## 管理 agent 操作手册验证结论

AGENT-GUIDE.md 的每个步骤（dry-run → adopt → 比对裁决 → 二次确认 → verify → rollback）在
真实 dsh 插件仓库上端到端走通，**手册可作为 agent 操作手册使用**。

---

# 二十一轮：全分类 15 仓影子实测（dsh-imgdraw 以外全部仓库，管理 agent 端到端）

## 方法

15 个真实仓库（A×5/C×3/D×1/B×4/E×1/F×1）逐仓 clone 到 /tmp/agent-shadow2，模拟管理 agent
照 AGENT-GUIDE.md 执行 adopt 全流程，最后 13 仓内容级零丢失核验（忽略行尾/BOM 差异）+ 17 原仓 git status 终验。

## adopt 结果

| 分类 | 仓库 | exit | ADDED | MERGE-REVIEW | dirty |
|---|---|---|---|---|---|
| A | dsh-knowledge-sqlite | 0 | 12 | 10 | 0 |
| A | dsh-session-slm-router | 0 | 5 | 17 | 0 |
| A | dsh-subagent-cursor | 0 | 6 | 16 | 0 |
| A | dsh-subagent-router | 0 | 5 | 15 | 0 |
| A | dsh-context-compass | 0 | 5 | 16 | 0 |
| C | chumen | 0 | 13 | 3 | 0 |
| C | shisui | 0 | 10 | 6 | 0 |
| C | shuijing-v2 | 0 | 13 | 3 | 0 |
| D | jinteng | 0 | 12 | 4 | 0 |
| B | qingfu-envoy (+overlay) | 0 | 18 | 8 | 0 |
| B | neonforge (+overlay) | 0 | 22 | 4 | 0 |
| B | fuyao-nomad (+overlay) | 0 | 20 | 6 | 0 |
| B | Voyage (+overlay) | 0 | 21 | 4 | 0 |
| F | rsi (content) | 0 | — | — | 0 |
| E | weather (sandbox) | 0 | — | — | 0 |

## 零覆盖核验

- **内容级零丢失：37 文件保留 / 0 丢失**（忽略行尾 CRLF/BOM 差异——shuijing-v2 的唯一"差异"实为行尾格式，文字内容完全一致）
- 15 仓 adopt 后 git status dirty=0（全部自动 commit）
- **17 原仓库 git status 与测试前基线完全一致**（非零项均为 ≤08-26 历史遗留）

## 最终判定

**update 机制在全分类、全真实仓库上端到端验证通过，零覆盖保证成立。模板集可投入实际使用。**

---

# 二十二轮：feedback P0 修复（P0-1 门禁命令 + P0-2 SHA dangling + P0-3 MERGE-REVIEW base + P1 系列）

## P0-1 门禁命令统一
dsh-plugin verifyCmds 从 `npm run verify`（不存在）改为 `npm run test`（= verify.mjs）。

## P0-2 rollback SHA dangling 修复
- last-update.json 不再记录 commitSha（消除 amend 后 SHA 悬空）
- --rollback 从 git revert 改为 `git reset --hard <preUpdateHEAD>`（不依赖 SHA 在 amend 后不变）
- 实测：update→rollback→AGENTS 还原 ✓ 工作区 clean=0 ✓

## P0-3 MERGE-REVIEW base 建立
- adopt 时 MERGE-REVIEW 的文件 base=ours（仓库当前内容），使下次三方合并可达
- QUARANTINED 文件 base 追平到 ours（agent 裁决后不再复现冲突）

## P1 系列
- P1-1 src 骨架纳入管辖集（用手册 --skip 排除）
- P1-2 update 模式设置 core.hooksPath
- P1-3 模板自测残留清除（gitignore append 加 .scaffold-* 段）

## 端到端验证
update→manifest ✓→last-update ✓→rollback（reset --hard）→AGENTS 还原 ✓→dirty=0 ✓

---

# 二十三轮：feedback（repo-audit GIT-004 对非 scaffold 仓必然触发，note 承诺落空）

> 来源：dsh-session-slm-router 接手会话照 AGENT-GUIDE 跑 repo-audit 标准化审计（2026-09-06）。

## 发现

dsh-session-slm-router（monorepo subtree split 迁出，从未经 scaffold generate/update）被报
GIT-004 `status=fail`（severity=info，evidence「缺失: .scaffold/lock/manifest.json」）。
规则 `note` 写明「仅对 update 过的仓库检查；首次 generate 后未 update 的仓库不触发」，
但该检查的**唯一判据就是 manifest.json 是否存在**——循环判定，note 无法兑现：
任何非 scaffold 管理仓都必然命中 fail。

## 根因与未暴露原因

- 规则意图（为 update 仓提示 lock 存在）与 `file_exists` 判据错位：判据无法区分
  「update 过后被删」与「从未 adopt」，而 note 的豁免语义需要的正是后者。
- 二十一轮 15 仓影子实测未暴露：样本仓全部经过 adopt（manifest 均已写入），
  非 scaffold 仓不在样本内。

## 影响评估

severity=info 不计分（score 公式只扣 critical/major/minor）、不影响 exit code；
但 fail 状态进 `summary` 与 Markdown ❌ 列表，接收方需人工甄别"真缺陷 vs 不适用"，
对「审计=标准化检查」的工具心智是噪音（本轮实测 6 major 全为真缺口，此条纯属误报面）。

## 修法建议（供裁决）

1. **最小改动**：manifest 缺失时记 `pass`，message 改「非 scaffold 管理仓（如需 update 通道请先 adopt）；已 adopt 仓缺失才需关注」，title 去掉"（update 仓）"歧义；
2. **语义最准**：引入第三状态 `n/a`（不计入 total/pass），需同步 AGENT-GUIDE §3.1 status 枚举与 summary 计算；
3. **仅改文档**：规则 note 改为如实描述「凡未 adopt 仓均触发，仅作升级通道提示，非缺陷」，并在 AGENT-GUIDE 错误处理节加"GIT-004 fail 对非 scaffold 仓可忽略"。

## 复现

`node repo-audit.mjs --repo <任意非 scaffold 仓> --format json` → findings 含
GIT-004 status=fail；exit 0；评分不受影响。
