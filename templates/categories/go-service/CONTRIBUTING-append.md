<!-- ===== append：go-service 分类段（拼接到 CONTRIBUTING-core 之后） ===== -->

## 开发环境

```sh
go mod download        # 或 go mod tidy（go.sum 必须入库）
make verify            # 验证链单源：gofmt → vet → test → build（本地与 CI 同一入口）
go run ./cmd/<name>    # 本地起服务
```

## 发版流程

见 [PUBLISHING.md](PUBLISHING.md)（tag v* → GoReleaser 矩阵构建 → GitHub Release）。
