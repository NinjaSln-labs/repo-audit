# 个人仓库分类总表（2026-09 扫描）

> 扫描范围：`~/ninjasin-labs/`（maxdepth 3 找 `.git`）。每仓标注：分类 / 证据 / 模板映射。
> 分类按"模板差异"划分而非纯技术栈——差异维度：语言运行时、制品形态（npm 发布/服务部署/无制品）、协作模式（单人直提 main / 多人 PR 流）。

## 分类定义与模板映射

| 分类 | 定义 | 模板 |
|---|---|---|
| **A · dsh 插件单库** | TypeScript + npm 发布 + 宿主 dsh peer；部署纪律（profile file: 安装） | `templates/repo-root/`（基类，`--type dsh-plugin` 默认） |
| **B · 产品/多人协作 OSS** | 有 PR 流（merge commit 实证）/ CHANGELOG / ROADMAP / 双语 README；语言不限 | 对应语言基类（A/C/D）+ `templates/categories/product-oss/` overlay |
| **C · Python 应用/研究** | pyproject.toml + src/ + tests/；pytest/ruff；无 npm | `templates/categories/python-app/`（delta） |
| **D · Go 服务** | go.mod + cmd/ + Makefile | `templates/categories/go-service/`（delta） |
| **E · 本地实验/dogfood 沙盒** | 同构 agents/docs/src/tests 结构、master 分支、无 origin、生命周期短 | `templates/categories/sandbox/`（delta，最小集） |
| **F · 内容/写作** | 文档/文章本体即制品，无构建链 | `templates/categories/content/`（delta，最小集） |
| **G · 存档只读** | 封版仓，禁改禁发布 | **无模板**（遵守仓内封版纪律） |

## 逐仓清单（23 个 git 仓库）

### A · dsh 插件单库 ×6 → repo-root 基类

| 仓库 | 证据 |
|---|---|
| `dsh-ecosystem/dsh-context-compass` | npm 0.11.6、cordis.patch.yml、PUBLISHING/DEVELOPMENT 全套 |
| `dsh-ecosystem/dsh-subagent-router` | npm 0.4.0、OIDC trusted publishing 首跑 |
| `dsh-ecosystem/dsh-imgdraw` | 规范化对齐 compass（AGENTS/CONTRIBUTING/SECURITY 全套） |
| `dsh-ecosystem/dsh-knowledge-sqlite` | npm keywords/files 白名单、双语 README |
| `dsh-ecosystem/dsh-session-slm-router` | S3 阶段文档、规范全套 |
| `dsh-ecosystem/dsh-subagent-cursor` | 规范全套、CHANGELOG |

### B · 产品/多人协作 OSS ×4 → 语言基类 + product-oss overlay

| 仓库 | 语言基类 | 证据（PR 流/规范面） |
|---|---|---|
| `qingfu-envoy` | python-app | Merge PR #23、CONTRIBUTING/SECURITY/ROADMAP、package-lock（前端） |
| `neonforge` | python-app（apps/ 多包，待定） | 双轴评审报告入库、lefthook、双语 |
| `fuyao-nomad` | python-app（harness/） | CHANGELOG/CONTRIBUTING/ROADMAP、release guards |
| `Voyage` | python-app（impl/sim） | CHANGELOG/双语/PRODUCT-DOC-AUDIT、红蓝对抗报告 |

### C · Python 应用/研究 ×4 → python-app delta

| 仓库 | 证据 |
|---|---|
| `chumen` | pyproject.toml + src/tests/tools、内测统计脚本 |
| `shisui` | pyproject.toml + examples/runs/profiles |
| `shuijing-v2` | pyproject + setup.cfg + Dockerfile（可部署） |
| `vertical-small-model` | adapters/lib/tests/reports（研究型，master、无 origin） |

### D · Go 服务 ×1 → go-service delta

| 仓库 | 证据 |
|---|---|
| `jinteng` | go.mod/go.sum、cmd/、Makefile、deploy/docs/examples |

### E · 本地实验/dogfood 沙盒 ×11 → sandbox delta

| 仓库 | 证据 |
|---|---|
| `fuyao-adopt-qingfu-envoy` / `-shisui` / `-voyage` | 同构 agents/docs/package.json/src/tests、master、无 origin |
| `fuyao-dogfood-action-list` / `-audit-trail` / `-boundary-s7` / `-changelog-slice` / `-dual-harness` / `-grant-gate` / `-reading-card` / `-todo-strip` | 同上 8 个 dogfood 粒度仓库 |
| `weather-outfit-assistant` | 单页 JS 小工具（app.js/server.mjs）、dogfood 收尾 |

### F · 内容/写作 ×2 → content delta

| 仓库 | 证据 |
|---|---|
| `rsi-unit-of-evolution` | essay.md/en + review 三轮 + revision-notes |
| `part-time-job` | 简历/素材/行动计划（含 PDF 生成脚本） |

### G · 存档只读 ×1

| 仓库 | 说明 |
|---|---|
| `dsh-ecosystem/dsh-plugins` | 2026-09 封版（AGENTS.md 硬性规则：禁改插件源码、发布流程已删）——**不套模板** |

