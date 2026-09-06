<!-- 模板说明（用后删除）：B 类"产品/多人协作 OSS"叠加规范（overlay）。
     用法：先用语言基类（python-app / go-service / dsh-plugin）脚手架建库，
     再把本目录文件叠加（CHANGELOG.md / PULL_REQUEST_TEMPLATE.md 覆盖或新增），
     并按 SUPPORT.md 修订 CONTRIBUTING（PR 流）与 AGENTS/DEVELOPMENT（门禁从 pre-commit 扩展为 CI required）。 -->

# B 类 · 产品/多人协作 OSS（overlay）

适用实证：qingfu-envoy（PR #23）/ neonforge / fuyao-nomad / Voyage。

## 叠加内容（scaffold `--overlay product-oss` 全部自动落位）

| 文件 | 动作 | 说明 |
|---|---|---|
| `CHANGELOG.md` | 覆盖/新增 | 变更唯一事实源（Keep a Changelog） |
| `.github/PULL_REQUEST_TEMPLATE.md` | 新增 | 自检清单（验证链/机密/文档/兼容性） |
| `.github/ISSUE_TEMPLATE/bug_report.yml` + `config.yml` | 新增 | YAML issue forms（复现步骤/环境）+ 私密漏洞报告指路 |
| `.github/CODEOWNERS` | 新增 | 评审责任人锁定（自身必须有 owner） |
| `.github/dependabot.yml` | 新增 | 依赖与 action 自动升级（minor/patch 成组） |
| `.github/workflows/release-please.yml` + `release-please-config.json` + `.release-please-manifest.json` | 新增 | **版本晋升自动化**：conventional commits → Release PR → 合并即 tag + Release + CHANGELOG |
| `.github/workflows/dependency-review.yml` | 新增 | PR 依赖安全审查（fail-on-severity: high 起步） |
| `SUPPORT.md` | 供人读（不进产物） | 协作流/发布节奏/红线差异说明 |

## 与语言基类的联动

- 基类的验证链单源（verify.mjs/verify.py/Makefile）不变——CI required 是 PR 门禁本体
- pre-commit 部署纪律（dsh 插件）保留在库内；贡献者无法执行时由维护者发版前代跑（SUPPORT.md 已注明）
- ROADMAP.md：从语言基类的 DEVELOPMENT「核心循环」延展为阶段收口文档（实践库惯例：阶段末评审报告入库）
