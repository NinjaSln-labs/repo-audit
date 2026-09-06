<!-- ===== append：python-app 分类纪律（拼接到 AGENTS-core 之后） ===== -->

## 环境与验证纪律（本分类硬性）

1. **环境声明**：一切命令在项目 venv 内执行（`python -m venv .venv && . .venv/bin/activate` 后 `pip install -e ".[dev]"`）；不依赖全局解释器包状态。CI 与本地同命令（`scripts/verify.py` 单源）。
2. **提交前门**：`python scripts/verify.py`（ruff → pytest，探测式）全绿；pre-commit 钩子自动执行（启用：`git config core.hooksPath .githooks`）。
3. 数据文件入 `data/` 前先确认无敏感字段（机密红线见上方 AI 协作守则第 3 条）。




- （升级验证）guide 手册回归项。

6. （闭环实测）模板升级新条款。

7. （闭环实测 v2）第二轮升级。

6. （闭环终测）模板升级 A。
