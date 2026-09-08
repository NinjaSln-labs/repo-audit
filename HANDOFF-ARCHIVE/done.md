
## 2026-09-08 — Issue#5 闭环（.auditrc.yaml since 引号剥离）

- 接手即检测到新 Issue#5（反馈检测当场兑现：Issue#4 关闭后 27 小时即有新反馈，证实 HANDOFF §1「快照会过期」教训）
- 根因：`loadAuditrc` 中 `reason:` 分支有 `.replace(/['"]/g, '')` 去引号，`since:` 分支漏了——导致 `since: "2026-09-06"` 被解析成含字面内嵌引号的字符串，与 `SCHEMA.json` 声明的 `waived_since: ["string","null"]`（期望纯日期）不一致
- `b5e7c33` since 分支补 `.replace(/['"]/g, '')` 与 reason 分支对齐（一行）+ loadAuditrc 导出 + 5 用例回归（test/auditrc-since.test.mjs）
- 实测背书：fuyao-nomad 仓（Issue#5 复现仓）`waived_since` 现为纯日期字符串 `"2026-09-06"`，`waived_reason` 保持正确，`summary.waived=1`
- 验证链：自审计 100/A 19/19 + verify 4/4 + test 17/17（12→17，新增 5 用例）
- 待办：tag v1.3.3 自动发版 + Issue#5 带说明关闭

## 2026-09-07 — Issue#4 闭环（v1.3.2）

- 接手即检测到新 Issue#4（HANDOFF 快照「队列清零」已过期）→ 用户确认完整闭环方案
- `a758398` pathToFileURL 入口守卫修复 + isCliEntry 可导出 + stderr 诊断提示 + runShellCommand win32 Git Bash 探测 + CI windows 矩阵 + npm smoke + 回归 5 用例
- `d8b89a0` 测试 win32 路径写法修正（CI windows 首跑抓到 URL.pathname 坑，矩阵价值即证）
- v1.3.2 发版：CI 双平台全绿，npm latest + SLSA provenance，实机 prefix 安装 bin 实测 19 findings
- Issue#4 带说明关闭（含对反馈者方案的致谢）；P-007 坑归档
- Issue#4 裁定细节（正文 §3 第六次压缩时移出）：根因 `file://${realpathSync(argv[1])}` 手工拼接 win32 非法 URL 永不相等 → 全形态静默不执行；修复采反馈者 pathToFileURL 方案 + 第二建议（stderr 诊断提示）一并采纳

## 2026-09-06 — 反馈闭环 Issue#1/#2/#3（v1.3.0/v1.3.1）

（正文 §3 第六次压缩时移出，原为逐项裁定记录）

- **#1** yaml_field 不剥离行内注释 → 实锤，`stripYamlComment` 修复（引号内 # 保护）+ 回归 7 用例
- **#2** SEC-004 与 python-app 模板矛盾 → 实锤，`fallback_field` 通配 `jobs.*.permissions.id-token` + fix_hint 反噬消除
- **#3a** AGENTS 头部误导 → 半真（--update 存在但动线未成文），AGENTS-core 来源声明二选一 + AGENT-GUIDE 4.2 动线成文
- **#3b** requirements.lock 无消费者 → 成立，QUA-004 描述/fix_hint 写实 + BEST-PRACTICES 同步
- **#3c** 缺 PyPI 前置说明 → **不成立**（PUBLISHING.md 已有成文，反馈者 grep 遗漏），Issue 回复指引
- 发布 v1.3.0（修复主体）+ v1.3.1（symlink 入口守卫回归修复），实机三仓终验，Issue 带说明关闭

## 2026-09-06 — Trusted Publisher 首次 tag 发布验证（v1.2.3）

（正文 §3 第六次压缩时移出）

- 首次 v1.2.1 tag 触发 EBADENGINE（npm@latest 要求 node≥22.22，runner 是 node 20）→ workflow 改 node 22 + 条件升级
- 二次触发 provenance E422（package.json 缺 `repository` 字段）→ 已补
- v1.2.3 tag：OIDC token 交换 201 → npm publish 成功 → latest=1.2.3 + SLSA provenance + 实机安装 bin 可用

## 2026-09-07 — HANDOFF 核帐修正（第六次交接自查）

- commits 数字误记 30 → 实际 27（`git rev-list --count HEAD` 为准）——第五次快照手数估算未实测
- §2 占位边界残留过期条目「GitHub 远端发布未执行」（实际 2026-09-06 已完成）——回填时只改 §3 忘清 §2
- 发现并确认：HANDOFF.md 本身在 .gitignore（`cbb7e40` 裁定：内部路径不入开源），只有 HANDOFF-ARCHIVE/ 入库——第五次快照未记此事实，接收方可能误以为 HANDOFF.md 在库里
