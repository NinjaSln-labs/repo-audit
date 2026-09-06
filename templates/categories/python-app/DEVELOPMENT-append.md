<!-- ===== append：python-app 分类段（拼接到 DEVELOPMENT-core 之后） ===== -->

## 分类纪律：Python 实现规范

- 包布局：src/（pyproject packages 已指向 `src/<name>`）；入口逻辑收敛，测试放 `tests/`
- 类型与风格：ruff（E/F/I/UP/B）必须零告警；公共函数带类型注解
- 配置：schemastery 或 dataclass + 防御性解析（partial 配置也能得到完整结果，参照 src config 惯例）
- 提交前门：`python scripts/verify.py`（ruff → pytest，探测式）全绿；pre-commit 钩子已指向它

## 分类 DoD 补充（Python）

- [ ] ruff 零告警；pytest 全绿（tests/ 就位后自动进验证链）
- [ ] 发布前 `python -m build && twine check dist/*` 通过（如发布）
- [ ] 依赖变更同步 pyproject；lock（如用 uv/pip-compile）入库

## 速查表预置（回顾追加）

| 坑 | 症状 | 拦截环节 |
|---|---|---|
| 占位依赖没填就 npm/pip install | EINVALIDPACKAGENAME / Cannot find module | 脚手架 TODO 第 1 步 + CONTRIBUTING 首装提示 |
| 发布后改 pyproject version 不同步 tag | CI 版本守卫 FAIL | publish.yml 版本一致性守卫 |
