<!-- ===== append：dsh-plugin 分类段（拼接到 CONTRIBUTING-core 之后） ===== -->

## 开发环境

```sh
npm install --legacy-peer-deps   # peer 由宿主 dsh 运行时提供，本地只装 devDeps 供构建/测试
npm run build                    # tsc → lib/ + esbuild 客户端 bundle（经 scripts/build.mjs 探测）
npm run typecheck
npm test                         # 验证链单源入口：scripts/verify.mjs（build→typecheck→smoke/vitest→mount，探测式）
```

> 首次安装前先按 package.json TODO 填好依赖占位——占位符（`dsh-<用到的宿主包>` 形态）不是合法
> npm 包名，直接 install 会报 EINVALIDPACKAGENAME。`package-lock.json` 必须生成并入库（CI 的
> `npm ci` 依赖它）。

## 部署纪律

涉及 `src/`、`scripts/` 改动会触发 pre-commit 部署纪律自检（启用：`git config core.hooksPath .githooks`）；确属未部署的中间态用 `--no-verify` 并在说明中注明。完整规则见仓库根 AGENTS.md「部署纪律」。

## 发版流程

见 [PUBLISHING.md](PUBLISHING.md)（显式 bump → tag → CI 验证 → OIDC trusted publishing 发布）。
