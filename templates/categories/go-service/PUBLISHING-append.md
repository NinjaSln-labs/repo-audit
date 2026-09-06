<!-- ===== append：go-service 分类段（拼接到 PUBLISHING-core 之后） ===== -->

## 发布通道（GoReleaser → GitHub Release）

**制品**：跨平台二进制/归档（GoReleaser）→ GitHub Release；可选 GHCR 容器镜像。
**前置验证**：ci.yml（make verify）把住质量关——release 只做构建上传。

## 日常发布流程

```sh
# ① 发布前本地演练（必跑——配置错误本地暴露，不烧 CI）
goreleaser check
goreleaser release --snapshot --clean     # 产物进 dist/，不建 Release

# ② 显式 tag + push（发布是人的决定）
git commit -am "chore: release v<x.y.z> — <一句话主旨>"
git tag v<x.y.z>
git push && git push --tags               # ③ release.yml 接手：矩阵构建 → GitHub Release
```

- **版本注入**：GoReleaser 默认 ldflags 注入 `main.version`（tag 去 v 前缀）/`main.commit`/`main.date`
- **changelog**：GoReleaser 按 conventional commits 分组生成（与 CONTRIBUTING 提交规范同源）
- 可选人工确认：`.goreleaser.yaml` release.draft: true

## 首次发布前置（一次性）

1. `go mod init github.com/<org>/<repo>`；`cmd/<name>/main.go` 入口就位
2. workflow 的 `<commit-SHA>` 固定（checkout@v7、setup-go@v7、goreleaser-action@v7 对应 SHA）
3. 可选启用项（.goreleaser.yaml + release.yml 成对解开）：SBOM（syft）/ cosign keyless 签名 / GHCR 镜像（dockers_v2）
4. 首发验证：GitHub Release 页产物齐全（各平台归档 + checksums.txt）；`shasum -a 256 -c` 本地复核

## 应急手动发布（CI 不可用时）

```sh
make verify
goreleaser release --snapshot --clean     # 本地产物
gh release create v<x.y.z> dist/* --generate-notes   # 本机 gh 登录态手工上传
```

## 与 release-please 的分工（可选升级，B 类多人协作时）

小库最省事路线 = 手工打 `v*` tag + GoReleaser changelog 分组（本模板现状）。
需要严格 CHANGELOG.md 文件与自动版本号时引入 release-please（v5）：它管**版本晋升**
（开 Release PR、合并时打 tag），GoReleaser 跑在它打的 tag 上构建上传（Release 已存在会更新，不撞车）。

## 维护要点

- GoReleaser v2 配置变更先过 `goreleaser check`；deprecated 字段盯 goreleaser.com/resources/deprecations（v3 将移除 dockers 旧写法，用 dockers_v2）
