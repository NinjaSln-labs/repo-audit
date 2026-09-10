#!/usr/bin/env node
/**
 * repo-audit 自检验证链
 * 验证核心功能：审计引擎可运行、规则可加载、输出可解析、版本字面量不漂移。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

let pass = 0
let fail = 0

function check(name, fn) {
  try {
    fn()
    pass++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    fail++
    console.error(`  ✗ ${name}: ${e.message}`)
  }
}

// 1. 规则文件完整
check('规则文件可加载', () => {
  const domains = ['docs', 'git', 'quality', 'security']
  for (const d of domains) {
    if (!existsSync(`rules/domains/${d}.yaml`)) throw new Error(`缺 rules/domains/${d}.yaml`)
  }
  const cats = ['dsh-plugin', 'python-app', 'go-service', 'sandbox', 'content', 'archive']
  for (const c of cats) {
    if (!existsSync(`rules/categories/${c}.yaml`)) throw new Error(`缺 rules/categories/${c}.yaml`)
  }
})

// 2. 引擎可运行（自审计本仓库）
check('引擎可运行', () => {
  const r = spawnSync('node', ['repo-audit.mjs', '--repo', '.', '--format', 'json'], { encoding: 'utf-8' })
  if (r.status !== 0) throw new Error(`引擎执行失败 exit=${r.status}: ${r.stderr?.slice(-200)}`)
  const d = JSON.parse(r.stdout)
  if (!d.findings) throw new Error('输出缺少 findings')
  if (!Array.isArray(d.findings)) throw new Error('findings 非数组')
})

// 3. shim 存在
check('跨平台 shim', () => {
  for (const s of ['shim/repo-audit.sh', 'shim/repo-audit.cmd', 'shim/repo-audit.ps1']) {
    if (!existsSync(s)) throw new Error(`缺 ${s}`)
  }
})

// 4. 手册存在
check('手册完整', () => {
  for (const m of ['docs/repo-audit/AGENT-GUIDE.md', 'docs/repo-audit/HUMAN-GUIDE.md']) {
    if (!existsSync(m)) throw new Error(`缺 ${m}`)
  }
})

// 5. 版本一致性（发版防漂移守卫）
//    单源 package.json version；目标字面量与同步逻辑在 scripts/sync-version.mjs。
//    写侧：npm version 钩子（package.json "version" script）自动同步；
//    读侧：本检查，本地与 CI 同源拦截漂移。
//    动态 import 置于 check 之外——check() 是同步 try/catch，吞不下 async rejection。
const { checkAll } = await import('./scripts/sync-version.mjs')
check('版本一致性', () => {
  const r = checkAll()
  if (!r.ok) {
    const where = [
      `index.html=${r.indexHtml ? '✓' : '✗'}`,
      `AGENT-INDEX=${r.agentIndex ? '✓' : '✗'}`,
      `AGENT-PROTOCOL=${r.agentProtocol ? '✓' : '✗'}`,
    ].join(' ')
    throw new Error(`版本漂移（期望 ${r.version}）：${where}；修复: npm run sync-version`)
  }
})

// 6. npm 包防泄露（发版事故拦截）
//    HANDOFF.md 被 .gitignore 排除但 files 白名单 "*.md" glob 会捞走它——
//    CI checkout 拉不到（未入 git）所以 Trusted Publisher 发布安全；本地手动
//    npm publish 会泄露（v1.2.0/v1.2.1 实测中招）。files 数组 "!HANDOFF.md"
//    否定模式为正解；本守卫验证排除项仍生效，防止后续 files 改动回退防线。
check('npm 包排除 HANDOFF.md（files 否定模式）', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
  if (!Array.isArray(pkg.files)) throw new Error('package.json 缺 files 数组')
  for (const pattern of ['!HANDOFF.md', '!.env', '!.env.*']) {
    if (!pkg.files.includes(pattern)) {
      throw new Error(`files 数组缺排除模式 ${pattern}（npm 泄露防线，勿删）`)
    }
  }
})

console.log(`\n验证链结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail > 0 ? 1 : 0)
