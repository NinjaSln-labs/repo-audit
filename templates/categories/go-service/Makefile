# <name>（Go 服务）

# Makefile 四件套：verify 为验证链单源（CI 与本地同入口）
.PHONY: verify fmt lint test build run

verify: fmt lint test build

fmt:
	@out="$$(gofmt -l .)"; if [ -n "$$out" ]; then echo "✗ 需 gofmt：$$out"; exit 1; fi

lint:
	go vet ./...

test:
	go test ./...

build:
	go build ./...

run:
	go run ./cmd/<name>
