<!-- 模板说明（用后删除）：本文件是 B 类"产品/多人协作 OSS"分类共性文档（语言无关），
     与语言基类（python-app / go-service / dsh-plugin）叠加使用。
     语言基类管"怎么构建验证"，本文件管"怎么协作发布"。
     依据：docs.github.com（rulesets/merge queue/CODEOWNERS/issue forms/auto-merge）+
     googleapis/release-please v5 + docs.pypi.org 安全模型，2026-09 核实。 -->

# 分类共性：产品级多人协作 OSS

> 实证特征：PR 流（Merge PR 实证）、CHANGELOG、ROADMAP、双语 README、评审/审计文档入库。
> 核心差异 vs 个人单维护者库：**变更经 PR、发布经 Release 流、事实经 CHANGELOG/release-please 单源**。

## 文件层（overlay 已随本目录提供，scaffold `--overlay product-oss` 自动叠加）

| 文件 | 作用 | 备注 |
|---|---|---|
| `CHANGELOG.md` | 变更唯一事实源（Keep a Changelog 分类） | release-please 自动维护；手工模式则并入手写 |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR 自检清单（验证链/机密/文档/兼容性） | — |
| `.github/ISSUE_TEMPLATE/bug_report.yml` + `config.yml` | YAML issue forms（复现步骤/环境）+ 私密漏洞报告指路 | blank_issues_enabled: false |
| `.github/CODEOWNERS` | 评审责任人锁定（自身必须有 owner） | 开 "Require review from Code Owners" 后任一 owner 批准即满足 |
| `.github/dependabot.yml` | 依赖与 action 自动升级（minor/patch 成组） | ecosystem 按语言基类增删 |
| `.github/workflows/release-please.yml` + `release-please-config.json` + `.release-please-manifest.json` | **版本晋升自动化**：conventional commits → 自动 Release PR → 合并即打 tag + GitHub Release + CHANGELOG | manifest 首版手写当前版本，此后勿手改 |
| `.github/workflows/dependency-review.yml` | PR 依赖安全审查（fail-on-severity: high 起步） | — |

## 发布分工（关键！避免撞车）

- **release-please** 管**版本晋升**：算 next version、开 Release PR、维护 CHANGELOG、合并时打 tag + 发 GitHub Release
- **语言基类的 publish/release 工作流**（npm OIDC / PyPI TP / GoReleaser）管**制品构建上传**，被 release-please 打的 tag 触发
- ⚠️ 不要让两边同时建 GitHub Release：GoReleaser 检测到 Release 已存在会更新（不撞车）；npm/PyPI 的 pypa/npm publish 只传包不建 Release（不冲突）
- GITHUB_TOKEN 限制：release-please 用它建的事件不再触发其他 workflow——依赖 tag 触发发布（默认架构）就无需 PAT；要"Release PR 合并后直接 publish"才换 PAT

## 与单人库的红线差异

- 单人库"直提 main"的 pre-commit 门禁 → **PR 门禁**（ci.yml 必须 required check）
- pre-commit 部署纪律钩子仍随库分发；贡献者无法跑 check:deploy（无本机 profile）时 PR 说明注明，由维护者发版前代跑

## 单人直提 main → 多人 PR 协作：升级检查清单

> 来源：docs.github.com rulesets/protected-branches/merge queue/auto-merge 官方文档（2026-09 核实）。
> 分支保护建议用 **rulesets**（GitHub 演进方向：多 ruleset 叠加取最严、可 Evaluate/Active 启停、支持一键从 classic 保护迁移）。

### A. 仓库 General
1. Pull Requests：只留 **squash merging**；勾 **Automatically delete head branches**、**Allow auto-merge**
2. Actions → General：勾 **Allow GitHub Actions to create and approve pull requests**（release-please 必需）
3. Collaborators：协作者给 write 及以上（CODEOWNERS 与 required approvals 的前提）

### B. Rulesets（Settings → Rules → Rulesets → Branch ruleset，目标 `~DEFAULT_BRANCH`）
4. Require a pull request before merging：Required approvals = 1（≥2 人后升 2）；勾 Dismiss stale approvals、Require review from Code Owners、Require conversation resolution
5. Require status checks：加入 CI check 名（**check 名须全局唯一**）；初期勾 Require branches to be up to date（strict）
6. Require linear history（与 squash 配套）
7. Bypass list：加 `release-please[bot]`、`dependabot[bot]`；多人期给 admin 勾 **Do not allow bypassing**
8. 温和上线：先用 **Evaluate** 模式跑几天再切 Active

### C. 文件层
9. CODEOWNERS / ISSUE_TEMPLATE / dependabot.yml / release-please 三件套 / dependency-review.yml——overlay 已含
10. SECURITY.md + Settings → Code security → **Private vulnerability reporting**（与 SECURITY.md 是两套机制，都要有）

### D. 安全面默认
11. Secret scanning / push protection：公共仓免费，开启（push protection 对个人账号默认已拦截）
12. Dependabot alerts / security updates：公共仓默认开，确认即可

### E. 流程习惯（非配置）
13. Conventional Commits + commitlint CI 校验（release-please 的地基）
14. merge queue：**暂不开**——每天个位数 PR 用 strict required checks + auto-merge 足够；高频合并后再把规则 5 的 strict 换成 merge queue（避免双重等待）

### 补充事实（2026-09 核实）

- classic branch protection 仍可用，但官方提供一键 "Convert to ruleset" 迁移，新配置直接用 rulesets
- release-please-action 最新 **v5.0.0**（2026-04-22，breaking 仅 node24）；核心库 release-please v17.11.2
- actions/stale v11 仍活跃维护；只对 issue 温和开启（days-before-pr-stale: -1 等价于不对 PR 启用）
- CODEOWNERS：gitignore 风格但不支持 `!` 取反与 `[ ]` 范围；owner 须 write 权限
- 0.x 阶段：config 里 `bump-minor-pre-major: true` 已预置（feat 只升 minor，避免 0.x 跳 1.x）
