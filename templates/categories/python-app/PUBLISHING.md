# 发布记录：<repo>（Python / PyPI）

**发布通道**：PyPI **Trusted Publishing（OIDC）**——无 token，`id-token: write` 换发 15 分钟短命
项目 token；上传自动带 **PEP 740 attestations**（Sigstore，PyPI 项目页显示 provenance）。
**前置验证**：ci.yml（ruff → pytest）把住质量关；publish 只做构建与上传。

## 发布状态（<日期> 更新）

| 项 | 状态 |
|---|---|
| PyPI | <版本 / latest> |
| TestPyPI | <测试通道验证记录> |
| 本地验证 | <verify.py 全绿 + pip install 实测> |

## 一次性前置（首次发布前）

1. **GitHub Environments**：Settings → Environments 建 `pypi`（**必开 required reviewers**——
   PyPA guide 强调 "you must require manual approval on each run"）与 `testpypi`
2. **pending publisher 登记**（先建配置后建项目）：账号侧 `https://pypi.org/manage/account/publishing/`
   填项目名 + owner/repo + workflow 文件名 `publish.yml` + environment `pypi`；首次发布成功自动建项目。
   ⚠️ pending 不保留项目名，发布前被抢注则失效。TestPyPI 在 test.pypi.org 单独重复（独立账号）
3. （建议）tag protection：限制 `v*` tag 只能由维护者推送
4. 本地演练：`python -m build && twine check dist/*`

## 日常发布流程

```sh
# ① bump（版本静态在 pyproject.toml；推荐 bump-my-version 一条命令 commit+tag）
pip install bump-my-version
bump-my-version bump patch        # 自动改 pyproject version + commit + 打 vX.Y.Z tag
# 或手工：改 pyproject.toml version → commit → git tag vX.Y.Z

# ② push（发布是人的决定：tag 推送触发 publish.yml）
git push && git push --tags       # CI：构建守卫 → build → TestPyPI 跳过 → pypi 环境（人工批准）→ 上传
```

- **守卫**：CI 比 tag 与 pyproject 静态 version 一致性（动态版本项目用 dist 文件名比对，见 publish.yml 注释）
- **灰度**：先 `workflow_dispatch` 手动跑 TestPyPI 验证链路；`pip install --index-url https://test.pypi.org/simple/` 实测
- **发布失败**：大声失败换新版本号重发——**不要**加 skip-existing（PyPI 禁文件名复用；release 14 天后冻结新文件）
- 发布成功验证：PyPI 项目页 provenance/attestations 徽章 + `pip install <pkg>` 实测

## 应急手动发布（CI 不可用时）

```sh
python scripts/verify.py && python -m build && twine check dist/*
# 需 API token 兜底（TP 不可用时）：PyPI 账号建 API token（用户名 __token__），
# 本地 twine upload dist/* —— 上传后仍建议补跑一次 CI 发布以恢复 attestations 链路
```

## 维护要点

- **offboarding 维护者**：审查 Trusted Publishers（TP 绑定项目而非用户）与 GitHub environment reviewers
- **版本工具**：小库推荐静态 pyproject + bump-my-version；hatch version 适合动态版本（`__about__.py`）；setuptools-scm（tag 即真相源）tag 密集项目才值得
- **依赖更新**：Dependabot 保持 action 版本（含 pypa/gh-action-pypi-publish 的 release/v1 跟踪）

## 参考来源（2026-09 核实）

- docs.pypi.org/trusted-publishers/（含 security-model / creating-a-project-through-oidc）
- packaging.python.org/en/latest/guides/publishing-package-distribution-releases-using-github-actions-ci-cd-workflows/
- github.com/pypa/gh-action-pypi-publish（v1.14.2 README；master 已 sunset，用 @release/v1）
- blog.pypi.org（2025 年度回顾 / 2026-07 "14 天冻结"与 UI 更新公告）
