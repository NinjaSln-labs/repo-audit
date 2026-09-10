# AGENTS（AI 协作与工程纪律）

> 本文件由模板**单源拼装**（`common/AGENTS-core.md` + 分类 append）——重复段不要在仓库里手改；
> 改规则先改模板源，再重新生成。人工协作者同样适用本文件全部条款。

## 提交规范

- **Conventional Commits 前缀 + 中文描述**：`feat(scope):` / `fix(scope):` / `refactor:` / `docs:` / `test:` / `chore:`；scope 用模块名；发布提交固定 `chore: release v<版本> — <一句话主旨>`。
- **提交前必须跑本仓验证链单源**并全绿；CI 与本地同源。FAIL 修根因，不绕过；确需 `--no-verify` 必须在提交说明注明原因。

## AI 协作守则（agent 贡献者必读）

1. **不猜 API/契约**：写代码前用宿主/依赖的检查工具查精确签名；测试 stub 必须按真实契约形状写（实践库教训：失真的 stub 会掩盖契约 bug）。
2. **完成的定义 = 验证链全绿 + 实机/测试验收**，不是"代码写完"；声称完成前附验证输出。
3. **机密红线**：本机绝对路径、个人邮箱、token/密钥、会过时的部署实况描述一律不入库；提交前 `git grep` 自查（模式见本仓 .gitignore 注释区）。
4. **不静默绕过门禁**：pre-commit/CI FAIL 先修根因；中间态确需跳过必须留痕注明。
5. **改动最小化**：不顺手重构、不改无关文件；构建产物与锁文件按仓库既定规则处理（产物不入库、锁文件必须入库）。
6. **文档同步**：行为/接口变化同步 README、DEVELOPMENT 速查表（或等价文档）、CHANGELOG（如有）。
7. **冲突处理**：本文件与生成它的模板源冲突时以模板源为准并回写；用户显式指示优先于本文件，但需在 PR/提交说明中标注冲突点。

## 分类纪律：repo-audit 工具仓库

### 验证链（提交前必跑，全绿方可提交）

```bash
# 本仓自审计（期望 100/A）
npm run audit

# 验证链（规则加载 / 引擎运行 / 跨平台 shim / 手册完整 / 版本一致性）
npm run verify

# 单元测试
npm test
```

### 版本单源（发版防漂移）

- **单源**：`package.json` `"version"`——docs/index.html JSON-LD softwareVersion、AGENT-INDEX.json、AGENT-PROTOCOL.md 的版本字面量一律从单源同步，**不手写**
- `npm version` 提升版本时 `version` 生命周期钩子自动同步三目标（`scripts/sync-version.mjs`）
- `verify.mjs` 第 5 项守卫拦截漂移：FAIL 时跑 `npm run sync-version` 修复
- 发版时人工维护的仅剩：AGENT-INDEX.json 的 `changelog.<新版本>` 条目与 `updated` 字段

### 开发规范

- **零 npm 依赖**：不引入任何 npm 依赖，全部用 Node 内置模块（`node:fs`、`node:child_process`、`node:path` 等）
- **ESM 模块**：`"type": "module"`，所有 `.mjs` 文件使用 `import`/`export`
- **Node ≥18**：使用 Node 18+ 特性（如 `node:util` 的 `parseArgs`）
- **规则 YAML**：`rules/` 下的 YAML 按 `domains/` + `categories/` 组织，规则 ID 前缀对应域（SEC/DOC/GIT/QUA/COM/DEP）
- **模板生成**：`templates/` 下的 scaffold 使用单源拼装（core + 分类 append），产物内勿手改拼装段
- **工具只读**：`repo-audit.mjs` 是纯只读工具，不修改目标仓库任何文件

### 文档同步

- 规则/引擎变更 → 同步更新 `docs/repo-audit/AGENT-GUIDE.md` 和 `HUMAN-GUIDE.md`
- 审计方法论变更 → 同步更新 `AUDIT.md`
- 最佳实践调研更新 → 同步更新 `BEST-PRACTICES.md`
- 分类检测逻辑变更 → 同步更新 `REPO-CLASSIFICATION.md`

### 机密自查

```bash
# 提交前检查（排除 docs/ 和模板目录）
# 1) API 密钥 / Token（GitHub/DeepSeek/OpenAI 等常见前缀）
git grep -nE '(sk-|ghp_|gho_|ghu_|github_pat_|AKIA|sk-or-|ollama)' -- '*.mjs' '*.yaml' '*.json' '*.yml' '*.sh' '*.cmd' '*.ps1'
# 2) 本机绝对路径（任何用户目录）
git grep -nE '/home/[^/]+/|/Users/[^/]+/|C:\\Users\\' -- '*.mjs' '*.yaml' '*.json' '*.yml'
# 3) 凭证字面量（排除 rules/ 中规则 ID 和描述）
git grep -nE 'password|secret|api_key|apikey|token' -- '*.mjs' '*.yaml' '*.json' '*.yml' | grep -v 'rules/'
```

## 安全考虑

- 漏洞**不要**公开披露：走 SECURITY.md 指定的私密漏洞报告渠道。
- 依赖与 CI action 升级走仓库既定自动化（如有）；引入新依赖需在 PR 说明中给出理由。
