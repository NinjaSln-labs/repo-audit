#!/usr/bin/env python3
"""验证链单源入口（Python 版 verify.mjs）：ruff → pytest（探测式）。

package 无构建期 npm 段；链内增删步骤只改本文件。
退出码：任一步 FAIL = 1（发布前门）。工具未安装时提示先建环境而非裸 traceback。
"""

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

steps = [["ruff", "check", "."]]
if (ROOT / "tests").exists():
    # pytest 走 PATH 上的可执行（与 ruff 同源，venv 内一致）；不用 sys.executable -m，
    # 否则 PATH stub/隔离环境无法统一拦截
    steps.append(["pytest", "tests/", "-q"])
# 探测式扩展点：deploy 校验（如 docker build）为本地发布前门，不进 CI——按需自行追加

# 工具可用性前置检查：缺工具 = SKIP 语义（exit 2，不阻塞 update 的 adopt/commit），
# 区别于"工具在但验证失败"（exit 1，阻塞）
missing = sorted({s[0] for s in steps if shutil.which(s[0]) is None and s[0] != sys.executable})
if missing:
    print(f"△ 验证链工具未安装：{', '.join(missing)}——跳过门禁（SKIP）")
    print("  → 先建环境：python -m venv .venv && . .venv/bin/activate && pip install -e \".[dev]\"")
    sys.exit(2)

print(f"验证链（verify.py 单源）：{' → '.join(s[0] for s in steps)}\n")

for step in steps:
    r = subprocess.run(step, cwd=ROOT)
    if r.returncode != 0:
        print(f"\n✗ [FAIL] {step[0]}（exit {r.returncode}）——验证链中断，禁止发布")
        sys.exit(1)
    print(f"✓ [PASS] {step[0]}")

print(f"\n验证链全绿（{len(steps)} 步）。")
