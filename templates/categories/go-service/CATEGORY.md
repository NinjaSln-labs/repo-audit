<!-- 模板说明（用后删除）：D 类"Go 服务"分类 delta 模板（语言基类）。
     叠加规则同 python-app：通用文档层照用；npm/TS 专属文件删除。 -->

# D 类 · Go 服务（语言基类）

> 实证来源：jinteng（go.mod + cmd/ + Makefile + deploy/docs/examples；个人自用服务）。

## 文件 delta（相对 repo-root 基类）

| 动作 | 文件 | 说明 |
|---|---|---|
| **新增** | `go.mod`（`go mod init github.com/<org>/<repo>` 自生成，不模板化） | 模块路径按实际仓库 |
| **新增** | `cmd/<svc>/main.go`（自写） | 服务入口 |
| **新增** | `Makefile`（本目录提供骨架） | build/test/lint/run 四件套 |
| **替换** | `.github/workflows/ci.yml`（本目录提供） | go test/go vet/gofmt 验证 |
| **删除** | npm/TS 专属全套（package.json/tsconfig*/src TS/scripts/*.mjs） | — |
| **保留** | 通用文档层 + LICENSE/.gitignore（Go 版） | .gitignore 需补 `bin/`（构建产物） |

## 验证链

```sh
gofmt -l . | grep -q . && exit 1   # 格式
go vet ./...                        # 静态检查
go test ./...                       # 单测
go build ./...                      # 编译
```

## 发布面

- **制品 = 二进制/容器**（jinteng 实况：deploy/ + docs/ + examples/）——无 npm/PyPI 段；
  PUBLISHING.md 收敛为：版本 tag → GitHub Release（附二进制或镜像说明）→ CHANGELOG
- AGENTS.md：无部署纪律/无 npm 段；保留机密纪律 + `make verify` 提交前门
- gofmt/go vet 是 Go 社区强约定，CI 必须 required
