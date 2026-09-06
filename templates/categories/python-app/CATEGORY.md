<!-- 模板说明（用后删除）：C 类"Python 应用/研究"分类 delta 模板（语言基类）。
     叠加规则：repo-root 的**通用文档层**（README/LICENSE/CONTRIBUTING/DEVELOPMENT/PUBLISHING/
     SECURITY/AGENTS/CLAUDE/.gitignore 基干 + skill/）照用；npm/TS 专属文件（package.json/
     tsconfig*/src TS 骨架/scripts/*.mjs/workflows）由本分类替代。 -->

# C 类 · Python 应用/研究（语言基类）

> 实证来源：chumen / shisui / shuijing-v2 / vertical-small-model（pyproject + src/tests 同构）。

## 文件 delta（相对 repo-root 基类）

| 动作 | 文件 | 说明 |
|---|---|---|
| **替换** | `pyproject.toml`（本目录提供骨架） | 取代 package.json：PEP 621 元数据 + 工具配置单源 |
| **替换** | `src/<name>/__init__.py`（**自建**，TODO 有指引） | 取代 TS 骨架；src 布局，scaffold 不生成代码文件 |
| **替换** | `.github/workflows/ci.yml`、`publish.yml`（本目录提供） | pytest/ruff 验证链；publish 用 **PyPI Trusted Publishing（OIDC）**——与 npm 同信任链模型 |
| **删除** | package.json / tsconfig* / scripts/*.mjs / src/index.ts / cordis.patch.yml / dsh 字段 | npm/TS 专属 |
| **保留** | 通用文档层 + `.githooks/pre-commit` | 钩子内命令改为 `python -m pytest`（见本目录 pre-commit delta） |

## 验证链（对应 verify.mjs 的 Python 单源）

```sh
# scripts/verify.py（或 Makefile target）：
ruff check . → python -m pytest tests/ -q
# 探测式：tests/ 存在才跑 pytest；deploy 场景（shuijing-v2）加 docker build 校验（本地前门，不进 CI）
```

## 与 dsh 插件基类的红线差异

- **无部署纪律**（无 dsh profile/file: 安装）——AGENTS.md 去掉该 5 条，改为：venv/uv 环境声明、
  `pip install -e ".[dev]"`、机密不入库（保留）、提交前 `ruff check + pytest`（保留）
- **发布面**：PUBLISHING.md 换成 PyPI 版（trusted publisher / 版本策略同款；无 npm provenance 概念，
  用 PyPI "Trusted Publishing" + attestations）
- README 徽章换 PyPI / CI / License；安装段 `pip install <pkg>`
