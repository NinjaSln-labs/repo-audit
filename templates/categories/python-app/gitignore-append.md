# ===== append：python-app 分类忽略（拼接到通用段之后） =====

# 本机私有钩子（commit-msg 含身份检查）不追踪；pre-commit 随仓库分发
.githooks/commit-msg

# Python
__pycache__/
*.py[cod]
*.egg-info/
.eggs/
build/
dist/
.venv/
venv/
.pytest_cache/
.ruff_cache/
.mypy_cache/
.coverage
htmlcov/
