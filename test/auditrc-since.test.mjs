import { test } from 'node:test'
import { strictEqual } from 'node:assert'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadAuditrc } from '../repo-audit.mjs'

// Issue#5 回归集：.auditrc.yaml `since` 字段 YAML 引号剥离对称性
// 根因：loadAuditrc 中 `reason:` 分支有 .replace(/['"]/g, '')，`since:` 分支漏了——
// 导致 `since: "2026-09-06"` 被解析成 `"2026-09-06"`（字符串内嵌字面引号），
// 与 SCHEMA.json 声明的 waived_since: ["string","null"]（期望纯日期字符串）不一致。

function writeAuditrc(body) {
  const dir = mkdtempSync(join(tmpdir(), 'auditrc-since-'))
  writeFileSync(join(dir, '.auditrc.yaml'), body, 'utf8')
  return dir
}

test('auditrc.since：双引号 YAML 值剥离（Issue#5 主场景）', () => {
  const dir = writeAuditrc('- id: GIT-001\n  reason: "Conventional 前缀"\n  since: "2026-09-06"\n')
  try {
    const { waive } = loadAuditrc(dir)
    strictEqual_waived_since_equals(waive, '2026-09-06')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('auditrc.since：单引号 YAML 值剥离', () => {
  const dir = writeAuditrc("- id: GIT-001\n  reason: 'Conventional'\n  since: '2026-09-06'\n")
  try {
    const { waive } = loadAuditrc(dir)
    strictEqual_waived_since_equals(waive, '2026-09-06')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('auditrc.since：裸值（无引号）保持工作——回归护栏', () => {
  const dir = writeAuditrc('- id: GIT-001\n  reason: Conventional\n  since: 2026-09-06\n')
  try {
    const { waive } = loadAuditrc(dir)
    strictEqual_waived_since_equals(waive, '2026-09-06')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('auditrc.reason：既有引号剥离行为不回归', () => {
  const dir = writeAuditrc('- id: GIT-001\n  reason: "含 空格 的 长 说明"\n  since: 2026-09-06\n')
  try {
    const { waive } = loadAuditrc(dir)
    strictEqual_waived_reason_equals(waive, '含 空格 的 长 说明')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('auditrc.since：无 since 字段——保持 undefined（下游以 null 输出）', () => {
  const dir = writeAuditrc('- id: GIT-001\n  reason: "只写 reason"\n')
  try {
    const { waive } = loadAuditrc(dir)
    strictEqual(typeof waive[0].since, 'undefined')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

// 内联断言辅助：避免每个用例重复解构 + strictEqual
function strictEqual_waived_since_equals(waive, expected) {
  if (waive.length !== 1) throw new Error(`expect 1 waive, got ${waive.length}`)
  if (waive[0].since !== expected) {
    throw new Error(`waived_since mismatch: got ${JSON.stringify(waive[0].since)}, want ${JSON.stringify(expected)}`)
  }
}
function strictEqual_waived_reason_equals(waive, expected) {
  if (waive.length !== 1) throw new Error(`expect 1 waive, got ${waive.length}`)
  if (waive[0].reason !== expected) {
    throw new Error(`waived_reason mismatch: got ${JSON.stringify(waive[0].reason)}, want ${JSON.stringify(expected)}`)
  }
}
