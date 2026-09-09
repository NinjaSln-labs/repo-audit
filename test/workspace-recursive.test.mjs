import { test } from 'node:test'
import { strictEqual, ok } from 'node:assert'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { findWorkspacePackages, checkJsonFieldContent } from '../repo-audit.mjs'

function mkRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ws-recursive-'))
  for (const [relPath, content] of Object.entries(files)) {
    const abs = join(dir, relPath)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, content, 'utf8')
  }
  return dir
}

// ============================================================
// findWorkspacePackages
// ============================================================

test('findWorkspacePackages：单仓（仅根 package.json）', () => {
  const dir = mkRepo({ 'package.json': JSON.stringify({ name: 'single', license: 'MIT' }) })
  try {
    const pkgs = findWorkspacePackages(dir)
    strictEqual(pkgs.length, 1)
    strictEqual(pkgs[0].pkg.name, 'single')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('findWorkspacePackages：npm workspaces globs（packages/*）', () => {
  const dir = mkRepo({
    'package.json': JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
    'packages/lib-a/package.json': JSON.stringify({ name: 'lib-a', license: 'MIT' }),
    'packages/lib-b/package.json': JSON.stringify({ name: 'lib-b', license: 'MIT' }),
  })
  try {
    const pkgs = findWorkspacePackages(dir)
    strictEqual(pkgs.length, 3)
    const names = pkgs.map(p => p.pkg.name).sort()
    strictEqual(JSON.stringify(names), JSON.stringify(['lib-a', 'lib-b', 'root']))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('findWorkspacePackages：pnpm workspaces（{packages:[]}）', () => {
  const dir = mkRepo({
    'package.json': JSON.stringify({ name: 'root', workspaces: { packages: ['packages/*'] } }),
    'packages/lib-a/package.json': JSON.stringify({ name: 'lib-a', license: 'MIT' }),
  })
  try {
    const pkgs = findWorkspacePackages(dir)
    strictEqual(pkgs.length, 2)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('findWorkspacePackages：无 workspaces 字段但扫描常见目录', () => {
  const dir = mkRepo({
    'package.json': JSON.stringify({ name: 'root', license: 'MIT' }),
    'packages/lib-a/package.json': JSON.stringify({ name: 'lib-a', license: 'MIT' }),
    'packages/lib-b/package.json': JSON.stringify({ name: 'lib-b', license: 'MIT' }),
  })
  try {
    const pkgs = findWorkspacePackages(dir)
    strictEqual(pkgs.length, 3)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('findWorkspacePackages：跳过 node_modules 和隐藏目录', () => {
  const dir = mkRepo({
    'package.json': JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
    'packages/lib-a/package.json': JSON.stringify({ name: 'lib-a', license: 'MIT' }),
    'packages/.hidden/package.json': JSON.stringify({ name: 'hidden' }),
  })
  try {
    const pkgs = findWorkspacePackages(dir)
    const names = pkgs.map(p => p.pkg.name)
    ok(!names.includes('hidden'), '隐藏目录应被跳过')
    strictEqual(pkgs.length, 2)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

// ============================================================
// checkJsonFieldContent
// ============================================================

test('checkJsonFieldContent：字段存在', () => {
  const r = checkJsonFieldContent(JSON.stringify({ license: 'MIT' }), { field: 'license' })
  strictEqual(r.passed, true)
  ok(r.evidence.includes('license'))
  strictEqual(r.value, 'MIT')
})

test('checkJsonFieldContent：顶层字段不存在（evidence 含 = undefined）', () => {
  const r = checkJsonFieldContent(JSON.stringify({ name: 'test' }), { field: 'license' })
  strictEqual(r.passed, false)
  ok(r.evidence.includes('undefined'), `evidence 应含 undefined，实际: ${r.evidence}`)
})

test('checkJsonFieldContent：父字段不存在（evidence 含 不存在）', () => {
  // peerDependencies 不存在 → 子字段 some-pkg 报 不存在
  const r = checkJsonFieldContent(
    JSON.stringify({ name: 'test' }),
    { field: 'peerDependencies.some-pkg' }
  )
  strictEqual(r.passed, false)
  ok(r.evidence.includes('不存在'), `evidence 应含 不存在，实际: ${r.evidence}`)
})

test('checkJsonFieldContent：fallback_field 命中', () => {
  const r = checkJsonFieldContent(
    JSON.stringify({ devDependencies: { 'some-pkg': '^1.0.0' } }),
    { field: 'peerDependencies.some-pkg', fallback_field: 'devDependencies.some-pkg' }
  )
  strictEqual(r.passed, true)
  ok(r.evidence.includes('devDependencies'))
})

test('checkJsonFieldContent：fallback_field 未命中', () => {
  const r = checkJsonFieldContent(
    JSON.stringify({ name: 'test' }),
    { field: 'license', fallback_field: 'unknown-field' }
  )
  strictEqual(r.passed, false)
})

test('checkJsonFieldContent：JSON 解析失败', () => {
  const r = checkJsonFieldContent('not json', { field: 'license' })
  strictEqual(r.passed, false)
  ok(r.evidence.includes('JSON 解析失败'))
})

// ============================================================
// workspace 递归集成场景
// ============================================================

test('workspace_recursive：全部通过（3 包 monorepo license 一致）', () => {
  const dir = mkRepo({
    'package.json': JSON.stringify({ name: 'root', license: 'MIT' }),
    'packages/lib-a/package.json': JSON.stringify({ name: 'lib-a', license: 'MIT' }),
    'packages/lib-b/package.json': JSON.stringify({ name: 'lib-b', license: 'MIT' }),
  })
  try {
    const pkgs = findWorkspacePackages(dir)
    strictEqual(pkgs.length, 3)
    let allPassed = true
    for (const wp of pkgs) {
      const content = readFileSync(wp.path, 'utf8')
      const r = checkJsonFieldContent(content, { field: 'license' })
      if (!r.passed) allPassed = false
    }
    strictEqual(allPassed, true)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('workspace_recursive：部分失败（monorepo license 不一致）', () => {
  const dir = mkRepo({
    'package.json': JSON.stringify({ name: 'root', license: 'MIT' }),
    'packages/lib-a/package.json': JSON.stringify({ name: 'lib-a', license: 'MIT' }),
    'packages/lib-b/package.json': JSON.stringify({ name: 'lib-b', license: 'UNLICENSED' }),
    'packages/lib-c/package.json': JSON.stringify({ name: 'lib-c' }),
  })
  try {
    const pkgs = findWorkspacePackages(dir)
    strictEqual(pkgs.length, 4)
    let failCount = 0
    for (const wp of pkgs) {
      const content = readFileSync(wp.path, 'utf8')
      const r = checkJsonFieldContent(content, { field: 'license' })
      if (!r.passed) failCount++
    }
    strictEqual(failCount, 1)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('workspace_recursive：单包仓退化为单包检查', () => {
  const dir = mkRepo({ 'package.json': JSON.stringify({ name: 'single', license: 'MIT' }) })
  try {
    const pkgs = findWorkspacePackages(dir)
    strictEqual(pkgs.length, 1)
    const content = readFileSync(pkgs[0].path, 'utf8')
    const r = checkJsonFieldContent(content, { field: 'license' })
    strictEqual(r.passed, true)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('workspace_recursive：evidence 格式含相对路径与状态标记', () => {
  const dir = mkRepo({
    'package.json': JSON.stringify({ name: 'root', license: 'MIT' }),
    'packages/lib-a/package.json': JSON.stringify({ name: 'lib-a', license: 'MIT' }),
    'packages/lib-b/package.json': JSON.stringify({ name: 'lib-b' }),
  })
  try {
    const pkgs = findWorkspacePackages(dir)
    const results = []
    for (const wp of pkgs) {
      const content = readFileSync(wp.path, 'utf8')
      const r = checkJsonFieldContent(content, { field: 'license' })
      const relPath = wp.dir === dir ? '根' : join(dir, wp.dir).slice(dir.length + 1)
      results.push(`${relPath}: ${r.evidence} ${r.passed ? '✓' : '✗'}`)
    }
    const evidence = results.join(' | ')
    ok(evidence.includes('根:'), '应含根包')
    ok(evidence.includes('✓'), '应有通过标记')
    ok(evidence.includes('✗'), '应有失败标记')
    ok(evidence.includes('lib-b'), '应含失败包路径')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
