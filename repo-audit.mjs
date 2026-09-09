#!/usr/bin/env node
/**
 * repo-audit — 仓库标准化审计工具
 *
 * 审计 scaffold 生成的仓库是否符合工业最佳实践标准。
 * 审计基准 = templates/ 目录下的模板文件。
 *
 * 用法：
 *   node repo-audit.mjs [options]
 *
 * 跨平台 shim：shim/repo-audit.sh | .cmd | .ps1
 *
 * 环境变量：
 *   LLM_PROVIDER   - openai / anthropic / deepseek / none（默认 none）
 *   LLM_API_KEY    - API Key（必须手动指定）
 *   LLM_MODEL      - 模型名称（默认 auto）
 *   LLM_BASE_URL   - 自定义 API 端点
 *   REPO_AUDIT_TYPES - 自定义分类列表（JSON 数组）
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, realpathSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { platform } from 'node:os'

const ROOT = dirname(fileURLToPath(import.meta.url))
const RULES_DIR = join(ROOT, 'rules')
const TEMPLATES_DIR = join(ROOT, 'templates')
const DEFAULT_OUTPUT_DIR = 'audit-report'

// ============================================================
// 参数解析
// ============================================================

const KNOWN_FLAGS = new Set([
  '--repo', '--type', '--format', '--output',
  '--llm-provider', '--llm-model', '--llm-base-url', '--strict',
  '--rules', '--dim', '--help', '-h', '--feedback'
])
const VALUE_FLAGS = new Set([
  '--repo', '--type', '--format', '--output',
  '--llm-provider', '--llm-model', '--llm-base-url', '--rules', '--dim', '--feedback'
])

function parseArgs(argv) {
  const args = { _positional: [], flags: {} }
  let expectValue = false
  const orphans = []

  for (const a of argv) {
    if (expectValue) { args._positional.push(a); expectValue = false; continue }
    const m = a.match(/^(--[a-z]+)=(.*)$/)
    if (m && KNOWN_FLAGS.has(m[1])) { args.flags[m[1]] = m[2]; continue }
    if (a.startsWith('--') && KNOWN_FLAGS.has(a) && !['--help', '-h', '--strict'].includes(a)) {
      args.flags[a] = true; expectValue = true; continue
    }
    if (a.startsWith('--') && !KNOWN_FLAGS.has(a.split('=')[0])) {
      orphans.push(a); args._positional.push(a)
    }
    if (a.startsWith('--')) { args.flags[a] = true; expectValue = true; continue }
    args._positional.push(a)
  }

  // 收集值
  const flagVals = {}
  const flat = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--') && VALUE_FLAGS.has(a) && i + 1 < argv.length) {
      flat.push([a, argv[i + 1]])
      i++
    } else if (!a.startsWith('--') || !KNOWN_FLAGS.has(a)) {
      flat.push([a, null])
    }
  }
  for (const [k, v] of flat) {
    if (v !== null) {
      if (flagVals[k] === undefined) flagVals[k] = v
      else if (Array.isArray(flagVals[k])) flagVals[k].push(v)
      else flagVals[k] = [flagVals[k], v]
    }
  }
  args.flags = { ...args.flags, ...flagVals }

  for (const o of orphans) {
    console.error(`⚠ 未知参数 "${o}"`)
  }
  return args
}

function usage() {
  return `repo-audit — 仓库标准化审计工具

用法：
  node repo-audit.mjs [选项]

选项：
  --repo <path>       目标仓库路径（默认：当前目录）
  --type <type>       强制指定分类（跳过自动检测）
  --format <fmt>      输出格式：md / json / both（默认：both）
  --output <path>     输出目录（默认：<repo>/audit-report/）
  --llm-provider <p>  LLM 协议：openai / anthropic（DeepSeek/通义/智谱/硅基流动等都用 openai）
  --llm-model <m>     模型名称（默认：自动选择）
  --strict            严格模式：Critical/Major 发现即 exit 1
  --rules <file>      自定义规则文件（可多次）
  --dim <domain>      只审计指定维度（可多次，如 --dim security --dim docs）
  --feedback <msg>    提交反馈（创建 GitHub Issue，自动预填环境信息）
  --help, -h          显示此帮助

环境变量：
  LLM_PROVIDER    LLM 协议（openai/anthropic/none）；也可用厂商别名如 deepseek/qwen/glm
  LLM_API_KEY     API Key（必须手动指定）
  LLM_MODEL       模型名称
  LLM_BASE_URL    自定义 API 端点（OpenAI 兼容厂商必填，如 https://api.deepseek.com）
  REPO_AUDIT_TYPES 自定义分类列表（JSON 数组）

退出码：
  0  审计通过（无 Critical/Major 或 --strict 未启用）
  1  有 Critical/Major 发现且 --strict 启用
  2  参数错误
  3  目标不是 git 仓库

示例：
  node repo-audit.mjs
  node repo-audit.mjs --repo /path/to/repo --type python-app
  node repo-audit.mjs --strict --format json --output ./reports
  LLM_PROVIDER=deepseek LLM_API_KEY=sk-xxx node repo-audit.mjs --dim security
`
}

// ============================================================
// 文件系统工具
// ============================================================

function hasFile(dir, name) {
  return existsSync(join(dir, name))
}

function hasDir(dir, name) {
  if (!existsSync(join(dir, name))) return false
  try { return readdirSync(join(dir, name)).length > 0 } catch { return false }
}

function readJsonSafe(path) {
  try { return JSON.parse(readFileSync(path, 'utf-8')) } catch { return null }
}


// P6: monorepo 感知 — 递归查找 package.json（根优先，fallback workspace 目录）
function findPackageJson(repoPath) {
  // 根优先
  const rootPkg = readJsonSafe(join(repoPath, 'package.json'))
  if (rootPkg) return { path: join(repoPath, 'package.json'), pkg: rootPkg, dir: repoPath }
  // 常见 monorepo 布局：apps/*/package.json, packages/*/package.json, workspaces/*/package.json
  const patterns = ['apps', 'packages', 'workspaces', 'components', 'modules', 'libs', 'projects']
  for (const pattern of patterns) {
    const patternDir = join(repoPath, pattern)
    if (!existsSync(patternDir)) continue
    try {
      for (const entry of readdirSync(patternDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const pkgPath = join(patternDir, entry.name, 'package.json')
        const pkg = readJsonSafe(pkgPath)
        if (pkg) return { path: pkgPath, pkg, dir: join(patternDir, entry.name) }
      }
    } catch {}
  }
  return null
}

// ============================================================
// workspace 递归 — 发现所有 workspace 包（根 + workspace globs + 常见目录）
// ============================================================

export function findWorkspacePackages(repoPath) {
  const results = []
  const seen = new Set()

  const tryAdd = (pkgPath) => {
    const resolved = resolve(pkgPath)
    if (seen.has(resolved)) return
    seen.add(resolved)
    // 跳过 node_modules 和隐藏目录
    const parts = resolved.split('/').join('\/')
    if (parts.includes('node_modules')) return
    const pkg = readJsonSafe(pkgPath)
    if (pkg) {
      results.push({ path: pkgPath, pkg, dir: dirname(pkgPath) })
    }
  }

  // 1. 根 package.json
  const rootPkgPath = join(repoPath, 'package.json')
  tryAdd(rootPkgPath)

  // 2. 根 package.json 的 workspaces 字段（npm: 数组 / pnpm: {packages:[...]}）
  const rootPkg = readJsonSafe(rootPkgPath)
  if (rootPkg?.workspaces) {
    const globs = Array.isArray(rootPkg.workspaces)
      ? rootPkg.workspaces
      : (rootPkg.workspaces.packages || [])
    for (const glob of globs) {
      expandWorkspaceGlob(repoPath, glob, tryAdd)
    }
  }

  // 3. 常见 workspace 目录扫描（无 workspaces 字段时的兜底）
  const patterns = ['apps', 'packages', 'workspaces', 'components', 'modules', 'libs', 'projects']
  for (const pattern of patterns) {
    const patternDir = join(repoPath, pattern)
    if (!existsSync(patternDir)) continue
    try {
      for (const entry of readdirSync(patternDir, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue
        tryAdd(join(patternDir, entry.name, 'package.json'))
      }
    } catch {}
  }

  return results
}

function expandWorkspaceGlob(repoPath, glob, tryAdd) {
  // 直接路径（无 glob 字符）
  if (!glob.includes('*')) {
    tryAdd(join(repoPath, glob, 'package.json'))
    return
  }
  // 常见 glob 模式：base/* 或 base/**/*
  const baseDir = join(repoPath, glob.split('*')[0].replace(/\/$/, ''))
  if (!existsSync(baseDir)) return
  try {
    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue
      tryAdd(join(baseDir, entry.name, 'package.json'))
    }
  } catch {}
}

// ============================================================
// json_field 核心检查逻辑（供 workspace 递归复用）
// ============================================================