### 非 git 目录（不计入，仅登记）

`agent-tools`、`scripts`、`questions`、`plans`、`cloud-services`、`dsh-ecosystem/research/`（本地研究区）、`generated-images`、`visual`

## 使用方式

```sh
# A 类（默认）
node templates/scaffold.mjs --name <name> --org NinjaSln-labs --desc "..."
# C/D/E/F 类
node templates/scaffold.mjs --type python-app --name chumen2 --org NinjaSln-labs --desc "..."
node templates/scaffold.mjs --type sandbox --name dogfood-xxx --desc "..."
# B 类：先用语言基类脚手架，再叠加 product-oss overlay（见 categories/product-oss/CATEGORY.md）
```

## 分类模板体系（templates/categories/）

```
templates/
├── repo-root/              # 基类工程件（A 类 dsh 插件）；AGENTS/CONTRIBUTING/.gitignore 已迁 common
├── common/                 # **单源**：AGENTS-core（含 AI 协作守则 7 条）/ CONTRIBUTING-core / gitignore-core / copilot-instructions
├── categories/             # 各分类 delta（工程件 + *-append.md 差异段 + CATEGORY.md）
│   ├── dsh-plugin/ python-app/ go-service/ sandbox/ content/ product-oss/
├── scaffold.mjs            # --type 路由 + --overlay；三件套单源拼装（core+append）
├── check-single-source.mjs # 多源漂移检查：core 指纹扫描/append 命名/基类残留（发现多源 exit 1）
└── skill/ README.md
```

设计原则：**通用文档层一份**（LICENSE/README/DEVELOPMENT/PUBLISHING/SECURITY 骨架）；
**AGENTS/CONTRIBUTING/.gitignore 单源拼装**（common core + 分类 append，产物内勿手改拼装段）；
语言差异只在工程件 delta（构建/CI/钩子/忽略表）；`--type` 路由由 `scaffold.mjs` 执行，
delta 规则的文档源在各分类 `CATEGORY.md`（改规则先改文档）。

**Agent 参与优化（所有工程分类）**：AGENTS.md 内置「AI 协作守则」7 条（不猜契约 / 完成的定义 =
验证链全绿 / 机密红线 / 不静默绕过门禁 / 改动最小化 / 文档同步 / 冲突处理）；AI 入口三桥接——
CLAUDE.md（`@AGENTS.md` 导入）+ `.github/copilot-instructions.md`（工程分类自动配）+ AGENTS.md 本体；
pre-commit 验证链前门即 agent 防呆。

**单源收敛与漂移把守（2026-09 二轮审计）**：AGENTS/CONTRIBUTING/.gitignore 原为 5/4/4 份重复源，
已收敛为 common 单源 + 分类 append；`check-single-source.mjs` 常态把守（core 指纹扫描——若有人把
共性段拷回分类文件即 exit 1；实测原样通过）。

**实测记录（2026-09）**：五分类 + B 类混合 scaffold 全跑通；累计抓修 9 个实施 bug（ask fallback
语义、legal/target 重复声明、delta 落空、最小集漏删、go 空目录清理、SUPPORT/CATEGORY 入产物、
PR 模板位置、overlay 源路径 ENOENT、content 残留 .gitignore 引用）。

## 边界说明（2026-09 更新：原"未出模板"项已按工业实践调研补全）

- ~~C 类 publish（PyPI）~~ ✅ 已补：`categories/python-app/.github/workflows/publish.yml`（PyPI Trusted
  Publishing：tag 守卫 + build/publish 分离 + 两环境 pypi/testpypi + PEP 740 attestations 默认开）
  与 PyPI 版 PUBLISHING.md（pending publisher / bump-my-version / 14 天冻结新规）——依据 docs.pypi.org +
  pypa/gh-action-pypi-publish v1.14.2（2026-09 核实）
- ~~D 类 publish（GitHub Release）~~ ✅ 已补：`categories/go-service/.goreleaser.yaml`（v2 最小配置，
  默认 ldflags 版本注入 + conventional changelog 分组）+ `release.yml`（goreleaser-action@v7）+
  Go 版 PUBLISHING/CONTRIBUTING——依据 goreleaser.com v2.18（2026-09 核实）；SBOM/cosign/GHCR 按小库
  务实取舍默认注释、成对启用
- ~~B 类 overlay 未验证~~ ⬆️ 已升级为完整 overlay：release-please v5 三件套（版本晋升自动化）+
  YAML issue forms + CODEOWNERS + dependabot + dependency-review + SUPPORT.md 含 21 条"单人→多人
  升级检查清单"（rulesets 为推荐路径）——依据 docs.github.com 与 googleapis/release-please（2026-09 核实）
- **仍然成立的不确定项**：三条链均为"按官方文档当前版整理"，未经过一次真实发布回归——各分类首个
  新库落地时按 PUBLISHING.md 实测并把偏差回写模板；E/F 最小集从现有 13 库实况反推，转正走全量迁移

