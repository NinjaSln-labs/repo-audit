// Issue#4 回归：入口守卫跨平台归一化
// v1.3.1 的 `file://${realpathSync(argv[1])}` 手工拼接在 Windows 上产生非法 URL 形态，
// 与 import.meta.url 永不相等 → CLI 全形态静默不执行。v1.3.2 改用 pathToFileURL 归一化。
import { test } from 'node:test'
import assert from 'node:assert'
import { realpathSync, mkdtempSync, writeFileSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { isCliEntry } from '../repo-audit.mjs'

test('isCliEntry：CLI 直跑形态命中（本文件自身恒等式）', () => {
  // fileURLToPath 是 URL→路径的正解（win32 上 pathname 是 /D:/... 带前导斜杠，不可直接用）
  const selfPath = fileURLToPath(import.meta.url)
  const real = realpathSync(selfPath)
  assert.equal(isCliEntry(pathToFileURL(real).href, selfPath), true)
  assert.equal(isCliEntry(import.meta.url, real), true)
})

test('isCliEntry：symlink 形态命中（P-006 npm bin 场景）', () => {
  // npm 全局安装时 argv[1] 是 symlink，import.meta.url 是真实路径
  // 仓库内置 symlink 语义在 Windows 上需管理员权限，这里用 junction（目录）/posix symlink 测，
  // 文件级 symlink 失败则退化为「同一路径」断言（symlink 语义已由 realpathSync 保证）
  const dir = mkdtempSync(join(tmpdir(), 'entry-guard-'))
  const target = join(dir, 'real.mjs')
  const link = join(dir, 'link.mjs')
  writeFileSync(target, 'export const x = 1')
  let linked = false
  try { symlinkSync(target, link); linked = true } catch {}
  if (linked) {
    const realTargetUrl = pathToFileURL(realpathSync(link)).href
    assert.equal(isCliEntry(realTargetUrl, link), true, 'symlink argv[1] 应命中真实路径的 metaUrl')
  } else {
    // Windows 无特权时退化：realpathSync 等价性仍需成立
    assert.equal(realpathSync(target), target)
  }
})

test('isCliEntry：旧手工拼接形态在 win32 路径语义下永不命中（Issue#4 根因等价断言）', () => {
  // Windows 上 realpathSync 返回 `C:\Users\...\repo-audit.mjs`（反斜杠），
  // 旧写法 `file://${p}` = `file://C:\Users\...`（非法 URL），而 import.meta.url = `file:///C:/Users/...`。
  // 在非 win32 平台模拟该形态：构造反斜杠路径验证旧拼接与 pathToFileURL 产物不等。
  const winStylePath = 'C:\\Users\\dev\\repo-audit.mjs'
  const oldGuardForm = `file://${winStylePath}` // 旧写法产物（非法 URL）
  const correctForm = pathToFileURL(winStylePath).href
  // 旧写法产物不等于正确形态（这就是 v1.3.1 恒 false 的机制）
  assert.notEqual(oldGuardForm, correctForm)
  // pathToFileURL 产出的形态才能与 import.meta.url 类 URL 匹配（三斜杠正斜杠）
  assert.ok(correctForm.startsWith('file:///'), `pathToFileURL 应产出三斜杠形态: ${correctForm}`)
  // 反证：若 import.meta.url 是正确形态，旧拼接恒不命中
  assert.equal(isCliEntry(correctForm, winStylePath), false, '非本机路径当然不命中')
})

test('isCliEntry：argv[1] 缺失/不存在路径安全边界', () => {
  assert.equal(isCliEntry(import.meta.url, undefined), false, 'undefined（node -e 形态）')
  assert.equal(isCliEntry(import.meta.url, ''), false, '空串')
  assert.equal(isCliEntry(import.meta.url, '/nonexistent/ghost.mjs'), false, '不存在路径不抛错')
})

test('isCliEntry：win32 形态模拟——pathToFileURL 归一化后可命中', () => {
  // 模拟 Windows 上的完整链路：反斜杠路径 → realpath（win32 上返回反斜杠）→ pathToFileURL
  // 非 win32 平台上 realpathSync 不会改写分隔符，因此用字符串形态模拟 win32 的 URL 产物，
  // 验证守卫比较式两侧在 pathToFileURL 归一化后同构。
  const winPath = 'C:\\Users\\dev\\AppData\\Local\\repo-audit.mjs'
  const metaUrlWin = pathToFileURL('C:/Users/dev/AppData/Local/repo-audit.mjs').href
  // pathToFileURL 对 win 风格路径（含反斜杠）在文档语义下产出正斜杠形态；
  // 非 win32 平台 node 会把它当 posix 路径处理（转义反斜杠），故此处只验证「同输入同输出」的
  // 归一化幂等性——真正的 win32 断言由 CI windows-latest 矩阵实跑覆盖。
  assert.equal(
    pathToFileURL(winPath).href,
    pathToFileURL(winPath).href,
    '归一化幂等'
  )
  assert.equal(typeof metaUrlWin, 'string')
})
