// 版本字面量单源同步回归测试（scripts/sync-version.mjs）
// 契约：package.json version 是唯一单源；三目标见 syncAll。
// 形态遵守 P-008：进程内直调导出函数，fixture 用临时目录，不 spawn 子进程。
import { test } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { syncIndexHtml, syncAgentIndex, syncAgentProtocol, checkAll, readVersion } from '../scripts/sync-version.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function fixtureDir() {
  const dir = mkdtempSync(join(tmpdir(), 'version-sync-'))
  mkdirSync(join(dir, 'docs'), { recursive: true })
  return dir
}

// 仓库真实三目标做只读基线：checkAll 在提交前应恒 ok（与 verify.mjs 第 5 项同断言）
test('仓库现状：三目标版本与 package.json 一致（verify 链同源断言）', () => {
  const r = checkAll()
  assert.equal(r.ok, true, `漂移: ${JSON.stringify(r)}`)
})

test('readVersion：语义化版本通过，非语义化抛错', () => {
  const dir = fixtureDir()
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', version: '2.3.4' }))
  assert.equal(readVersion(join(dir, 'package.json')), '2.3.4')
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', version: 'banana' }))
  assert.throws(() => readVersion(join(dir, 'package.json')), /非语义化形态/)
})

test('syncIndexHtml：softwareVersion 字面量替换 + 幂等 no-op', () => {
  const dir = fixtureDir()
  const f = join(dir, 'docs/index.html')
  writeFileSync(f, '<script>{ "softwareVersion": "0.0.1", "name": "x" }</script>')
  const r1 = syncIndexHtml('1.2.3', f)
  assert.equal(r1.changed, true)
  assert.match(readFileSync(f, 'utf-8'), /"softwareVersion": "1\.2\.3"/)
  // 幂等：再同步同版本不写入
  const r2 = syncIndexHtml('1.2.3', f)
  assert.equal(r2.changed, false)
})

test('syncIndexHtml：缺 softwareVersion 键抛错（结构变更需人介入）', () => {
  const dir = fixtureDir()
  const f = join(dir, 'docs/index.html')
  writeFileSync(f, '<html></html>')
  assert.throws(() => syncIndexHtml('1.0.0', f), /softwareVersion/)
})

test('syncAgentIndex：顶层 version + tool.version 双字段替换', () => {
  const dir = fixtureDir()
  const f = join(dir, 'docs/AGENT-INDEX.json')
  writeFileSync(f, JSON.stringify({ version: '0.0.1', tool: { version: '0.0.1', name: 'x' } }, null, 2) + '\n')
  const r = syncAgentIndex('9.8.7', f)
  assert.equal(r.changed, true)
  const d = JSON.parse(readFileSync(f, 'utf-8'))
  assert.equal(d.version, '9.8.7')
  assert.equal(d.tool.version, '9.8.7')
  // 幂等
  assert.equal(syncAgentIndex('9.8.7', f).changed, false)
})

test('syncAgentIndex：缺 tool.version 抛错', () => {
  const dir = fixtureDir()
  const f = join(dir, 'docs/AGENT-INDEX.json')
  writeFileSync(f, JSON.stringify({ version: '0.0.1' }))
  assert.throws(() => syncAgentIndex('1.0.0', f), /tool\.version/)
})

test('syncAgentProtocol：frontmatter + §1 JSON 块两处替换', () => {
  const dir = fixtureDir()
  const f = join(dir, 'docs/AGENT-PROTOCOL.md')
  const tpl = '---\ntitle: x\nversion: "0.0.1"\n---\n\n```json\n{ "name": "repo-audit", "version": "0.0.1" }\n```\n'
  writeFileSync(f, tpl)
  const r = syncAgentProtocol('3.2.1', f)
  assert.equal(r.changed, true)
  const out = readFileSync(f, 'utf-8')
  assert.match(out, /^version:\s*"3\.2\.1"$/m)
  assert.match(out, /"version": "3\.2\.1"/)
  // 幂等
  assert.equal(syncAgentProtocol('3.2.1', f).changed, false)
})

