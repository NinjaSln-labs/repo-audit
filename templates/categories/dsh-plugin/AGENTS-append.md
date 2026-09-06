<!-- ===== append：dsh-plugin 分类纪律（拼接到 AGENTS-core 之后） ===== -->

## 部署纪律（本分类硬性，五条）

1. 改了本插件源码（`src/`、`lib/`）未发版 → profile 必须以 `file:` 指向本目录安装，禁止留在 registry 安装（同版本号不同内容，版本校验失效）。
2. 安装一律走 `dsh plugin --profile web install`，禁裸 `npm install`。
3. 每次 install / build 后必跑：`npm run check:deploy`（本单库即一个插件，无需 --pkg；FAIL 必须修复）。
4. `file:` 场景禁止手动软链。
5. 本机私有信息不入库（详见上方 AI 协作守则第 3 条）。

> 单库说明：本仓库为独立单库，仓库根即插件目录，**不是** pnpm workspace——多包 workspace 的
> `pnpm-workspace.yaml` + `overrides` 防双实例护栏本库不需要；peer 版本兼容由宿主 dsh 决定，
> peerDependencies 如实声明即可。git 钩子在 `.githooks/`（启用：`git config core.hooksPath .githooks`）。
> 全文与事故背景见仓库根 `DEVELOPMENT.md`「部署纪律：profile 安装」。




9. （C3 升级实测）三方合并验证。

8. （C2 升级实测条款）模板新增纪律。
