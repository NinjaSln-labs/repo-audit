#!/usr/bin/env node
/**
 * 单源漂移检查（多源收敛的常态化守卫）。
 *
 * 原则：AGENTS / CONTRIBUTING / .gitignore 的共性内容只允许存在于 common/*-core 一份源；
 * 分类目录只允许 *-append.md（差异段）与 sandbox/content 的整文件例外（见下）。
 *
 * 检查项：
 *   A. core 源存在且唯一
 *   B. 任何分类目录/基类不得包含"整份重复"——以 core 特征句为指纹扫描
 *   C. 分类 append 文件命名规范（*-append.md 或 sandbox/content 的整文件白名单）
 *   D. 基类 repo-root 不再保留三份成文（已迁 common）
 *
 * 用法：node templates/check-single-source.mjs   （CI/审计均可挂）
 * 退出码：发现多源 = 1。
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const COMMON = join(ROOT, 'common');
const BASE = join(ROOT, 'repo-root');
const CATS = join(ROOT, 'categories');
const ENGINEERING = ['dsh-plugin', 'python-app', 'go-service']; // core+append 模式
const MINIMAL = ['sandbox', 'content'];                          // core+append（AGENTS）/整文件白名单
const WHITELIST_FULL = new Set(['categories/sandbox/AGENTS.md', 'categories/content/AGENTS.md']); // 历史例外（现为空集则通过）

// core 指纹：这些句子只允许在 common 源出现一次；在分类/基类文件中出现 = 多源漂移
const CORE_FINGERPRINTS = {
  'AGENTS-core.md': ['AI 协作守则（agent 贡献者必读）', 'Conventional Commits 前缀 + 中文描述', '完成的定义 = 验证链全绿'],
  'CONTRIBUTING-core.md': ['main 保持线性历史', '尊重、建设性、对事不对人'],
  'gitignore-core.md': ['本机私有信息不入库（与 AGENTS.md 机密纪律同源）', 'HANDOFF-ARCHIVE/'],
  'README-core.md': ['README = 卖点 + 5 分钟上手', 'AI 协作者先读'],
  'DEVELOPMENT-core.md': ['小步提交、每步可验证、事实落盘', '复盘三问'],
  'PUBLISHING-core.md': ['每版一行：**做了什么 + 为什么 + 怎么验证的**', '实机重装/升级路径实测一遍'],
  'SECURITY-core.md': ['确认收到后 72 小时内回复', '严重漏洞优先修复并发布补丁版本'],
};
// 串味守卫：非 dsh-plugin 分类禁止出现 A 类专属命名串 `dsh-<name>`
const DSH_NAME_RE = /dsh-<name>/;
const DSH_NAME_ALLOWED_PREFIX = 'categories/dsh-plugin/';

let failed = 0;
const fail = (msg) => { console.error(`✗ ${msg}`); failed++; };
const ok = (msg) => console.log(`✓ ${msg}`);

// A. core 存在且唯一
for (const f of Object.keys(CORE_FINGERPRINTS)) {
  existsSync(join(COMMON, f)) ? ok(`common/${f} 存在`) : fail(`common/${f} 缺失（单源源丢失）`);
}

// B. 指纹扫描：core 特征句只准在 common 出现（覆盖 .md/.toml/.yml/.json——串味不全在 md）
const SCAN_EXT = /\.(md|toml|ya?ml|json)$/;
const scanTargets = [];
function collectMd(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) collectMd(full);
    else if (SCAN_EXT.test(e.name)) scanTargets.push(full);
  }
}
collectMd(BASE);
collectMd(CATS);
for (const [core, prints] of Object.entries(CORE_FINGERPRINTS)) {
  for (const print of prints) {
    for (const f of scanTargets) {
      const rel = f.slice(ROOT.length + 1);
      if (rel.startsWith(`common${'/'}${core}`)) continue;
      const text = readFileSync(f, 'utf8');
      if (text.includes(print)) fail(`多源漂移：指纹「${print.slice(0, 24)}…」同时出现在 common/${core} 与 ${rel}`);
    }
  }
}
ok('B. core 指纹扫描完成（无重复源即通过）');

// B2. 串味守卫：非 dsh-plugin 分类禁止 `dsh-<name>`（A 类专属命名）
for (const f of scanTargets) {
  const rel = f.slice(ROOT.length + 1);
  if (!rel.startsWith('categories/') || rel.startsWith(DSH_NAME_ALLOWED_PREFIX)) continue;
  const text = readFileSync(f, 'utf8');
  if (DSH_NAME_RE.test(text)) fail(`跨分类串味：${rel} 含 A 类专属命名串 dsh-<name>（应用 <repo>）`);
}
ok('B2. dsh-<name> 串味扫描完成');

// C. 分类 append 命名规范
for (const cat of readdirSync(CATS)) {
  const d = join(CATS, cat);
  for (const f of readdirSync(d)) {
    if (/^(AGENTS|CONTRIBUTING)\.md$/.test(f) && !WHITELIST_FULL.has(`categories/${cat}/${f}`)) {
      fail(`整份成文应改为 ${f.replace('.md', '')}-append.md（差异段）或入白名单：categories/${cat}/${f}`);
    }
    if (/^(AGENTS|CONTRIBUTING|gitignore)-append\.md$/.test(f) && !ENGINEERING.concat(MINIMAL).includes(cat)) {
      fail(`append 段出现在未知分类：categories/${cat}/${f}`);
    }
  }
}
ok('C. append 命名规范检查完成');

// D. 基类不留三份成文
for (const f of ['AGENTS.md', 'CONTRIBUTING.md', '.gitignore']) {
  if (existsSync(join(BASE, f))) fail(`基类残留成文 ${f}（应迁 common + append，scaffold 拼装生成）`);
}
ok('D. 基类单源化检查完成');

console.log(failed ? `\n共 ${failed} 处多源/违规。` : '\n单源检查全部通过。');
process.exit(failed ? 1 : 0);
