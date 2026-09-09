// Issue#6 回归：yaml_field fallback / 解析健壮性
// 三个根因形态：CRLF 行尾、引号键名、非 2 空格缩进——均导致 SEC-004 误判 fail
import { test } from 'node:test'
import { strictEqual } from 'node:assert'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { stripYamlComment } from '../repo-audit.mjs'

const TOOL = new URL('..', import.meta.url).pathname

// 复现辅助：建最小 python-app 仓 + 指定 publish.yml 内容 → 返回 SEC-004 判定
function auditSec004(yamlContent) {
  const dir = mkdtempSync(join(tmpdir(), 'issue6-'))
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir })
    writeFileSync(join(dir, 'pyproject.toml'), '[project]\nname = "demo"\n')
    mkdirSync(join(dir, '.github/workflows'), { recursive: true })
    writeFileSync(join(dir, '.github/workflows/publish.yml'), yamlContent)
    const out = execFileSync('node', [join(TOOL, 'repo-audit.mjs'), '--repo', dir, '--format', 'json'], {
      cwd: TOOL, encoding: 'utf8',
    })
    const report = JSON.parse(out)
    const f = report.findings.find(x => x.id === 'SEC-004')
    return f ? f.status + '|' + f.evidence : 'SEC-004 未执行'
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
