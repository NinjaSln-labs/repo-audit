<!-- ===== append：dsh-plugin 分类段（拼接到 DEVELOPMENT-core 之后） ===== -->

## 分类纪律：dsh 插件实现规范

- host 侧 TypeScript（tsc → lib/），client 侧 TSX 经 esbuild 打 bundle
- **沙箱禁用全局**：`setTimeout/setInterval/...`（用 `ctx.timeout/ctx.interval`，`inject: ['timer']`）、`fetch`（用 `ctx.web`）、`process/Buffer`（用 btoa/atob/TextEncoder）、`require`（用服务）
- 服务访问：`ctx.get(name)` + undefined 检查；硬依赖才 `inject`
- 动态工具：`harness.defineTool()` 包装后再 `harness.registerTool(ctx, tool)`；`parameters` 根省略 `additionalProperties`
- **每次 define 显式提供 `code.host` 和 `code.client`**（省略 client = UI 消失，踩过 4 次）
- append 事件格式：先查系统同类事件再写（source/id/surfaceOp 对齐）

## 分类 DoD 补充（dsh 插件）

- [ ] `cordis_inspect_self`：state=running，**hasHostHalf 与 hasClientHalf 均为 true**
- [ ] 无沙箱禁用全局（grep setTimeout/fetch/require/process/Buffer）
- [ ] 客户端无 `client-render` 诊断；工具注册确认
- [ ] 会话日志无 command/done error；状态文件按预期生成

## 部署纪律：profile 安装（事故沉淀）

> 事故：本地改了源码并 build，但 profile 里装的仍是 registry 旧版——**同版本号、不同内容**，版本校验完全失效，行为错位极难排查。根因是安装方式不统一（registry / file: 混用 + 无装后校验）。
> 使用提示：本节与 AGENTS.md、pre-commit 钩子、check-deploy.mjs 四处联动成拦截链，为硬性成文——建议整节保留，只按本库校对命令前缀。

### 统一规则

| 插件状态 | profile 安装方式 |
|---|---|
| 联调中（本目录有未提交改动） | `file:` 指向本目录源码目录 |
| 已入库、未发版 | `file:` 指向本目录（仓库根即插件） |
| 已发版且本目录 lib == 部署 lib | registry `^x.y.z` |

安装一律走官方入口（禁裸 npm install——npm 会把 peerDependencies 装进 profile，产生第二套 `@deepseek-ai/*`，导致 Symbol 错配 unscoped、webserver 版本错配 400）：

```bash
dsh plugin --profile web install
```

### 装后自检（每次 install 后必跑）

```bash
npm run check:deploy        # 一键自检，FAIL 即非零退出码
```

FAIL 条件：① registry 安装且与本目录 lib 有差异（同版本号不同内容，硬拦截）；② profile 内 `@deepseek-ai/` 出现非 cosmokit/schemastery 包；③ `file:` 安装为软链，或源码 lib ≠ 部署 lib。

手工等价命令（脚本不可用时）：

```bash
diff -rq lib ~/.dsh/profiles/web/node_modules/dsh-<name>/lib   # 1) 源码 lib == 部署 lib
ls ~/.dsh/profiles/web/node_modules/@deepseek-ai/              # 2) 无宿主核心包阴影（只允许 cosmokit/schemastery）
ls -la ~/.dsh/profiles/web/node_modules/ | grep dsh-<name>     # 3) file: 拷贝应为真实目录
```

### 强制执行（git hook）

pre-commit 钩子（`.githooks/pre-commit`）：提交涉及 `src/`、`scripts/` 改动时自动跑 `check:deploy`，FAIL 拒绝提交。启用：`git config core.hooksPath .githooks`。中间态确需跳过用 `--no-verify` 并注明。本仓库根 `AGENTS.md` 已内联规则摘要。

### 关键认知

- **版本号相同 ≠ 内容相同**：registry 包只在"发版→立即重装"闭环里可信；脱离闭环一律降级为 file: 直装
- peer 永远由宿主 dsh 提供（fallback 在 `~/.dsh/profiles/node_modules/@deepseek-ai/`），profile 内不装宿主核心包
- `file:` 场景禁止手动软链：Node 按 realpath 解析会脱离 profile 的宿主 fallback，报 `Cannot find package '@deepseek-ai/...'`
- **改 lib 必须同步进 src/**：CI 从 src 重建，只手改 lib 的修复发布时全丢（实践库踩过：该修复丢两个版本后才补回）

## 速查表预置（回顾追加）

| 坑 | 症状 | 拦截环节 |
|---|---|---|
| 省略 client half | UI 消失 | 实现规范 + 质量 DoD |
| registry 装的插件改了源码没发版 | 同版本号不同内容，行为错位 | `check:deploy` + pre-commit 硬拦截 + AGENTS.md 内联 |
| 读宿主服务返回形状没查契约就猜 | 「看似对上」实未生效，被缓存/降级掩盖，重启即露馅 | Sprint 计划契约预检（stub 必须按宿主真实契约形状写） |