test('syncAgentProtocol：frontmatter 无引号形态也替换', () => {
  const dir = fixtureDir()
  const f = join(dir, 'docs/AGENT-PROTOCOL.md')
  writeFileSync(f, '---\nversion: 0.0.1\n---\n\n```json\n{ "version": "0.0.1" }\n```\n')
  syncAgentProtocol('5.0.0', f)
  assert.match(readFileSync(f, 'utf-8'), /^version:\s*5\.0\.0$/m)
})

test('checkAll：漂移被守卫抓到（注入 fixture，三目标各自漂移 → ok:false）', () => {
  const dir = fixtureDir()
  const files = {
    indexHtml: join(dir, 'docs/index.html'),
    agentIndex: join(dir, 'docs/AGENT-INDEX.json'),
    agentProtocol: join(dir, 'docs/AGENT-PROTOCOL.md'),
  }
  // 三个漂移 fixture：各自只有一处漂移，其余正确——ok 必为 false 且只标 ✗ 漂移项
  const cases = [
    { which: 'indexHtml', mk: (f) => writeFileSync(f.indexHtml, '"softwareVersion": "0.0.1"') },
    { which: 'agentIndex', mk: (f) => writeFileSync(f.agentIndex, JSON.stringify({ version: '0.0.1', tool: { version: '1.0.0' } })) },
    { which: 'agentProtocol', mk: (f) => writeFileSync(f.agentProtocol, '---\nversion: "0.0.1"\n---\n{ "version": "1.0.0" }\n') },
  ]
  const good = (f) => {
    writeFileSync(f.indexHtml, '"softwareVersion": "1.0.0"')
    writeFileSync(f.agentIndex, JSON.stringify({ version: '1.0.0', tool: { version: '1.0.0' } }))
    writeFileSync(f.agentProtocol, '---\nversion: "1.0.0"\n---\n{ "version": "1.0.0" }\n')
  }
  for (const c of cases) {
    good(files)
    c.mk(files)
    const r = checkAll('1.0.0', files)
    assert.equal(r.ok, false, `case ${c.which} 应判漂移`)
    assert.equal(r[c.which], false, `case ${c.which} 应标 ✗`)
  }
  // 全对齐 → ok:true
  good(files)
  assert.equal(checkAll('1.0.0', files).ok, true)
})

// npm 泄露守卫（verify.mjs 第 6 项同源断言）：
// HANDOFF.md 被 files "*.md" glob 捞走过（v1.2.0/v1.2.1 手动发布实测中招），
// files 否定模式 "!HANDOFF.md" 是防线——此测试防后续 files 改动回退防线。
test('npm 包防泄露：files 数组保留 HANDOFF/.env 否定模式（verify 链同源断言）', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
  assert.ok(Array.isArray(pkg.files), 'files 必须是数组')
  for (const p of ['!HANDOFF.md', '!.env', '!.env.*']) {
    assert.ok(pkg.files.includes(p), `files 缺排除模式 ${p}`)
  }
})

// 端到端形态守卫：npm pack 实测排除生效（dry-run 不落盘）。
// 放在最后跑——依赖 npm CLI；对 verify 链的「包内容正确性」做实证而非纸面断言。
test('npm pack dry-run：tarball 不含 HANDOFF.md / .env / test/（端到端实证）', async () => {
  const { spawnSync } = await import('node:child_process')
  // P-008：测试内避免 spawn 子进程。但此处 spawn 的是 npm pack（外部 CLI 工具，
  // 非引擎本身），win32 ENOENT 风险点是 node/spawnSync('node')——npm 是 .cmd 形态，
  // shell:true 由 npm 生态保证。为稳妥用 execFileSync + shell 兜底（CI 双平台已实跑覆盖）。
  const r = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    encoding: 'utf-8',
    cwd: ROOT,
    shell: process.platform === 'win32',
  })
  assert.equal(r.status, 0, `npm pack dry-run 失败: ${r.stderr?.slice(-300)}`)
  const out = r.stdout
  assert.ok(out.length > 0, 'npm pack 无输出')
  // JSON 数组形态提取文件清单
  const j = JSON.parse(out)
  const files = (j[0]?.files ?? []).map((f) => f.path ?? f)
  assert.ok(files.length > 0, 'pack 清单为空')
  const banned = files.filter((p) => /(^|\/)(HANDOFF\.md|\.env(\..*)?|test\/)/.test(p))
  assert.deepEqual(banned, [], `tarball 含被禁文件: ${banned.join(', ')}`)
})
