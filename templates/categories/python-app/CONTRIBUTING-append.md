<!-- ===== append：python-app 分类段（拼接到 CONTRIBUTING-core 之后） ===== -->

## 开发环境

```sh
python -m venv .venv && . .venv/bin/activate
python -m pip install -e ".[dev]"
python scripts/verify.py   # 验证链单源：ruff → pytest（探测式，tests/ 就位后自动进链）
```

## 发版流程

见 [PUBLISHING.md](PUBLISHING.md)（bump-my-version 或手工 tag → PyPI Trusted Publishing 发布）。
