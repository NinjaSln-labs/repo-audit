# HANDOFF-ARCHIVE/pits.md — 已确认修复的坑

> 按 HANDOFF §6 维护规则：确认已修的坑从 HANDOFF §4 迁入本文件，不在正文停留。

---

## P-001: AGENTS.md 缺失导致 CLAUDE.md 悬空引用 + 多文档断链

- **发现时间**：2026-09-06（接手 session）
- **来源**：用户反馈"只有 CLAUDE.md 没有 AGENTS.md"
- **症状**：
  - `CLAUDE.md` 第 1 行 `@AGENTS.md` 引用不存在
  - `CONTRIBUTING.md`（§2）、`DEVELOPMENT.md`（§16/20/63/97/111）、`BEST-PRACTICES.md`、`AUDIT.md`、`REPO-CLASSIFICATION.md` 多处引用悬空
  - 规则 `DOC-004`（AGENTS.md 存在且含 AI 协作守则）的 `applies_to` 不含 `javascript`，故自审计未 fail
- **根因**：scaffold 生成 repo-audit 时，`templates/categories/` 下无 `javascript` 分类的 AGENTS-append.md，`AGENTS-core.md` 虽被 `assemble()` 拼装但产物未落盘（或开源清理时被删）；AGENTS.md 从未提交到 git
- **修复**：创建 `AGENTS.md`（基于 `templates/common/AGENTS-core.md` + 项目定制分类纪律节），验证链全绿、自审计 100/A 保持
- **关联文件**：`AGENTS.md`（新增）、`CLAUDE.md`（引用修复）、`templates/common/AGENTS-core.md`（模板源）
- **修复 commit**：待提交
- **回归测试**：`node repo-audit.mjs --repo . --format json`（DOC-004 虽不检查 javascript 分类，但 repo-audit.mjs 第 356 行 `hasFile(repoPath, 'AGENTS.md')` 加分至 `agent-collab` 分类特征）
