// Issue#6 回归：yaml_field fallback / 解析健壮性
// 三个根因形态：CRLF 行尾、引号键名、非 2 空格缩进——均导致 SEC-004 误判 fail
// 进程内直调 runCheckForTest（win32 下 spawnSync node 走 PATHEXT 解析不可靠，P-007 同族坑）
import { test } from 'node:test'
import { strictEqual } from 'node:assert'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stripYamlComment, runCheckForTest } from '../repo-audit.mjs'

const SEC004_RULE = {
  id: 'SEC-004',
  title: 'publish workflow 含 id-token write',
  severity: 'critical',
  domain: 'security',
  applies_to: ['python-app'],
  check: 'yaml_field',
  params: {
    path: '.github/workflows/publish.yml',
    field: 'permissions.id-token',
    fallback_field: ['jobs.*.permissions.id-token'],
    expected: 'write',
    skip_if_no_file: '.github/workflows/publish.yml',
  },
}

// 构造最小临时仓（无需 git——yaml_field 不读 git 元数据）→ 进程内执行 SEC-004
function auditSec004(yamlContent) {
  const dir = mkdtempSync(join(tmpdir(), 'issue6-'))
  try {
    mkdirSync(join(dir, '.github/workflows'), { recursive: true })
    writeFileSync(join(dir, '.github/workflows/publish.yml'), yamlContent)
    const { passed, evidence } = runCheckForTest(SEC004_RULE, dir)
    return (passed ? 'pass' : 'fail') + '|' + evidence
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const GOOD_2SP = [
  'permissions: {}',
  'jobs:',
  '  build:',
  '    permissions:',
  '      contents: read',
  '  publish:',
  '    permissions:',
  '      id-token: write',
  '',
].join('\n')

test('Issue#6 回归：2 空格 job 级 id-token（基线，修复前已 pass）', () => {
  strictEqual(auditSec004(GOOD_2SP).startsWith('pass'), true)
})

test('Issue#6 回归：CRLF 行尾不误判（修复前 fail）', () => {
  const crlf = GOOD_2SP.replace(/\n/g, '\r\n')
  strictEqual(auditSec004(crlf).startsWith('pass'), true)
})

test('Issue#6 回归：引号键名 "publish" 不误判（修复前 fail）', () => {
  const quoted = GOOD_2SP.replace('  publish:', '  "publish":')
  strictEqual(auditSec004(quoted).startsWith('pass'), true)
})

test('Issue#6 回归：4 空格缩进风格不误判（修复前 fail）', () => {
  const yaml = [
    'permissions: {}',
    'jobs:',
    '    build:',
    '        permissions:',
    '            contents: read',
    '    publish:',
    '        permissions:',
    '            id-token: write',
    '',
  ].join('\n')
  strictEqual(auditSec004(yaml).startsWith('pass'), true)
})

test('Issue#6 回归：真缺 id-token 仍正确 fail（防修复放水）', () => {
  const yaml = [
    'permissions: {}',
    'jobs:',
    '  build:',
    '    permissions:',
    '      contents: read',
    '  publish:',
    '    permissions:',
    '      contents: read',
    '',
  ].join('\n')
  strictEqual(auditSec004(yaml).startsWith('fail'), true)
})

test('Issue#6 回归：stripYamlComment 剥离 \\r（normalizeYamlLines 同族行为）', () => {
  // normalizeYamlLines 未导出；等价行为由 CRLF e2e 用例覆盖，此处验证值剥离链路
  strictEqual(stripYamlComment('write\r'), 'write')
})
