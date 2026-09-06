<!-- ===== append：go-service 分类纪律（拼接到 AGENTS-core 之后） ===== -->

## 构建纪律（本分类硬性）

1. **提交前门**：`make verify`（gofmt → vet → test → build）全绿；pre-commit 钩子自动执行（启用：`git config core.hooksPath .githooks`）。gofmt/go vet 是 Go 社区强约定，CI required，本地无借口。
2. **格式与静态检查不绕过**：gofmt -l 有输出即 FAIL。
3. `deploy/` 下配置只写模板不写真值（机密红线见上方 AI 协作守则第 3 条）。
