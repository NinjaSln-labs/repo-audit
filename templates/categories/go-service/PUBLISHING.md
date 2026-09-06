# 发布记录：<repo>（Go 服务）

**发布制品**：跨平台二进制/归档（GoReleaser）→ GitHub Release；可选 GHCR 容器镜像。
**验证链前置**：ci.yml（make verify）把住质量关——release 只做构建上传。

## 发布状态（<日期> 更新）

| 项 | 状态 |
|---|---|
| GitHub Release | <最新 tag / Release 链接> |
| 产物 | tar.gz（linux/darwin/windows × amd64/arm64）+ zip（windows）+ checksums.txt |
| 本地验证 | <make verify + goreleaser snapshot 实测> |

## 日常发布流程

```sh
# ① 发布前本地演练（必跑——配置错误本地暴露，不烧 CI）
goreleaser check
goreleaser release --snapshot --clean     # 产物进 dist/，不建 Release

# ② 显式 bump + tag + push（发布是人的决定）
npm 式 bump 在 Go 里手工做：
V=<x.y.z>
# 改代码内版本（若引用 main.version 则以 tag 注入为准，无需改源码）
git commit -am "chore: release v$V — <一句话主旨>"
git tag v$V
git push && git push --tags               # ③ release.yml 接手：矩阵构建 → Release
```

- **版本注入**：GoReleaser 默认 ldflags 注入 `main.version`（tag 去 v 前缀）/`main.commit`/`main.date`——入口文件声明 `var version = "dev"` 即可自动获得
- **changelog**：GoReleaser 按 conventional commits 分组生成（feat/fix/Others），与 CONTRIBUTING 提交规范同源
- 可选人工确认：`.goreleaser.yaml` release.draft: true

## 首次发布前置（一次性）

1. `go mod init github.com/<org>/<repo>`；`cmd/<name>/main.go` 入口就位
2. workflow 的 `<commit-SHA>` 固定（actions/checkout@v7、setup-go@v7、goreleaser-action@v7 对应 SHA）
3. 可选启用项（.goreleaser.yaml + release.yml 成对解开）：SBOM（syft）/ cosign keyless 签名 / GHCR 镜像（dockers_v2）
4. 首发验证：GitHub Release 页产物齐全（各平台归档 + checksums.txt）；`shasum -a 256 -c` 本地复核

## 应急手动发布（CI 不可用时）

```sh
make verify
goreleaser release --snapshot --clean     # 本地产物
gh release create v$V dist/* --generate-notes   # 本机 gh 登录态手工上传
```

## 与 release-please 的分工（可选升级）

小库最省事路线 = 手工打 `v*` tag + GoReleaser changelog 分组（本模板现状）。
当需要严格 CHANGELOG.md 文件与自动版本号时引入 release-please（v5）：它负责**版本晋升**
（从 conventional commits 算 next version、开 Release PR、合并时打 tag），GoReleaser 跑在
它打出的 tag 上构建上传（Release 已存在时会更新而非报错，不撞车）。

## 维护要点

- GoReleaser v2 配置变更先过 `goreleaser check`；deprecated 字段盯 goreleaser.com/resources/deprecations（v3 会移除 dockers 旧写法，用 dockers_v2）
- 应急发布无 checksum 分组生成？——snapshot 产物含 checksums.txt，保持一致