export function checkJsonFieldContent(content, params) {
  const result = { passed: false, evidence: '', value: undefined }
  try {
    const obj = JSON.parse(content)
    const fields = (params?.field || '').split('.')
    let val = obj
    let missing = false
    let missingField = null
    for (const f of fields) {
      if (val === undefined || val === null) { missing = true; missingField = f; break }
      val = val[f]
    }
    if (missing) {
      result.evidence = `字段 ${missingField} 不存在`
    } else if (val !== undefined && val !== null) {
      result.passed = true
      result.value = val
      result.evidence = `字段 ${params.field} = ${JSON.stringify(val)?.slice(0, 100)}`
    } else {
      result.evidence = `字段 ${params.field} = ${JSON.stringify(val)?.slice(0, 100)}`
    }
    // fallback_field（如 peerDeps 不存在时检查 devDeps）
    if (!result.passed && params?.fallback_field) {
      const fbFields = Array.isArray(params.fallback_field)
        ? params.fallback_field
        : params.fallback_field.split('.')
      for (const candidate of fbFields) {
        const segs = Array.isArray(candidate) ? candidate : candidate.split('.')
        let fbVal = obj
        for (const f of segs) {
          if (fbVal === undefined || fbVal === null) break
          fbVal = fbVal[f]
        }
        if (fbVal !== undefined && fbVal !== null) {
          result.passed = true
          result.value = fbVal
          const matchedField = Array.isArray(params.fallback_field)
            ? String(candidate)
            : params.fallback_field
          result.evidence = `字段 ${params.field} 不存在，但 ${matchedField} = ${JSON.stringify(fbVal)?.slice(0, 100)}`
          break
        }
      }
    }
  } catch (e) {
    result.evidence = `JSON 解析失败: ${e.message}`
  }
  return result
}

function readFileSafe(path) {

  try { return readFileSync(path, 'utf-8') } catch { return null }
}

function walkDir(dir, predicate = () => true) {
  const result = []
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const full = join(d, entry.name)
      if (predicate(entry, full)) result.push(full)
      if (entry.isDirectory()) walk(full)
    }
  }
  try { walk(dir) } catch {}
  return result
}

function countNonHiddenFiles(path) {
  let count = 0
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      if (entry.isDirectory()) walk(join(dir, entry.name))
      else count++
    }
  }
  try { walk(path) } catch {}
  return count
}

// Issue#6 fix: 规范化 YAML 行——剥离行尾 \r（CRLF 文件在 Linux 审计时 (.*)$ 不吞 \r，
// 标量值带尾 \r 导致与 expected 比较全部失配）；行内键名引号在匹配处单独处理
function normalizeYamlLines(content) {
  return String(content).split('\n').map(l => l.replace(/\r$/, ''))
}
// Issue#6 fix: YAML 键名匹配——兼容裸键与引号键（"publish": / 'publish':），
// 返回 [key, valueRest]；非键行返回 null
function matchYamlKey(l) {
  const m = l.match(/^(\s*)(?:"([^"]+)"|'([^']+)'|(\w[\w\-]*))\s*:\s*(.*)$/)
  if (!m) return null
  return [m[2] ?? m[3] ?? m[4], m[5]]
}

// Issue#6 fix: 定位指定缩进层级下的具名子键（返回行号与缩进；未找到返回 null）
// 子层缩进以本层首个子键的实际缩进为准（兼容 2/4 空格等缩进风格），不再硬编码 +2
function findNestedYamlKey(lines, startIdx, baseIndent, key) {
  let childIndent = -1
  for (let i = startIdx + 1; i < lines.length; i++) {
    const l = lines[i]
    if (!l.trim() || l.trim().startsWith('#')) continue
    const ind = l.length - l.trimStart().length
    if (ind <= baseIndent) return null
    if (childIndent === -1) childIndent = ind // 本层首个子键确定子层缩进
    if (ind !== childIndent) continue // 只看直接子层
    const km = matchYamlKey(l)
    if (km && km[0] === key) return { idx: i, indent: ind }
  }
  return null
}
// Issue#2 fix: 列出指定父键下一层的所有子键名（通配 * 展开用）
// 子层缩进同样以首个子键实际缩进为准（与 findNestedYamlKey 对称）
function listChildKeys(lines, startIdx, baseIndent) {
  const keys = []
  let childIndent = -1
  for (let i = startIdx + 1; i < lines.length; i++) {
    const l = lines[i]
    if (!l.trim() || l.trim().startsWith('#')) continue
    const ind = l.length - l.trimStart().length
    if (ind <= baseIndent) break
    if (childIndent === -1) childIndent = ind
    if (ind !== childIndent) continue
    const km = matchYamlKey(l)
    if (km) keys.push(km[0])
  }
  return keys
}

