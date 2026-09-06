# ===== append：go-service 分类忽略（拼接到通用段之后） =====

# 本机私有钩子（commit-msg 含身份检查）不追踪；pre-commit 随仓库分发
.githooks/commit-msg

# Go
bin/
*.test
*.out
# 如启用 vendor 目录（go mod vendor），删除下行
# vendor/

# （v2.1 升级实测段）F3 回归验证。
