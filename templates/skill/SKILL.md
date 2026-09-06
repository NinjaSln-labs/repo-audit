---
name: <skill-name>
description: >-
  <一段话：做什么 + 怎么做（一句话方法）>。Use when <触发场景，含触发词；
  用户没点名领域也要能对上>。NOT for: <明确边界，指路替代 skill 或流程>。
metadata:
  version: "0.1.0"
  standard: agentskills.io
  scope: project
---

<!-- 模板说明（用后删除）：
- 校验：skills-ref validate；name ≤64 字符小写-连字符，须与目录名一致；description ≤1024 字符
- description 写法（agentskills.io）：祈使句 "Use when..."、写用户意图不写实现、
  宁可显式列场景（pushy）；可用 ~20 条查询（应/不应触发各半）做触发评测迭代
- 渐进式披露：正文建议 <500 行 / <5000 token；长内容拆 references/（相对路径、
  一层深，且写明"何时读该文件"）；重复逻辑固化成 scripts/
- 内容只写"代理不知道会做错"的（Gotchas 段价值最高）；从真实故障/runbook 合成，
  不凭训练知识空写
- 存放：已验证=个人跨仓库复用放 ~/.agents/skills/<skill-name>/（本 harness 与本机工具链读取的用户级目录）；随单库分发的项目级方案按工具而异——Claude Code 用 .claude/skills/（官方支持），DSH 的项目级 skills 机制未经验证，落地前先实测
- 只有跨仓库复用的流程才值得做成 skill；仓库内流程写 DEVELOPMENT.md 即可
-->

# <Skill 标题>

<做什么，两三句。>

## 何时用

- <场景 1>
- <场景 2>

## 步骤

1. <步骤 1（可执行命令优先）>
2. <步骤 2>

## Gotchas

<!-- 价值最高的段落：只列"不知道就会做错"的坑 -->

- <坑 1：症状 → 正确做法>

## 参考

<!-- 相对路径、一层深、写明何时读 -->
- <references/xxx.md>：<何时读>