// P0-3 fix: 嵌套 YAML 路径下钻查找（替代行级正则）
// Issue#1 fix: 剥离行内注释（# 前须有空白；引号内 # 不算注释——按引号配对状态跳过）
export function stripYamlComment(s) {
  let str = s
  // 整段以 # 开头（允许前导空白）→ 值为空（父级保持嵌套下钻语义）
  if (/^\s*#/.test(str)) return ''
  // 引号包裹：取第一个配对引号内的内容，引号后的尾注释丢弃
  const q = str.match(/^(\s*)(['"])([\s\S]*?)\2(?:\s+#.*)?$/)
  if (q) return q[3].trim()
  // 无引号：以「空白+#」为注释分隔，截断尾部
  const cut = str.search(/\s#/)
  if (cut !== -1) str = str.slice(0, cut)
  return str.trim()
}
function findNestedYaml(lines, startIdx, baseIndent, segments) {
  let currentIndent = baseIndent
  for (let i = startIdx + 1; i < lines.length; i++) {
    const l = lines[i]
    if (!l.trim() || l.trim().startsWith('#')) continue
    const ind = l.length - l.trimStart().length
    if (ind <= currentIndent) break // 退出当前层级
    const km = matchYamlKey(l)
    if (km) {
      const key = km[0]
      const valStr = stripYamlComment(km[1])
      const seg = segments[0]
      if (key === seg) {
        if (valStr && valStr !== '' && valStr !== '{}') {
          // 标量值
          return { found: true, value: valStr }
        }
        // 继续递归
        const sub = findNestedYaml(lines, i, ind, segments.slice(1))
        if (sub.found) return sub
      }
    }
  }
  return { found: false }
}


// P3: 项目定位识别 —— 扫描 README 首段检测个人/自用项目

// P5: 加载仓库级 .auditrc.yaml 豁免配置
export function loadAuditrc(repoPath) {
  const rcPath = join(repoPath, '.auditrc.yaml')
  if (!existsSync(rcPath)) return { waive: [] }
  const content = readFileSafe(rcPath)
  if (!content) return { waive: [] }
  try {
    // 简单解析：waive: 下的列表项
    const lines = content.split('\n')
    const waive = []
    let cur = null
    for (const raw of lines) {
      const line = raw.replace(/\r$/, '')
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      if (trimmed === 'waive:') continue
      if (trimmed.startsWith('- id:')) {
        if (cur) waive.push(cur)
        cur = { id: trimmed.replace('- id:', '').trim() }
      } else if (cur && trimmed.startsWith('reason:')) {
        cur.reason = trimmed.replace('reason:', '').replace(/['"]/g, '').trim()
      } else if (cur && trimmed.startsWith('since:')) {
        cur.since = trimmed.replace('since:', '').replace(/['"]/g, '').trim()
      }
    }
    if (cur) waive.push(cur)
    return { waive }
  } catch { return { waive: [] } }
}
function detectProjectMode(repoPath) {
  const README_PATHS = ['README.md', 'README.en.md', 'readme.md']
  let content = null
  for (const p of README_PATHS) {
    const c = readFileSafe(join(repoPath, p))
    if (c) { content = c; break }
  }
  if (!content) return 'generic'
  // 取前 10 行
  const lines = content.split('\n').slice(0, 10).join(' ')
  const PERSONAL_KEYWORDS = /自用|solo|personal|个人|单机|private.?use|internal.?use|private-use/i
  if (PERSONAL_KEYWORDS.test(lines)) return 'personal'
  return 'generic'
}

function countMdFiles(path) {
  let count = 0
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.md')) count++
    }
  }
  try { walk(path) } catch {}
  return count
}

// ============================================================
// Shell 工具（跨平台）
// ============================================================

// Windows 无原生 sh；command 检查器需 POSIX shell 语义。
// 优先 Git for Windows 自带的 bash（npm/CI/开发者机几乎必装），探测顺序：
//   1. sh 在 PATH（posix 或 Git Bash 已入 PATH）
//   2. 常见安装位置的 bash.exe（Git for Windows / scoop / winget）
//   3. 兜底 null（调用方降级为「检查器不可用」而非崩溃）
let winShellCache
function findShell() {
  if (process.platform !== 'win32') return { cmd: 'sh', args: ['-c'] }
  if (winShellCache !== undefined) return winShellCache
  const probe = (exe) => spawnSync(exe, ['-c', 'echo ok'], { encoding: 'utf-8' }).status === 0
  // 1) PATH 中的 sh（可能已是 Git Bash 的 sh.exe）
  const pathSh = spawnSync('where', ['sh'], { encoding: 'utf-8' })
  const candidates = []
  if (pathSh.status === 0) candidates.push(pathSh.stdout.trim().split('\n')[0].trim())
  // 2) 常见安装位置
  const common = [
    process.env.ProgramFiles && `${process.env.ProgramFiles}\\Git\\bin\\bash.exe`,
    process.env['ProgramFiles(x86)'] && `${process.env['ProgramFiles(x86)']}\\Git\\bin\\bash.exe`,
    process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}\\Programs\\Git\\bin\\bash.exe`,
  ].filter(Boolean)
  for (const p of common) { try { if (existsSync(p)) candidates.push(p) } catch {} }
  for (const c of candidates) {
    if (probe(c)) { winShellCache = { cmd: c, args: ['-c'] }; return winShellCache }
  }
  winShellCache = null
  return null
}

// command 检查器统一入口：跨平台执行 shell 命令
function runShellCommand(command, cwd) {
  const shell = findShell()
  if (!shell) return { status: -1, stdout: '', stderr: 'no POSIX shell found on win32 (Git Bash 未安装?)', error: { code: 'ENOENT' } }
  return spawnSync(shell.cmd, [...shell.args, command], { cwd, encoding: 'utf-8' })
}

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })
  return r.status === 0 ? r.stdout.trim() : null
}

function isGitRepo(path) {
  const r = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: path, encoding: 'utf-8' })
  return r.status === 0 && r.stdout.trim() === 'true'
}

function getRepoMetadata(path) {
  return {
    remote: git(['remote', 'get-url', 'origin'], path),
    branch: git(['branch', '--show-current'], path) || '(detached)',
    commitCount: parseInt(git(['rev-list', '--count', 'HEAD'], path) || '0'),
    fileCount: countNonHiddenFiles(path),
    lastCommit: git(['log', '-1', '--format=%ci'], path) || '未知',
    path
  }
}

// ============================================================
// 分类检测（通用化评分制）
// ============================================================

const CUSTOM_TYPES = process.env.REPO_AUDIT_TYPES
  ? JSON.parse(process.env.REPO_AUDIT_TYPES)
  : ['dsh-plugin', 'python-app', 'go-service', 'sandbox', 'content', 'product-oss',
     'javascript', 'npm-package', 'rust', 'ruby', 'java-kotlin', 'java-maven', 'agent-collab', 'changelog-driven', 'multi-maintainer', 'oss-like', 'automated-release', 'unknown', 'archive']

function detectType(repoPath) {
  const scores = {}

  // 语言 / 运行时检测
  const mpj = findPackageJson(repoPath)
  if (mpj) {
    scores['javascript'] = 5
    const pkg = mpj.pkg
    if (pkg?.peerDependencies?.['@deepseek-ai/dsh-session']) scores['dsh-plugin'] = 12
    else if (pkg?.devDependencies?.['@deepseek-ai/dsh-session']) scores['dsh-plugin'] = 10
    else scores['npm-package'] = 5
    if (hasFile(repoPath, 'cordis.patch.yml')) scores['dsh-plugin'] += 5
    if (hasFile(repoPath, 'tsconfig.json')) scores['javascript'] += 1
  }

  if (hasFile(repoPath, 'pyproject.toml')) scores['python-app'] = 8
  if (hasFile(repoPath, 'go.mod')) scores['go-service'] = 9
  if (hasFile(repoPath, 'Cargo.toml')) scores['rust'] = 8
  if (hasFile(repoPath, 'Gemfile')) scores['ruby'] = 7
  if (hasFile(repoPath, 'build.gradle') || hasFile(repoPath, 'build.gradle.kts')) scores['java-kotlin'] = 7
  if (hasFile(repoPath, 'pom.xml')) scores['java-maven'] = 7

  // 协作模式
  if (hasFile(repoPath, 'CHANGELOG.md')) scores['changelog-driven'] = 3
  if (hasFile(repoPath, '.github/CODEOWNERS')) scores['multi-maintainer'] = 4
  if (hasFile(repoPath, '.github/dependabot.yml')) scores['oss-like'] = 3
  if (hasFile(repoPath, 'release-please-config.json')) scores['automated-release'] = 5
  if (hasFile(repoPath, '.github/workflows/release-please.yml')) scores['automated-release'] += 2

  // AGENTS / 内容特征
  if (hasFile(repoPath, 'AGENTS.md')) scores['agent-collab'] = 3
  const mdCount = countMdFiles(repoPath)
  if (mdCount > 3 && !mpj && !hasFile(repoPath, 'go.mod') && !hasFile(repoPath, 'pyproject.toml')) {
    scores['content'] = Math.min(mdCount, 10)
  }

  // 沙盒特征
  if (!mpj && !hasFile(repoPath, 'go.mod') &&
      !hasFile(repoPath, 'pyproject.toml') && !hasFile(repoPath, 'Cargo.toml')) {
    if (hasFile(repoPath, 'AGENTS.md') && !hasFile(repoPath, 'SECURITY.md')) {
      scores['sandbox'] = 5
    }
  }

  // 归档检测
  if (isGitRepo(repoPath)) {
    const log = spawnSync('git', ['log', '--oneline', '-1'], { cwd: repoPath, encoding: 'utf-8' })
    if (log.stdout?.match(/\[archived\]|\[封版\]|archived/i)) scores['archive'] = 11
  }

  // Python tests 补充
  if (hasFile(repoPath, 'pytest.ini') || hasFile(repoPath, 'setup.cfg') || hasFile(repoPath, 'tox.ini')) {
    scores['python-app'] += 1
  }
  if (hasDir(repoPath, 'src')) {
    try {
      const srcFiles = readdirSync(join(repoPath, 'src'))
      if (srcFiles.some(f => f.endsWith('.py'))) scores['python-app'] += 2
      if (srcFiles.some(f => f.endsWith('.ts') || f.endsWith('.tsx'))) scores['javascript'] += 2
    } catch {}
  }
  if (hasDir(repoPath, 'tests') || hasDir(repoPath, 'test')) scores['python-app'] += 1

  // Go 补充
  if (hasDir(repoPath, 'cmd')) scores['go-service'] += 2
  if (hasFile(repoPath, 'Makefile')) {
    if (scores['go-service'] >= 9) scores['go-service'] += 1
    else scores['javascript'] += 1
  }

  // 选最高分
  let bestType = 'unknown'
  let bestScore = 0
  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) { bestScore = score; bestType = type }
  }

  // 过滤到自定义类型列表
  const validType = CUSTOM_TYPES.includes(bestType) ? bestType :
                    bestScore >= 5 ? bestType : 'unknown'

  return {
    type: validType,
    confidence: bestScore >= 8 ? 'high' : bestScore >= 5 ? 'medium' : 'low',
    reasons: Object.entries(scores)
      .filter(([, s]) => s >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t, s]) => `${t}: ${s}分`),
    scores
  }
}

// ============================================================
// 规则加载（YAML 轻量解析）
// ============================================================

function parseSimpleYaml(content) {
  const lines = content.split('\n')
  const result = { rules: [] }
  let currentRule = null
  // 深度跟踪栈：每个条目 { indent, obj, key } 表示 obj[key] 是缩进 indent 的对象
  // 用 depth 计数而不是 indent 比较来避免同层歧义
  const pathStack = [] // [{indent, obj, key}]

  function resolveTarget(indent) {
    // 从栈顶向下找第一个 indent 严格小于当前的条目
    for (let i = pathStack.length - 1; i >= 0; i--) {
      if (pathStack[i].indent < indent) return pathStack[i].obj
    }
    return currentRule
  }

  function setVal(obj, key, val, quoteType) {
    if (val === '' || val === '{}') { obj[key] = {}; return }
    // 去引号 + 转义处理
    let clean
    if (quoteType === "'") {
      // 单引号：仅去首尾引号，内部 \ 不做转义（YAML 1.2 规范）
      clean = val
    } else {
      // 双引号：去首尾引号 + 标准转义还原
      clean = val.replace(/^"|"$/g, '').trim()
      clean = clean
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .replace(/\\\//g, '/')
    }
    if (clean.startsWith('[') && clean.endsWith(']')) {
      try { obj[key] = JSON.parse(clean) } catch { obj[key] = clean }
    } else if (!isNaN(clean) && clean !== '') {
      obj[key] = Number(clean)
    } else if (clean === 'true') { obj[key] = true }
    else if (clean === 'false') { obj[key] = false }
    else { obj[key] = clean }
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '')
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const indent = line.length - line.trimStart().length

    // 顶层 rules: 数组项
    if (indent === 2 && trimmed.startsWith('- id:')) {
      if (currentRule) result.rules.push(currentRule)
      currentRule = {}
      pathStack.length = 0
      const val = trimmed.replace('- id:', '').trim().replace(/^["']|["']$/g, '')
      currentRule.id = val
      continue
    }

    if (!currentRule) continue

    // 数组项（indent >= 4, starts with "- "）
    if (trimmed.startsWith('- ') && indent >= 4) {
      const val = trimmed.slice(2).trim().replace(/^["']|["']$/g, '')
      // 数组项：弹出严格深于当前行的条目，保留同层的作为父对象
      while (pathStack.length > 0 && pathStack[pathStack.length - 1].indent > indent) {
        pathStack.pop()
      }
      let parent = resolveTarget(indent)
      // 如果父对象本身是空的（例如 patterns: 刚被创建），向上找一级
      if (Object.keys(parent).length === 0) {
        // 找到上一层的条目，取其 obj 作为父对象
        for (let i = pathStack.length - 1; i >= 0; i--) {
          const candidate = pathStack[i].obj
          if (Object.keys(candidate).length > 0) { parent = candidate; break }
        }
      }
      // 找到父对象中最后一个数组或空对象键
      const lastKey = Object.keys(parent).reverse().find(k =>
        Array.isArray(parent[k]) || (typeof parent[k] === 'object' && parent[k] !== null && Object.keys(parent[k]).length === 0)
      )
      if (lastKey) {
        if (typeof parent[lastKey] === 'object' && parent[lastKey] !== null && Object.keys(parent[lastKey]).length === 0) {
          parent[lastKey] = []
        }
        parent[lastKey].push(val)
      }
      continue
    }

    // 键值对
    const kvMatch = trimmed.match(/^(\w[\w\-]*)\s*:\s*(.*)$/)
    if (!kvMatch) continue
    const [, key, val] = kvMatch
    const cleanVal = val.trim()
    const target = resolveTarget(indent)

    if (cleanVal === '' || cleanVal === '{}') {
      // 嵌套对象：记录到路径栈
      // 注意：栈中存的是嵌套值本身（target[key]），不是 target
      target[key] = {}
      // 弹出所有 indent >= 当前的条目（这些已关闭）
      while (pathStack.length > 0 && pathStack[pathStack.length - 1].indent >= indent) {
        pathStack.pop()
      }
      pathStack.push({ indent, obj: target[key], key })
    } else {
      // 普通值：检测引号类型以正确处理转义
      const rawVal = val.trim()
      const quoteType = rawVal.startsWith("'") ? "'" : '"'
      setVal(target, key, cleanVal, quoteType)
      // 弹出所有 indent >= 当前的条目
      while (pathStack.length > 0 && pathStack[pathStack.length - 1].indent >= indent) {
        pathStack.pop()
      }
    }
  }

  if (currentRule) result.rules.push(currentRule)
  return result
}

function loadRules(type, customPaths = [], repoPath = null) {
  // P3: 项目定位识别
  const projectMode = repoPath ? detectProjectMode(repoPath) : 'generic'
  // 个人/自用项目豁免列表（按规则 ID）
  const personalSkipIds = new Set([
    'DOC-002',  // 双语 README
    'DOC-005',  // CONTRIBUTING.md
    'DOC-007',  // PUBLISHING.md
    'QUA-002',  // CI workflow
    'QUA-005',  // CLAUDE.md
    'GO-004',   // CI workflow go（与 QUA-002 重复）
    'GO-005',   // release workflow
  ])

  const allRules = []

  // 加载 domains/*.yaml（与 categories 同构过滤）
  const domainsDir = join(RULES_DIR, 'domains')
  if (existsSync(domainsDir)) {
    for (const file of readdirSync(domainsDir)) {
      if (!file.endsWith('.yaml')) continue
      const content = readFileSafe(join(domainsDir, file))
      if (content) {
        const parsed = parseSimpleYaml(content)
        const filtered = (parsed.rules || []).filter(r =>
          !r.applies_to || r.applies_to.includes('*') || r.applies_to.includes(type)
        )
        allRules.push(...filtered)
      }
    }
  }

  // 加载 categories/<type>.yaml
  const catFile = join(RULES_DIR, 'categories', `${type}.yaml`)
  if (existsSync(catFile)) {
    const content = readFileSafe(catFile)
    if (content) {
      const parsed = parseSimpleYaml(content)
      allRules.push(...(parsed.rules || []))
    }
  }

  // 加载 categories/*.yaml（通用分类规则，applies_to 含 '*' 的）
  if (existsSync(join(RULES_DIR, 'categories'))) {
    for (const file of readdirSync(join(RULES_DIR, 'categories'))) {
      if (!file.endsWith('.yaml') || file === `${type}.yaml`) continue
      const content = readFileSafe(join(RULES_DIR, 'categories', file))
      if (content) {
        const parsed = parseSimpleYaml(content)
        const filtered = (parsed.rules || []).filter(r =>
          !r.applies_to || r.applies_to.includes('*') || r.applies_to.includes(type)
        )
        allRules.push(...filtered)
      }
    }
  }

  // 加载自定义规则
  const paths = Array.isArray(customPaths) ? customPaths : (customPaths ? [customPaths] : [])
  for (const p of paths) {
    if (existsSync(p)) {
      const content = readFileSafe(p)
      if (content) {
        const parsed = parseSimpleYaml(content)
        allRules.push(...(parsed.rules || []))
      }
    }
  }

  // P3: 个人项目 N/A 过滤 + 等效内容检测
  if (projectMode === 'personal') {
    const filtered = allRules.filter(r => {
      // 直接跳过的规则
      if (personalSkipIds.has(r.id)) return false
      // 等效内容检测
      if (r.id === 'DOC-008' && existsSync(join(repoPath, 'docs', 'security.md'))) return false
      if (r.id === 'DOC-006' && hasEquivalentDocs(repoPath)) return false
      if (r.id === 'QUA-003' && existsSync(join(repoPath, '.githooks')) &&
          readdirSync(join(repoPath, '.githooks')).length > 0) return false
      return true
    })
    return filtered
  }

  // Archive: 仅保留安全/脱敏规则（SEC-001, SEC-003）
  if (type === 'archive') {
    const archiveIds = new Set(['SEC-001', 'SEC-003'])
    const filtered = allRules.filter(r => archiveIds.has(r.id) || r.domain === 'security')
    // 替换 allRules 引用后的去重
    const seenIds = new Set()
    return filtered.filter(r => {
      if (seenIds.has(r.id)) return false
      seenIds.add(r.id)
      return true
    })
  }

  // 参数类型校验：YAML 解析后参数类型可能与代码假设不匹配，
  // 在加载阶段提前发现并警告，而非运行时 catch 吞掉
  const PARAM_SCHEMA = {
    file_exists:    { paths: ['array', 'string'] },
    file_contains:  { path: ['string'], patterns: ['array', 'string'] },
    file_header:    { path: ['string'], pattern: ['string'] },
    regex:          { path: ['string'], pattern: ['string'] },
    grep:           { pattern: ['string'] },
    json_field:     { path: ['string'], field: ['string'], fallback_field: ['array', 'string'], workspace_recursive: ['boolean'] },
    toml_field:     { path: ['string'], field: ['string'] },
    yaml_field:     { path: ['string'], field: ['string'], fallback_field: ['array', 'string'] },
    directory_exists: { paths: ['array', 'string'] },
    not_exists:     { paths: ['array', 'string'] },
    glob_count:     { pattern: ['string'] },
    command_result: { command: ['string'] },
  }
  const checkType = (val, types) =>
    types.some(t => t === 'array' ? Array.isArray(val) : typeof val === t)
  for (const rule of allRules) {
    const schema = PARAM_SCHEMA[rule.check]
    if (!schema) continue
    const params = rule.params || {}
    for (const [key, expectedTypes] of Object.entries(schema)) {
      if (params[key] === undefined) continue
      if (!checkType(params[key], expectedTypes)) {
        console.error(`⚠ 规则 ${rule.id} (${rule.check})：参数 ${key} 类型不匹配，` +
          `期望 ${expectedTypes.join(' | ')}，实际 ${Array.isArray(params[key]) ? 'array' : typeof params[key]} — 该规则将被跳过`)
        rule._invalid = true
        break
      }
      // fallback_field 语义校验：字符串含逗号时应为数组格式
      if (rule.check === 'json_field' && key === 'fallback_field' &&
          typeof params[key] === 'string' && params[key].includes(',')) {
        console.error(`⚠ 规则 ${rule.id}：fallback_field 为逗号分隔字符串，应为 YAML 数组格式 [${JSON.stringify(params[key].split(','))}]`)
        rule._invalid = true
        break
      }
    }
  }

  // 去重：同 id 只保留第一条
  const seenIds = new Set()
  const deduped = []
  for (const r of allRules) {
    if (r._invalid) continue
    if (!seenIds.has(r.id)) { seenIds.add(r.id); deduped.push(r) }
  }
  return deduped
}

// P3: 等效开发文档检测
function hasEquivalentDocs(repoPath) {
  const docsDir = join(repoPath, 'docs')
  if (!existsSync(docsDir)) return false
  const docs = readdirSync(docsDir)
  // 检测到开发流程相关文档即视为等效
  return docs.some(f => /systemd|docker|deploy|cli|dev|setup/i.test(f) && f.endsWith('.md'))
}

// ============================================================
// 规则检查引擎
// ============================================================

// Issue#6 回归需要进程内直调（win32 下 spawnSync node 走 PATHEXT 解析不可靠，P-007 同族坑）
export function runCheckForTest(rule, repoPath, mpj = null) {
  return runCheck(rule, repoPath, mpj)
}

function runCheck(rule, repoPath, mpj = null) {
  const { check, params } = rule
  let passed = false
  let evidence = null

  switch (check) {
    case 'file_exists': {
      const paths = Array.isArray(params?.paths) ? params.paths : [params?.paths].filter(Boolean)
      const anyOf = params?.anyOf !== undefined ? params.anyOf : (paths.length > 1)
      // P23 fix: skip_if_no_parent — 父目录不存在时记 pass（非适用场景）
      if (params?.skip_if_no_parent) {
        const parentExists = existsSync(join(repoPath, params.skip_if_no_parent))
        if (!parentExists) {
          passed = true
          evidence = `✓ ${params.skip_if_no_parent} 不存在（非 scaffold 管理仓，豁免）`
          break
        }
      }
      // P0-2 fix: skip_if_no_file — 目标文件不存在时记 pass（非适用场景）
      if (params?.skip_if_no_file) {
        if (!existsSync(join(repoPath, params.skip_if_no_file))) {
          passed = true
          evidence = `✓ ${params.skip_if_no_file} 不存在（豁免）`
          break
        }
      }
      const found = paths.filter(p => existsSync(join(repoPath, p)))
      passed = anyOf ? found.length > 0 : paths.length > 0 && found.length === paths.length
      evidence = passed
        ? `✓ ${found.join(', ')}`
        : `缺失: ${paths.filter(p => !found.includes(p)).join(', ') || '无匹配'}`
      // P4: fallback_paths + fallback_field — 主路径 fail 时尝试 fallback（如 verify.mjs → package.json scripts.test）
      if (!passed && params?.fallback_paths && params?.fallback_field) {
        const fbPaths = Array.isArray(params.fallback_paths) ? params.fallback_paths : [params.fallback_paths]
        const fbField = params.fallback_field
        for (const fp of fbPaths) {
          if (existsSync(join(repoPath, fp)) || (fp === 'package.json' && mpj)) {
            const actualPath = (fp === 'package.json' && mpj) ? mpj.path : join(repoPath, fp)
            const fbContent = readFileSafe(actualPath)
            if (fbContent) {
              try {
                const fbJson = JSON.parse(fbContent)
                const segs = fbField.split('.')
                let val = fbJson
                for (const seg of segs) {
                  if (val === null || val === undefined) break
                  val = val[seg]
                }
                if (val !== null && val !== undefined && val !== '') {
                  passed = true
                  evidence = `✓ ${fp} fallback 命中: ${fbField} = ${String(val).slice(0, 60)}`
                  break
                }
              } catch {}
            }
          }
        }
        if (!passed) evidence += ` (fallback 也未命中)`
      }
      // P6: monorepo lock file fallback — 根无锁文件时搜索 workspace
      if (!passed && paths.length > 0 && mpj && mpj.dir !== repoPath) {
        const lockFiles = paths.filter(p => p.includes('lock') || p.includes('.sum'))
        if (lockFiles.length > 0) {
          for (const lf of lockFiles) {
            const wsPath = join(mpj.dir, lf)
            if (existsSync(wsPath)) {
              passed = true
              evidence = `✓ ${lf}（workspace: ${mpj.dir}）`
              break
            }
          }
        }
      }
      if (!passed) evidence = `缺失: ${paths.filter(p => !found.includes(p)).join(', ') || '无匹配'}`
      break
    }

    case 'file_contains': {
      const content = readFileSafe(join(repoPath, params?.path))
      if (!content) { passed = false; evidence = '文件不存在'; break }
      const patterns = Array.isArray(params?.patterns) ? params.patterns : [params?.patterns].filter(Boolean)
      const found = patterns.filter(p => content.includes(p))
      passed = found.length === patterns.length
      evidence = passed
        ? `✓ 全部匹配`
        : `缺失: ${patterns.filter(p => !found.includes(p)).join(', ')}`
      break
    }

    case 'file_header': {
      const content = readFileSafe(join(repoPath, params?.path))
      if (!content) { passed = false; evidence = '文件不存在'; break }
      const required = Array.isArray(params?.required_strings) ? params.required_strings : [params?.required_strings].filter(Boolean)
      const found = required.filter(s => content.includes(s))
      passed = found.length === required.length
      evidence = passed
        ? `✓ LICENSE 头部完整`
        : `缺失: ${required.filter(s => !found.includes(s)).join(', ')}`
      break
    }

    case 'regex': {
      if (params?.command) {
        const r = runShellCommand(params.command, repoPath)
        if (r.status !== 0) { passed = false; evidence = `命令失败: ${r.stderr?.trim() || 'exit ' + r.status}`; break }
        const re = new RegExp(params.pattern)
        const lines = r.stdout.split('\n').filter(Boolean)
        const matched = lines.filter(l => re.test(l))
        passed = params?.requireAtLeast
          ? matched.length >= params.requireAtLeast
          : matched.length === lines.length
        evidence = `${matched.length}/${lines.length} 匹配${params?.requireAtLeast ? `(需≥${params.requireAtLeast})` : ''}`
      } else if (params?.path) {
        const content = readFileSafe(join(repoPath, params.path))
        if (!content) { passed = false; evidence = '文件不存在'; break }
        const re = new RegExp(params.pattern)
        const matches = content.match(re)
        passed = !!matches
        evidence = matches ? `✓ 找到 ${matches.length} 处匹配` : '无匹配'
      }
      break
    }

    case 'grep': {
      const patterns = params?.patterns || []
      const exclude = params?.exclude || ['.git/', 'node_modules/', '.scaffold/', 'audit-report/', 'templates/']
      const results = []
      // P1-1 fix: 优先用 git ls-files 只扫描 tracked 文件，避免 .gitignore 排除的私有文档误报
      let trackedFiles = null
      try {
        const lsOut = spawnSync('git', ['ls-files'], { cwd: repoPath, encoding: 'utf-8' })
        if (lsOut.status === 0) {
          trackedFiles = new Set(lsOut.stdout.trim().split('\n').filter(Boolean))
        }
      } catch {}
      function grepDir(dir) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.name.startsWith('.')) continue
          const full = join(dir, entry.name)
          const rel = relative(repoPath, full)
          if (exclude.some(e => rel.startsWith(e) || rel.includes('/' + e))) continue
          // tracked-only 过滤
          if (trackedFiles && !trackedFiles.has(rel)) continue
          if (entry.isDirectory()) { grepDir(full); continue }
          if (!entry.isFile()) continue
          try {
            const content = readFileSync(full, 'utf-8')
            for (const pat of patterns) {
              const re = new RegExp(pat, 'i')
              const match = content.match(re)
              if (match) {
                const lineNum = content.split('\n').findIndex(l => re.test(l)) + 1
                results.push({ file: rel, line: lineNum, match: match[0]?.slice(0, 60) })
                if (params?.max_match !== undefined && results.length >= params.max_match) return
              }
            }
          } catch {}
        }
      }
      try { grepDir(repoPath) } catch {}
      passed = results.length === 0
      evidence = passed
        ? '✓ 未发现匹配'
        : `发现 ${results.length} 处: ${results.slice(0, 3).map(r => `${r.file}:${r.line}`).join(', ')}`
      break
    }

    case 'command_result': {
      const r = runShellCommand(params?.command, repoPath)
      if (r.status !== 0) { passed = false; evidence = `命令失败 (exit ${r.status})`; break }
      const val = parseInt(r.stdout.trim())
      // P3: skip_if_zero — 命令结果为 0 时豁免（如零提交仓、空文件等）
      if (params?.skip_if_zero && val === 0) {
        passed = true
        evidence = `✓ 结果为 0，豁免检查`
        break
      }
      passed = val >= (params?.min ?? 0)
      evidence = `结果: ${val} (需 ≥ ${params?.min ?? 0})`
      break
    }

    case 'json_field': {
      const pathParam = params?.path
      const workspaceRecursive = params?.workspace_recursive === true

      // workspace 递归：检查所有 workspace 包
      if (workspaceRecursive && pathParam === 'package.json') {
        const allPkgs = findWorkspacePackages(repoPath)
        if (allPkgs.length === 0) {
          passed = false; evidence = '未找到任何 package.json'; break
        }
        const results = []
        let allPassed = true
        for (const wp of allPkgs) {
          const content = readFileSafe(wp.path)
          if (!content) {
            results.push(`${wp.dir === repoPath ? '根' : relative(repoPath, wp.dir)}: 文件不可读 ✗`)
            allPassed = false; continue
          }
          const r = checkJsonFieldContent(content, params)
          const relPath = wp.dir === repoPath ? '根' : relative(repoPath, wp.dir)
          results.push(`${relPath}: ${r.evidence} ${r.passed ? '✓' : '✗'}`)
          if (!r.passed) allPassed = false
        }
        passed = allPassed
        evidence = results.join(' | ')
        break
      }

      // P6: monorepo 感知 — package.json 不在根时 fallback 到 workspace 目录
      let actualPath = join(repoPath, pathParam)
      let workspaceHint = ''
      if (!readFileSafe(actualPath) && pathParam === 'package.json' && mpj) {
        actualPath = mpj.path
        workspaceHint = `（workspace: ${mpj.dir}）`
      }
      const content = readFileSafe(actualPath)
      if (!content) { passed = false; evidence = '文件不存在'; break }
      const r = checkJsonFieldContent(content, params)
      passed = r.passed
      evidence = r.evidence + (workspaceHint || '')
      break
    }

        case 'toml_field': {
      const content = readFileSafe(join(repoPath, params?.path))
      if (!content) { passed = false; evidence = '文件不存在'; break }
      // P0-1 fix + v2 fix: 支持「表路径」expect_table 模式
      const field = (params?.field || '').trim()
      const expectTable = !!params?.expect_table
      const segs = field.split('.')
      const table = segs.slice(0, -1).join('.')   // 父表路径
      const key = segs[segs.length - 1]           // 最后一层 key
      const lines = content.split('\n')
      let curTable = ''  // 当前表路径（"" = 根表）
      let hit = null
      for (const raw of lines) {
        const line = raw.replace(/#.*/, '').trim() // 剥行尾注释
        if (!line) continue
        // 匹配 [table] 或 [[array.table]]
        const t = line.match(/^\[+([\w.\-]+)\]+$/)
        if (t) {
          const tbl = t[1]
          // expect_table 模式：精确匹配完整表路径（[tool.pytest.ini_options]）
          if (expectTable && tbl === field) { hit = true; break }
          // 非 expect_table 模式：track 当前表
          curTable = tbl
          continue
        }
        // 匹配 key = value（仅非 expect_table 模式）
        if (!expectTable) {
          const k = line.match(/^([\w.\-]+)\s*=\s*(.+)$/)
          if (k && k[1] === key && curTable === table) {
            hit = k[2].trim().replace(/^["']|["']$/g, '')
          }
        }
      }
      passed = !!hit
      if (expectTable) {
        evidence = hit ? `✓ 表 ${field} 存在` : `表 ${field} 不存在`
      } else {
        evidence = hit !== null ? `field = ${hit.slice(0, 80)}` : `字段不存在（[${table}]${table ? '.' : ''}${key}）`
      }
      break
    }

    case 'yaml_field': {
      // P0-2 fix: skip_if_no_file — 文件不存在时豁免（非适用场景）
      if (params?.skip_if_no_file) {
        if (!existsSync(join(repoPath, params.skip_if_no_file))) {
          passed = true
          evidence = `✓ ${params.skip_if_no_file} 不存在（豁免）`
          break
        }
      }
      const content = readFileSafe(join(repoPath, params?.path))
      if (!content) { passed = false; evidence = '文件不存在'; break }
      const field = params?.field || ''
      const expected = (params?.expected || '').trim()
      // 嵌套 YAML 路径：逐段下钻缩进层级
      const segments = field.split('.')
      let val = null
      let found = false
      try {
        const lines = normalizeYamlLines(content)
        let currentIndent = -1
        let currentObj = null
        // 第一遍：找到顶层键
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i]
          if (!l.trim() || l.trim().startsWith('#')) continue
          const ind = l.length - l.trimStart().length
          const km = matchYamlKey(l)
          if (km && km[0] === segments[0]) {
            currentIndent = ind
            const valStr = stripYamlComment(km[1])
            if (valStr && valStr !== '' && valStr !== '{}') {
              // 标量值（非嵌套）
              val = valStr
              found = true
            } else {
              // 嵌套对象，递归查找
              const subResult = findNestedYaml(lines, i, ind, segments.slice(1))
              if (subResult.found) { val = subResult.value; found = true }
            }
            break
          }
        }
      } catch {}
      if (found) {
        passed = val !== null && String(val).trim() === expected
        evidence = passed ? `value = ${String(val).trim()}` : `value = ${String(val)?.trim()}（期望 ${expected}）`
      } else {
        passed = false
        evidence = '字段不存在或值不匹配'
      }
      // Issue#2 fix: yaml_field fallback_field——主字段不匹配时逐个尝试备选字段路径（数组形态）。
      // 用途：同一语义在不同 YAML 形态下的位置差异（如 id-token: write 可在 workflow 顶层
      // 或 publish job 级——PyPA 最小化权限模式），任一命中即 pass。
      // 段内 `*` 为通配（如 jobs.*.permissions.id-token）：在该层级所有子键下逐个尝试。
      if (!passed && params?.fallback_field) {
        const fbList = Array.isArray(params.fallback_field) ? params.fallback_field : [params.fallback_field]
        for (const fbField of fbList) {
          if (!fbField) continue
          const fbSegments = String(fbField).split('.')
          const candidates = [] // 每项 {segments} —— 通配展开后的具体路径列表
          const expandWildcard = (segs) => {
            const wIdx = segs.indexOf('*')
            if (wIdx === -1) { candidates.push({ segments: segs }); return }
            // 找通配段父级的所有子键：先定位父级前缀（逐段下钻收集行号）
            const lines = normalizeYamlLines(content)
            const prefix = segs.slice(0, wIdx)
            const suffix = segs.slice(wIdx + 1)
            // 顶层段
            if (prefix.length === 0) return
            for (let i = 0; i < lines.length; i++) {
              const l = lines[i]
              if (!l.trim() || l.trim().startsWith('#')) continue
              const km = matchYamlKey(l)
              if (!km || km[0] !== prefix[0]) continue
              // 沿 prefix 下钻
              let curIdx = i, curIndent = l.length - l.trimStart().length
              let ok = true
              for (let d = 1; d < prefix.length; d++) {
                const sub = findNestedYamlKey(lines, curIdx, curIndent, prefix[d])
                if (!sub) { ok = false; break }
                curIdx = sub.idx; curIndent = sub.indent
              }
              if (!ok) return
              // 列出 curIndent 下一层的所有子键
              const childKeys = listChildKeys(lines, curIdx, curIndent)
              for (const k of childKeys) expandWildcard([...prefix, k, ...suffix])
              return
            }
          }
          expandWildcard(fbSegments)
          for (const cand of candidates) {
            let fbVal = null
            let fbFound = false
            try {
              const lines = normalizeYamlLines(content)
              for (let i = 0; i < lines.length; i++) {
                const l = lines[i]
                if (!l.trim() || l.trim().startsWith('#')) continue
                const ind = l.length - l.trimStart().length
                const km = matchYamlKey(l)
                if (km && km[0] === cand.segments[0]) {
                  const v = stripYamlComment(km[1])
                  if (v && v !== '' && v !== '{}') { fbVal = v; fbFound = true }
                  else {
                    const sub = findNestedYaml(lines, i, ind, cand.segments.slice(1))
                    if (sub.found) { fbVal = sub.value; fbFound = true }
                  }
                  break
                }
              }
            } catch {}
            if (fbFound && String(fbVal).trim() === expected) {
              passed = true
              const concrete = cand.segments.join('.')
              evidence = `fallback ${concrete} = ${String(fbVal).trim()}`
              break
            }
          }
          if (passed) break
        }
      }
      break
    }

    case 'directory_exists': {
      passed = existsSync(join(repoPath, params?.path))
      evidence = passed ? '✓ 目录存在' : `✗ 目录不存在: ${params?.path}`
      break
    }

    case 'not_exists': {
      const paths = Array.isArray(params?.paths) ? params.paths : [params?.paths].filter(Boolean)
      const found = paths.filter(p => existsSync(join(repoPath, p)))
      passed = found.length === 0
      evidence = passed ? '✓ 均不存在（符合预期）' : `存在: ${found.join(', ')}`
      break
    }

    case 'glob_count': {
      let count = 0
      function walk(dir) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.name.startsWith('.')) continue
          const full = join(dir, entry.name)
          if (entry.isDirectory()) { walk(full); continue }
          if (entry.name.match(new RegExp((params?.pattern || '*.md').replace('*', '.*') + '$'))) count++
        }
      }
      try { walk(repoPath) } catch {}
      passed = count >= (params?.min ?? 1)
      evidence = `匹配文件数: ${count} (需 ≥ ${params?.min ?? 1})`
      break
    }

    case 'structure': {
      const missing = []
      if (params?.requiredDirs) {
        for (const d of params.requiredDirs) {
          if (!existsSync(join(repoPath, d))) missing.push(`dir/${d}`)
        }
      }
      if (params?.requiredFiles) {
        for (const f of params.requiredFiles) {
          if (!existsSync(join(repoPath, f))) missing.push(f)
        }
      }
      passed = missing.length === 0
      evidence = passed ? '✓ 结构完整' : `缺失: ${missing.join(', ')}`
      break
    }

    default:
      passed = false
      evidence = `未知检查类型: ${check}`
  }

  return { passed, evidence }
}

// ============================================================
// LLM 增强层（可选）
// ============================================================

// 协议类型 = 底层 API 格式，不是具体厂商
// 任何支持 OpenAI 兼容协议的厂商都能用 --llm-provider openai + --llm-base-url
// 任何支持 Anthropic 兼容协议的厂商都能用 --llm-provider anthropic + --llm-base-url
const PROVIDERS = {
  openai: {
    // OpenAI 兼容协议
    // 覆盖范围：官方 API / 国内厂商 / 聚合平台 / 自建代理 / 本地运行（Ollama/LM Studio等）
    defaultUrl: 'https://api.openai.com/v1/chat/completions',
    protocol: 'openai',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
    buildBody: (model, prompt) => ({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 2000 }),
    parse: (resp) => resp?.choices?.[0]?.message?.content
  },
  anthropic: {
    // Anthropic 兼容协议
    // 覆盖范围：官方 API / 自建代理
    defaultUrl: 'https://api.anthropic.com/v1/messages',
    protocol: 'anthropic',
    headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }),
    buildBody: (model, prompt) => ({ model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
    parse: (resp) => resp?.content?.[0]?.text
  }
}

// 默认模型按协议分类
const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-20241022'
}

// 厂商/聚合平台别名 → 协议
// 新平台接入：加一行 alias → protocol + 在文档中说明端点即可
const PROVIDER_ALIASES = {
  // === OpenAI 兼容协议 ===
  // 聚合平台
  'openrouter': 'openai',
  'openrouter.ai': 'openai',
  // 官方
  'openai': 'openai',
  'azure': 'openai',
  'azure-openai': 'openai',
  // 国内厂商
  'deepseek': 'openai',
  'qwen': 'openai',
  '通义千问': 'openai',
  'glm': 'openai',
  '智谱': 'openai',
  'zhipu': 'openai',
  'siliconflow': 'openai',
  '硅基流动': 'openai',
  'yunwu': 'openai',
  '零一万物': 'openai',
  '01ai': 'openai',
  'doubao': 'openai',
  '豆包': 'openai',
  '字节火山': 'openai',
  // Anthropic 兼容
  'anthropic': 'anthropic',
  'claude': 'anthropic',
}

function getLLMConfig(args) {
  let rawProvider = args.flags['--llm-provider'] || process.env.LLM_PROVIDER || 'none'
  const apiKey = args.flags['--llm-api-key'] || process.env.LLM_API_KEY || ''
  const model = args.flags['--llm-model'] || process.env.LLM_MODEL || 'auto'
  const baseUrl = process.env.LLM_BASE_URL || args.flags['--llm-base-url']

  // 厂商别名 → 协议映射
  const protocol = PROVIDER_ALIASES[rawProvider.toLowerCase()] || rawProvider.toLowerCase()

  return { provider: protocol, apiKey, model, baseUrl }
}

function autoSelectModel(protocol) {
  return DEFAULT_MODELS[protocol] || 'gpt-4o-mini'
}

function buildLLMPrompt(rule, finding, metadata) {
  return `你是一位资深软件工程师，正在审计一个 scaffold 生成的仓库是否符合工业最佳实践。

## 仓库
- 分类: ${metadata.type}
- 远程: ${metadata.remote || '本地仓库'}
- 分支: ${metadata.branch}
- 提交数: ${metadata.commitCount}
- 文件数: ${metadata.fileCount}
- 最近更新: ${metadata.lastCommit}

## 待审计项: ${rule.id} — ${rule.title}
${rule.description}

## 当前规则检查结果
状态: ${finding.status}
证据: ${finding.evidence}

## 任务
1. 判断严重度（critical/major/minor/info）
2. 分析根本原因
3. 给出具体修复步骤（命令级，可直接执行）
4. 参考模板: ${rule.template_ref || '无'}

回复纯 JSON，不要有其他文字：
{"severity": "critical|major|minor|info", "root_cause": "...", "fix_steps": ["步骤1", "步骤2"], "priority": 1-5}`
}

async function enhanceWithLLM(findings, llmConfig, metadata) {
  if (llmConfig.provider === 'none' || !llmConfig.apiKey) return findings

  const failed = findings.filter(f => f.status === 'fail')
  const MAX = 5
  const enhanced = [...findings]

  for (const finding of failed.slice(0, MAX)) {
    const rule = ALL_RULES_CACHE.find(r => r.id === finding.id)
    if (!rule) continue
    try {
      const config = { ...llmConfig, model: llmConfig.model === 'auto' ? autoSelectModel(llmConfig.provider) : llmConfig.model }
      const provider = PROVIDERS[config.provider]
      if (!provider) continue

      const prompt = buildLLMPrompt(rule, finding, metadata)
      const res = await fetch(config.baseUrl || provider.url, {
        method: 'POST',
        headers: provider.headers(config.apiKey),
        body: JSON.stringify(provider.buildBody(config.model, prompt))
      })
      if (!res.ok) { console.error(`⚠ LLM API ${res.status}`); continue }
      const text = provider.parse(await res.json())
      if (text) {
        finding.llm_analysis = safeParseJSON(text)
        finding.llm_raw = text
        finding.status = 'llm'
      }
    } catch {
      // LLM 失败静默跳过
    }
  }
  return enhanced
}

function safeParseJSON(str) {
  try { return JSON.parse(str) } catch { return { raw: str?.slice(0, 500) } }
}

let ALL_RULES_CACHE = []

// ============================================================
// 报告生成
// ============================================================

function calcSummary(findings, llmUsed) {
  // P5: 跳过 waived 项
  const active = findings.filter(f => f.status !== 'waived')
  const s = { critical: 0, major: 0, minor: 0, info: 0, pass: 0, total: active.length, waived: findings.filter(f => f.status === 'waived').length, llmUsed }
  for (const f of active) {
    if (f.status === 'pass') s.pass++
    else s[f.severity] = (s[f.severity] || 0) + 1
  }
  return s
}

function generateMarkdown(findings, llmUsed, summary, metadata, type) {
  const lines = []

  lines.push('# 仓库标准化审计报告')
  lines.push('')
  lines.push(`> 生成时间: ${new Date().toISOString()}`)
  lines.push(`> 审计分类: **${type}**`)
  lines.push(`> LLM 增强: ${llmUsed ? '已启用' : '未启用（纯规则模式）'}`)
  lines.push('')

  // 仓库信息
  lines.push('## 仓库信息')
  lines.push('')
  lines.push('| 字段 | 值 |')
  lines.push('|---|---|')
  lines.push(`| 远程 | ${metadata.remote || '本地仓库'} |`)
  lines.push(`| 分支 | ${metadata.branch} |`)
  lines.push(`| 提交数 | ${metadata.commitCount} |`)
  lines.push(`| 文件数 | ${metadata.fileCount} |`)
  lines.push(`| 最近更新 | ${metadata.lastCommit} |`)
  lines.push('')

  // 审计摘要
  lines.push('## 审计摘要')
  lines.push('')
  lines.push('| 级别 | 数量 |')
  lines.push('|---|---|')
  lines.push(`| 🔴 Critical | ${summary.critical || 0} |`)
  lines.push(`| 🟠 Major | ${summary.major || 0} |`)
  lines.push(`| 🟡 Minor | ${summary.minor || 0} |`)
  lines.push(`| 🔵 Info | ${summary.info || 0} |`)
  lines.push(`| ✅ 通过 | ${summary.pass || 0} |`)
  lines.push(`| **总计** | **${summary.total}** |`)
  lines.push('')

  // 健康评分
  const score = Math.max(0, 100 - (summary.critical || 0) * 25 - (summary.major || 0) * 10 - (summary.minor || 0) * 3)
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'
  lines.push(`**综合评分: ${score}/100（等级 ${grade}）**`)
  lines.push('')

  // 详细发现
  lines.push('## 详细发现')
  lines.push('')

  const severityOrder = { critical: 0, major: 1, minor: 2, info: 3 }
  const sorted = [...findings].sort((a, b) => {
    if (a.status === 'pass' && b.status !== 'pass') return 1
    if (b.status === 'pass' && a.status !== 'pass') return -1
    return (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
  })

  for (const f of sorted) {
    if (f.status === 'pass') continue

    const icon = f.severity === 'critical' ? '🔴' : f.severity === 'major' ? '🟠' : f.severity === 'minor' ? '🟡' : '🔵'
    const statusIcon = f.status === 'llm' ? '🤖' : '❌'

    lines.push(`### ${icon} ${f.id}: ${f.title} ${statusIcon}`)
    lines.push('')
    lines.push(`**领域**: ${f.domain} | **级别**: ${f.severity}`)
    lines.push('')
    lines.push(f.message)
    lines.push('')
    lines.push(`**证据**: \`${f.evidence || '无'}\``)
    lines.push('')

    if (f.hint) {
      lines.push(`**修复建议**: ${f.hint}`)
      lines.push('')
    }

    if (f.template_ref) {
      lines.push(`**参考模板**: \`${f.template_ref}\``)
      lines.push('')
    }

    if (f.llm_analysis?.root_cause) {
      lines.push('#### 🤖 LLM 分析')
      lines.push('')
      lines.push(`- **严重度**: ${f.llm_analysis.severity || f.severity}`)
      lines.push(`- **根本原因**: ${f.llm_analysis.root_cause}`)
      lines.push('')
      if (f.llm_analysis.fix_steps?.length) {
        lines.push('- **修复步骤**:')
        for (const step of f.llm_analysis.fix_steps) {
          lines.push(`  1. ${step}`)
        }
        lines.push('')
      }
    }

    lines.push('---')
    lines.push('')
  }

  // 通过项
  const passed = findings.filter(f => f.status === 'pass')
  if (passed.length > 0) {
    lines.push('## ✅ 通过项（共 ' + passed.length + ' 项）')
    lines.push('')
    for (const f of passed.slice(0, 15)) {
      lines.push(`- ${f.id}: ${f.title}`)
    }
    if (passed.length > 15) lines.push(`... 以及 ${passed.length - 15} 项其他通过`)
    lines.push('')
  }

  return lines.join('\n')
}

function generateJSON(findings, llmUsed, summary, metadata, type) {
  return {
    generated_at: new Date().toISOString(),
    audit_type: type,
    llm_used: llmUsed,
    metadata,
    summary,
    findings: findings.map(f => ({
      id: f.id, title: f.title, severity: f.severity,
      domain: f.domain, applies_to: f.applies_to,
      status: f.status, message: f.message,
      evidence: f.evidence, hint: f.hint,
      template_ref: f.template_ref,
      waived_reason: f.waived_reason || null,
      waived_since: f.waived_since || null,
      llm_analysis: f.llm_analysis || null,
      llm_raw: f.llm_raw || null
    }))
  }
}

function generateSummaryText(summary, metadata, type, outputDir) {
  const score = Math.max(0, 100 - (summary.critical || 0) * 25 - (summary.major || 0) * 10 - (summary.minor || 0) * 3)
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'
  const reportPath = outputDir ? `${outputDir}/report.md + report.json` : 'audit-report/report.md + report.json'
  return [
    `分类: ${type} | 评分: ${score}/100 (${grade})`,
    `发现: 🔴${summary.critical || 0} 🟠${summary.major || 0} 🟡${summary.minor || 0} 🔵${summary.info || 0} ✅${summary.pass || 0}`,
    `LLM 增强: ${summary.llmUsed ? '已启用' : '未启用'}`,
    `报告: ${reportPath}`
  ].join('  |  ')
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.flags['--help'] || args.flags['-h']) {
    console.log(usage())
    process.exit(0)
  }

  // Feedback 通道：创建 GitHub Issue（Agent 可检测）
  if (args.flags['--feedback']) {
    const message = args.flags['--feedback'] || '（未提供反馈内容）'
    const label = 'feedback'
    const body = `## 反馈内容

${message}

---

## 环境信息

- **工具版本**: ${readFileSync('package.json', 'utf-8').match(/"version":\s*"([^"]+)"/)?.[1] || 'unknown'}
- **Node.js**: ${process.version}
- **平台**: ${process.platform} ${process.arch}
- **时间**: ${new Date().toISOString()}

## 标签

- ${label}
- audit-feedback
`
    // 尝试通过 gh CLI 创建 Issue
    const { execSync } = await import('node:child_process')
    try {
      const result = execSync(
        `gh issue create --repo NinjaSln-labs/repo-audit --title "Feedback: ${message.slice(0, 60)}" --body "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" --label "${label},audit-feedback"`,
        { encoding: 'utf-8', timeout: 30000 }
      )
      console.error(`✓ 反馈已提交: ${result.trim()}`)
    } catch (e) {
      console.error(`✗ gh CLI 不可用，请手动提交反馈：`)
      console.error(`  https://github.com/NinjaSln-labs/repo-audit/issues/new?labels=${label},audit-feedback&body=${encodeURIComponent(body)}`)
    }
    process.exit(0)
  }

  const repoPath = resolve(args.flags['--repo'] || '.')
  const forceType = args.flags['--type']
  const format = args.flags['--format'] || 'both'
  const outputDir = args.flags['--output'] ? resolve(args.flags['--output']) : join(repoPath, DEFAULT_OUTPUT_DIR)
  const strict = !!args.flags['--strict']
  const customRules = args.flags['--rules']
  const dims = args.flags['--dim']

  // 验证 git 仓
  if (!isGitRepo(repoPath)) {
    console.error(`✗ 目标不是 git 仓库: ${repoPath}`)
    process.exit(3)
  }

  // 分类检测
  const detected = detectType(repoPath)
  const type = forceType || detected.type
  console.error(`📋 分类: ${type}（置信度: ${detected.confidence}）${detected.reasons.length ? ' — ' + detected.reasons.join(', ') : ''}`)

  // 加载规则
  const rulesPaths = Array.isArray(customRules) ? customRules : (customRules ? [customRules] : [])
  ALL_RULES_CACHE = loadRules(type, rulesPaths, repoPath)
  // P5: 加载仓库级豁免配置
  const auditrc = repoPath ? loadAuditrc(repoPath) : { waive: [] }
  const waivedIds = new Set(auditrc.waive.map(w => w.id))

  // 按维度过滤
  const rules = dims
    ? ALL_RULES_CACHE.filter(r => dims.includes(r.domain))
    : ALL_RULES_CACHE

  console.error(`📐 规则数: ${rules.length}（维度: ${[...new Set(rules.map(r => r.domain))].join(', ')}）`)

  // P6: monorepo 感知 — 查找 package.json（供 file_exists fallback 使用）
  const mpj = findPackageJson(repoPath)

  // 执行检查
  const findings = []
  for (const rule of rules) {
    const { passed, evidence } = runCheck(rule, repoPath, mpj)
    findings.push({
      id: rule.id, title: rule.title, severity: rule.severity,
      domain: rule.domain, applies_to: rule.applies_to,
      status: passed ? 'pass' : 'fail',
      message: passed ? '符合' : rule.description,
      evidence, hint: rule.fix_hint || null,
      template_ref: rule.template_ref || null
    })
  }

  // P5: 应用仓库级豁免
  for (const f of findings) {
    if (waivedIds.has(f.id)) {
      f.status = 'waived'
      const wa = auditrc.waive.find(w => w.id === f.id)
      f.waived_reason = wa?.reason || null
      f.waived_since = wa?.since || null
    }
  }

  // LLM 增强
  const llmConfig = getLLMConfig(args)
  const metadata = getRepoMetadata(repoPath)
  let finalFindings = findings
  if (llmConfig.provider !== 'none' && llmConfig.apiKey) {
    console.error('🤖 启动 LLM 增强...')
    finalFindings = await enhanceWithLLM(findings, llmConfig, metadata)
  }

  const summary = calcSummary(finalFindings, llmConfig.provider !== 'none' && llmConfig.apiKey)

  // 生成报告
  const markdown = generateMarkdown(finalFindings, summary.llmUsed, summary, metadata, type)
  const json = generateJSON(finalFindings, summary.llmUsed, summary, metadata, type)
  const summaryText = generateSummaryText(summary, metadata, type, outputDir)

  // 写入文件
  mkdirSync(outputDir, { recursive: true })
  writeFileSync(join(outputDir, 'report.md'), markdown, 'utf-8')
  writeFileSync(join(outputDir, 'report.json'), JSON.stringify(json, null, 2), 'utf-8')

  // stdout
  console.error(summaryText)
  if (format === 'json' || format === 'both') {
    console.log(JSON.stringify(json, null, 2))
  }
  if (format === 'md' || format === 'both') {
    // markdown 已写入文件，stdout 只打印摘要
  }

  // 退出码
  const hasCritical = findings.some(f => f.severity === 'critical' || f.severity === 'major')
  process.exit(hasCritical && strict ? 1 : 0)
}

// Issue#1 fix: 入口守卫——仅直接作为 CLI 运行时执行主流程；被 import（测试/编程复用）不跑。
// Issue#4 fix: pathToFileURL 归一化（跨平台语义正确）——`file://` 手工拼接在 Windows 上产生
//   非法 URL 形态（file://C:\... 反斜杠），与 import.meta.url（file:///C:/...）永不相等，
//   导致 v1.3.1 在 Windows 全形态静默不执行（exit 0 无输出）。
//   pathToFileURL 在 win32 产出 file:///C:/...（正斜杠三斜杠），posix 行为与手工拼接一致。
// argv[1] 仍经 realpathSync 归一化（npm bin symlink，P-006）。
export function isCliEntry(metaUrl, argv1) {
  if (!argv1) return false
  let real
  try { real = realpathSync(argv1) } catch { return false }
  return metaUrl === pathToFileURL(real).href
}
const entryArg = process.argv[1]
if (isCliEntry(import.meta.url, entryArg)) {
  main().catch(err => {
    console.error(`✗ 运行时错误: ${err.message}`)
    process.exit(2)
  })
} else if (entryArg && !process.env.NODE_TEST_CONTEXT) {
  // 守卫不命中且非测试形态：提示而非静默——exit 0 无输出会让入口回归极难发现（Issue#4 教训）
  console.error(`ℹ 未作为 CLI 入口执行（import.meta.url=${import.meta.url}, argv[1]=${entryArg}）。若您直接运行了本文件，请通过 node <本文件> 或安装后的 bin 调用。`)
}
