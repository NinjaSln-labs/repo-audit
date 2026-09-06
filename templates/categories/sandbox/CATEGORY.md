<!-- 模板说明（用后删除）：E 类"本地实验/dogfood 沙盒"分类 delta 模板（最小集）。
     实证：11 个 fuyao-* 仓（同构 agents/docs/package.json/src/tests、master、无 origin、生命周期短）。 -->

# E 类 · 本地实验/dogfood 沙盒（最小集）

> 设计原则：**生命周期短、无发布面**——只保留"跑得起来 + 记得下来"的最小结构。

## 文件集（就这些，不再多）

```
<repo>/
├── README.md          # 一句话目标 + 跑法 + 结论/收尾链接
├── README.en.md       # 英文镜像（双语标配）
├── AGENTS.md          # core 通用纪律 + 沙盒纪律 3 条（单源拼装）
├── .gitignore         # 通用段（机密/编辑器）+ Node 段
├── package.json       # 若 Node：name/description/scripts（按需，可省）
├── agents/ docs/ src/ tests/   # 按需；无则不建
└── HANDOFF.md         # 建议本地留（.gitignore 已忽略）
```

## 明确去掉的（相对基类，scaffold 已删）

- LICENSE/CONTRIBUTING/SECURITY/CHANGELOG/PUBLISHING/DEVELOPMENT/CI workflow/hooks——**无协作、无发布**
- 版本管理：不打 tag、不发 npm；"收尾"= README 写结论 + 会话归档
- 分支：master 直提；无 PR、无 CI
- 双语：README.en.md 骨架已提供（Goal/How to run/Outcome 极简镜像）

## 升级出口

实验转正（要发布/多人）→ 按目标分类（A/B/C/D）走 `scaffold.mjs` 全量脚手架，把本仓内容迁入——
**不要**在本分类上打补丁凑规范。
