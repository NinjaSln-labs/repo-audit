#!/usr/bin/env node
/**
 * 版本字面量单源同步（发版防漂移）
 *
 * 单源：package.json "version"。
 * 同步目标（3 文件 5 处机械字面量）：
 *   1. docs/index.html         JSON-LD "softwareVersion": "X.Y.Z"
 *   2. docs/AGENT-INDEX.json    顶层 "version" + tool.version（JSON.parse 精确改写）
 *   3. docs/AGENT-PROTOCOL.md   frontmatter version + §1 工具身份 JSON 块 "version"
 *
 * 双闸门设计：
 *   - 写侧：package.json "version" 生命周期钩子（npm version 提升后自动同步）
 *   - 读侧：verify.mjs 第 5 项守卫（CI 与本地同源拦截漂移）
 *
 * CLI 形态：
 *   node scripts/sync-version.mjs            # 同步（幂等；无漂移时输出 no-op）
 *   node scripts/sync-version.mjs --check    # 只检查不写入，漂移即 exit 1（守卫形态）
 *   node scripts/sync-version.mjs --check --json  # JSON 输出（CI/agent 友好）
 *
 * 幂等性：对所有目标按「期望字面量是否存在」判断，已同步即跳过写入，
 * 因此 verify 链可在任意时刻重复调用（--check 永不改动文件）。
 */
import { readFileSync, writeFileSync, realpathSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const FILES = {
  packageJson: join(ROOT, 'package.json'),
  indexHtml: join(ROOT, 'docs/index.html'),
  agentIndex: join(ROOT, 'docs/AGENT-INDEX.json'),
  agentProtocol: join(ROOT, 'docs/AGENT-PROTOCOL.md'),
}

/** 读取 package.json 版本（单源）。文件缺失/无 version 抛 Error。 */
export function readVersion(pkgPath = FILES.packageJson) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  if (typeof pkg.version !== 'string' || !/^\d+\.\d+\.\d+/.test(pkg.version)) {
    throw new Error(`package.json version 非语义化形态: ${String(pkg.version)}`)
  }
  return pkg.version
}

/**
 * 同步 docs/index.html 的 JSON-LD softwareVersion。
 * 纯文本替换（保持其余 HTML 字节不动）；无 softwareVersion 键则报错（结构变更需人介入）。
 * @returns {{changed: boolean}} 是否写入
 */
export function syncIndexHtml(version, filePath = FILES.indexHtml) {
  const src = readFileSync(filePath, 'utf-8')
  const re = /("softwareVersion"\s*:\s*")(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(")/
  if (!re.test(src)) {
    if (src.includes('"softwareVersion"')) {
      throw new Error('docs/index.html softwareVersion 存在但非 "X.Y.Z" 字面量形态，需人工核对')
    }
    throw new Error('docs/index.html 缺少 JSON-LD softwareVersion 键')
  }
  const next = src.replace(re, `$1${version}$3`)
  if (next === src) return { changed: false }
  writeFileSync(filePath, next)
  return { changed: true }
}

/**
 * 同步 docs/AGENT-INDEX.json 顶层 version 与 tool.version。
 * JSON.parse → 改字段 → JSON.stringify(2 空格缩进 + 尾换行)——该文件本就是这种格式化形态。
 * @returns {{changed: boolean}}
 */
export function syncAgentIndex(version, filePath = FILES.agentIndex) {
  const data = JSON.parse(readFileSync(filePath, 'utf-8'))
  const before = JSON.stringify(data)
  if (typeof data.version !== 'string' || typeof data.tool?.version !== 'string') {
    throw new Error('docs/AGENT-INDEX.json 缺 version/tool.version 字段，结构变更需人工核对')
  }
  data.version = version
  data.tool.version = version
  const after = JSON.stringify(data)
  if (after === before) return { changed: false }
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  return { changed: true }
}

/**
 * 同步 docs/AGENT-PROTOCOL.md 的 frontmatter version 与 §1 工具身份 JSON 块 "version"。
 * 纯文本替换；两处版本字面量各自精确匹配。
 * @returns {{changed: boolean}}
 */
export function syncAgentProtocol(version, filePath = FILES.agentProtocol) {
  const src = readFileSync(filePath, 'utf-8')
  let next = src
  let changed = false
  // frontmatter:  version: "1.2.1"（引号可选）
  const fm = /^version:\s*"?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)"?$/m
  if (!fm.test(next)) throw new Error('docs/AGENT-PROTOCOL.md frontmatter 缺 version 行')
  next = next.replace(fm, (m) => m.replace(/(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/, version))
  // §1 JSON 块:  "version": "1.2.1",
  const block = /("version"\s*:\s*")(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(")/
  if (!block.test(next)) throw new Error('docs/AGENT-PROTOCOL.md §1 工具身份块缺 "version" 字段')
  next = next.replace(block, `$1${version}$3`)
  if (next !== src) changed = true
  if (changed) writeFileSync(filePath, next)
  return { changed }
}

/** 全量同步（写侧钩子/CLI 默认）。返回逐文件 changed 报告。 */
export function syncAll(version = readVersion()) {
  return {
    version,
    indexHtml: syncIndexHtml(version),
    agentIndex: syncAgentIndex(version),
    agentProtocol: syncAgentProtocol(version),
  }
}

/** 检查模式（读侧守卫）：任一目标漂移返回 ok:false。路径可注入（测试用）。 */
export function checkAll(version = readVersion(), files = FILES) {
  const results = { version }
  let ok = true
  try {
    results.indexHtml = readFileSync(files.indexHtml, 'utf-8').includes(`"softwareVersion": "${version}"`)
  } catch { results.indexHtml = false }
  if (!results.indexHtml) ok = false
  try {
    const d = JSON.parse(readFileSync(files.agentIndex, 'utf-8'))
    results.agentIndex = d.version === version && d.tool?.version === version
  } catch { results.agentIndex = false }
  if (!results.agentIndex) ok = false
  try {
    const src = readFileSync(files.agentProtocol, 'utf-8')
    results.agentProtocol = new RegExp(`^version:\\s*"?${version.replace(/\./g, '\\.')}`, 'm').test(src)
      && src.includes(`"version": "${version}"`)
  } catch { results.agentProtocol = false }
  if (!results.agentProtocol) ok = false
  return { ok, ...results }
}

// ---------- CLI ----------
const isCli = process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
if (isCli) {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const json = args.includes('--json')
  try {
    if (check) {
      const r = checkAll()
      if (json) {
        console.log(JSON.stringify(r))
      } else if (r.ok) {
        console.log(`✓ 版本一致性: ${r.version}（index.html / AGENT-INDEX / AGENT-PROTOCOL 全同步）`)
      } else {
        console.error(`✗ 版本漂移: 期望 ${r.version}`)
        console.error(`  index.html: ${r.indexHtml ? '✓' : '✗'}  AGENT-INDEX.json: ${r.agentIndex ? '✓' : '✗'}  AGENT-PROTOCOL.md: ${r.agentProtocol ? '✓' : '✗'}`)
        console.error('  修复: node scripts/sync-version.mjs')
      }
      process.exit(r.ok ? 0 : 1)
    }
    const r = syncAll()
    const changedCount = ['indexHtml', 'agentIndex', 'agentProtocol'].filter((k) => r[k].changed).length
    if (json) console.log(JSON.stringify(r))
    else if (changedCount === 0) console.log(`版本同步 no-op: ${r.version}（三目标已是最新）`)
    else console.log(`版本同步完成: ${r.version} → ${changedCount} 个文件更新`)
  } catch (e) {
    console.error(`✗ ${e.message}`)
    process.exit(1)
  }
}
