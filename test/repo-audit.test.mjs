import { test } from 'node:test'
import assert from 'node:assert'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

test('核心引擎存在', () => {
  assert.ok(existsSync(join(ROOT, 'repo-audit.mjs')), 'repo-audit.mjs 应存在')
})

test('规则目录完整', () => {
  assert.ok(existsSync(join(ROOT, 'rules/domains/docs.yaml')), 'docs 规则存在')
  assert.ok(existsSync(join(ROOT, 'rules/domains/security.yaml')), 'security 规则存在')
})

test('跨平台 shim 存在', () => {
  assert.ok(existsSync(join(ROOT, 'shim/repo-audit.sh')), 'shim .sh 存在')
  assert.ok(existsSync(join(ROOT, 'shim/repo-audit.cmd')), 'shim .cmd 存在')
})
