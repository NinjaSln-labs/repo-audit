# ===== append：dsh-plugin 分类忽略（拼接到通用段之后） =====

# 本机私有钩子（commit-msg 含身份检查）不追踪；pre-commit 随仓库分发
.githooks/commit-msg

# 构建产物（CI 从 src 重建；只改 lib 不进 src = 修复丢失）
node_modules/
lib/

# 视觉回归产物（基线入库，结果不入）
visual/results/
test-results/

# client bundle 中间物
*.tsbuildinfo
