<!-- PR 标题即 conventional commits：feat(scope): 中文描述 —— 合并后作为 CHANGELOG 素材 -->

## 变更说明

<改了什么 + 为什么（用户视角一句话 + 实现要点）>

## 自检清单

- [ ] CI 绿（ci.yml 验证链通过；本机 `npm test` / `make verify` / `python scripts/verify.py` 同源复跑过）
- [ ] 无本机私有信息（绝对路径/邮箱/token/部署实况）——`git grep -nE '/home/[a-z]|/mnt/[a-z]|/Users/[a-z]'`
- [ ] CHANGELOG.md 已登记（Unreleased 段）
- [ ] 文档同步（README / DEVELOPMENT 速查表 / SECURITY 支持面，按影响面）
- [ ] 兼容性：breaking 在标题加 `!` 并在描述中给出迁移路径

<!-- 维护者注意：无法本地跑 check:deploy 的贡献者在 PR 说明注明，由维护者发版前代跑部署纪律自检 -->
