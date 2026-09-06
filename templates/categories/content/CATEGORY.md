<!-- 模板说明（用后删除）：F 类"内容/写作"分类 delta 模板（最小集）。
     实证：rsi-unit-of-evolution（essay + review 三轮 + revision-notes）、part-time-job（简历 + 生成脚本）。 -->

# F 类 · 内容/写作（最小集）

> 设计原则：**文档本体即制品**——审校过程可留痕，构建链（若有）只服务导出。

## 文件集

```
<repo>/
├── README.md          # 主题一句话 + 文件导航 + 权威语言声明（若双语）
├── AGENTS.md          # 2 条：改稿在正文、评审意见只进 review 笔记不改正文历史
├── .gitignore         # 导出产物（PDF 等，若不入库）
├── <主文>.md
├── review.md          # 评审/改稿笔记（多轮：review-pass2.md、pass3…或单文件分节）
├── revision-notes.md  # 修订说明
└── <导出脚本>.py      # 可选（如 part-time-job 的简历 PDF 生成）
```

## 规则

- 正文与评审**分离**：改稿建议进 review 笔记，正文只收敛后的版本（保历史可 diff）
- 双语时声明权威语言（主文.md 权威，.en.md 镜像）——沿用 repo-root README 惯例
- 导出脚本入库存源码，产物（PDF）按 .gitignore 决定；**无 CI、无发布面、无 tag**
- 完稿后可在 GitHub 发 Release 挂终稿（可选）
