# 发布记录：repo-audit-tool

## 发布状态（2026-09-06 更新）

| 项 | 状态 |
|---|---|
| npm | `repo-audit-tool` v1.2.0（已发布，latest） |
| GitHub | `NinjaSln-labs/repo-audit` master；发版 tag `v*` |
| 本地验证 | 自审计 100/A，验证链 4/4，测试 3/3，CI 全绿 |

## 版本历史

- **1.2.0** — 开源就绪：补充 AGENTS.md、CI/publish workflow 适配、json_field monorepo 感知、
  fallback_field 数组格式修复、英文 README、参数类型校验、占位符残留扫描（2026-09-06）
  - 首次发布：`npm publish --access public`（手动 bootstrap）
  - 后续发布：Trusted Publisher（OIDC）由 CI 自动发布

## 发布通道（npm OIDC Trusted Publishing）

**认证**：npm **Trusted Publishing（OIDC）**——无需 token，`.github/workflows/publish.yml` 的
`id-token: write` 自动鉴权 + provenance 签名（源仓库 public）。

## 日常发布流程

```sh
npm version patch --no-git-tag-version
V="$(node -p "require('./package.json').version")"
git commit -am "chore: release repo-audit-tool v$V — <一句话主旨>"
git tag v$V
git push && git push --tags
# CI 接手：审计 → 验证链 → 测试 → 版本守卫 → npm publish
```

## canary 灰度通道

```sh
npm version prerelease --preid=next --no-git-tag-version
V="$(node -p "require('./package.json').version")"
git commit -am "chore: canary repo-audit-tool v$V" && git tag v$V
git push && git push --tags
# 实测通过 → 晋级 latest：npm dist-tag add repo-audit-tool@x.y.z latest
```

## 首次发布（已完成）

1. **npm 包创建**：`npm publish --access public`（v1.2.0，2026-09-06）
2. **Trusted Publisher 配置**（下一步）：npmjs.com → 包设置 → Trusted Publisher →
   - Repository: `NinjaSln-labs/repo-audit`
   - Workflow: `publish.yml`
   - Branch: `master`
3. **验证**：`npm view repo-audit-tool dist-tags` → `{ latest: '1.2.0' }` ✓

## 发布后验证

- 确认 latest 已更新（`npm view repo-audit-tool dist-tags`）
- provenance 徽章（npm 包页面）
- 实机安装路径实测：`npm install -g repo-audit-tool` → `repo-audit --repo .`

## 维护要点

- 零依赖项目：无 `npm install`、无 `npm ci`、无 lockfile 需求
- tag 格式 `v*` 必须与 package.json version 完全一致（publish.yml 版本守卫）
- 本地手动发布无法生成 provenance，仅应急用
- prerelease 加 `--tag next`（CI 自动处理，手动应急时勿忘）
