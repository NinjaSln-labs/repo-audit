<!-- ===== append：go-service 分类段（拼接到 DEVELOPMENT-core 之后） ===== -->

## 分类纪律：Go 实现规范

- 布局：cmd/<name>/ 入口 + 内部包按域拆分；入口声明 `var version = "dev"`（GoReleaser 默认 ldflags 注入）
- gofmt/go vet 零容忍（Makefile verify 单源第一、二步）；公共函数带注释（godoc 惯例）
- 提交前门：`make verify`（gofmt → vet → test → build）全绿；pre-commit 钩子已指向它
- go.sum 必须入库（go mod tidy 生成）

## 分类 DoD 补充（Go）

- [ ] `make verify` 全绿；`go vet` 零告警
- [ ] 发布前 `goreleaser check && goreleaser release --snapshot --clean` 本地演练通过
- [ ] deploy/ 配置只写模板不写真值

## 速查表预置（回顾追加）

| 坑 | 症状 | 拦截环节 |
|---|---|---|
| 忘记 go mod tidy，go.sum 漂移 | CI `go build` 失败 | Makefile build 步 + PR 检查 |
| tag 与代码内版本不一致 | 二进制 --version 错报 | GoReleaser ldflags 注入（以 tag 为准） |
