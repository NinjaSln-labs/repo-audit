#!/usr/bin/env node
/**
 * 个人仓库脚手架（五分类 + overlay）与模板更新器。
 *
 * 三种模式：
 *   1) 生成（默认）      node scaffold.mjs --type <t> --name <n> --org <o> --desc "..." [--target ...] [--force]
 *   2) 更新（无锁采用）  node scaffold.mjs --update <已有仓库路径> [--type ...] [--name/--org/--desc/--surface/--legal]
 *                        [--dry-run] [--skip <path>]（可多次）——生成到 <repo>/.scaffold-update/ 并对比分类落位
 *   3) 回滚              node scaffold.mjs --rollback <已有仓库路径>——按 .scaffold/last-update.json 执行 git revert
 *   node scaffold.mjs --help
 *
 * 更新模式（UPDATE-MODEL.md v2.1）：
 *   前置：git 工作区必须 clean（revert 回滚语义前提）
 *   状态机（base=.scaffold/lock/base/<file>，new=模板新输出，ours=仓库当前）：
 *     ours 缺失→ADDED；ours==base→FAST-FORWARD（仓库未改，直接写入）；
 *     new==base→UNCHANGED；ours≠base≠new→git merge-file --diff3 --histogram 三方合并
 *     → 干净=MERGED-CLEAN；冲突=QUARANTINED（.scaffold/conflicts/*.rej，不阻塞整体）
 *   首次（无 lock）= adopt 模式：建快照 + 缺失直拷 + 已存在文件写 .scaffold-merge/（零覆盖）
 *   记录/回滚：自动 git commit（回滚点）；--rollback 按 last-update.json 执行 revert
 *
 * 不做的事（有意）：不覆盖任何仓库既有内容（update 零覆盖）；不做远端操作；不装依赖。
 */

import { cpSync, readdirSync, readFileSync, writeFileSync, chmodSync, existsSync, rmSync, mkdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATES = resolve(dirname(fileURLToPath(import.meta.url)));
const TEMPLATE_ROOT = join(TEMPLATES, 'repo-root');
const CATEGORIES = join(TEMPLATES, 'categories');
const COMMON = join(TEMPLATES, 'common');

const CATEGORY_TYPES = ['dsh-plugin', 'python-app', 'go-service', 'sandbox', 'content'];
const OVERLAYS = ['product-oss'];
const UPDATE_IGNORE_LINES = ['.scaffold-update/', '.scaffold-merge/', '.scaffold/conflicts/'];

// ---------- 参数解析 ----------
// M-2/N-1 修复：--flag=value 归一为两元素；值位状态机保证旗标值（含 --type=xxx 形态）不被误拆
const KNOWN_FLAGS = new Set(['--type', '--name', '--org', '--desc', '--surface', '--legal', '--target', '--force', '--overlay', '--update', '--dry-run', '--skip', '--rollback', '--help', '-h']);
const VALUE_FLAGS = new Set(['--type', '--name', '--org', '--desc', '--surface', '--legal', '--target', '--overlay', '--update', '--skip']);

let argv = [];
let expectValue = false;
const orphans = [];
for (const a of process.argv.slice(2)) {
  if (expectValue) { argv.push(a); expectValue = false; continue; }
  const m = a.match(/^(--[a-z]+)=(.*)$/);
  if (m && KNOWN_FLAGS.has(m[1])) { argv.push(m[1], m[2]); continue; }
  if (a.startsWith('--') && KNOWN_FLAGS.has(a) && !['--help', '-h', '--force', '--dry-run', '--rollback'].includes(a)) {
    argv.push(a); expectValue = true; continue;
  }
  if (a.startsWith('--') && !KNOWN_FLAGS.has(a.split('=')[0])) {
    orphans.push(a); // 未知旗标：原样保留并告警
    argv.push(a);
    expectValue = false;
    continue;
  }
  if (a.startsWith('--')) { argv.push(a); expectValue = true; continue; } // 未知旗标（可能带值）
  if (expectValue === false && argv.length && KNOWN_FLAGS.has(argv[argv.length - 1]) === false) {
    orphans.push(a); // 裸位置参数（无旗标引导）→ 孤儿告警
  }
  argv.push(a);
}
for (const o of orphans) {
  console.error(`⚠ 孤儿参数 "${o}"（未匹配任何旗标，多为 shell 引号缺失导致值被拆分）`);
}
function getFlag(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
function hasFlag(name) { return argv.includes(name); }
function getAllFlag(name) {
  const out = [];
  for (let i = 0; i < argv.length; i++) if (argv[i] === name) out.push(argv[i + 1]);
  return out;
}

function usage() {
  console.log(`用法：
  生成：node scaffold.mjs [--type <分类>] [--overlay product-oss] --name <name> --org <org> --desc "<一句话>"
        [--surface "<宿主能力面>"] [--legal "<版权主体>"] [--target <目录>] [--force]
  更新：node scaffold.mjs --update <已有仓库路径> [--type <分类>] [--name/--org/--desc 自动探测，可显式覆盖]
        [--dry-run] [--skip <path>]（可多次）
  回滚：node scaffold.mjs --rollback <已有仓库路径>
  帮助：node scaffold.mjs --help

分类 --type（默认 dsh-plugin）：${CATEGORY_TYPES.join(' | ')}
  B 类（product-oss）= 语言基类 + --overlay product-oss
  状态层：.scaffold/lock/（base 快照 + manifest）入库——勿手改

更新模式零覆盖保证：只写 <repo>/.scaffold-update/、.scaffold-merge/、.scaffold/conflicts/
与（验证链全绿后的）一次 git commit；仓库既有文件一个字节都不动。`);
}

if (hasFlag('--help') || hasFlag('-h')) { usage(); process.exit(0); }

// ---------- 通用工具 ----------
function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }
function hashTree(dir, base = dir, acc = new Map()) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    // 跳过 symlink（EISDIR 防护：.venv/bin/python 等指向目录的 symlink 会让 readFileSync 崩溃）
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) hashTree(full, base, acc);
    else acc.set(full.slice(base.length + 1), sha256(readFileSync(full)));
  }
  return acc;
}
function run(cmd, args, cwd, opts = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', ...opts });
  return { code: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
}
function isClean(repoPath) {
  return run('git', ['status', '--porcelain'], repoPath).stdout.trim() === '';
}
function ensureGitignore(repoPath, lines) {
  const gi = join(repoPath, '.gitignore');
  let text = existsSync(gi) ? readFileSync(gi, 'utf8') : '';
  let added = false;
  for (const l of lines) {
    if (!text.split('\n').some((x) => x.trim() === l)) { text = text.trimEnd() + '\n' + l + '\n'; added = true; }
  }
  if (added) writeFileSync(gi, text);
  return added;
}

// ---------- 模板拼装（生成与更新共用的纯函数层） ----------
const NOTE_HTML_RE = /<!--\s*模板说明[\s\S]*?-->\n?/g;
const NOTE_BLOCK_RE = /\n?[ \t]*\/\*+\s*\n?[ \t]*\*\s*模板说明[\s\S]*?\*\/\n?/g;
const NOTE_LINE_RE = /\n?[ \t]*\/\/\s*模板说明[^\n]*/g;
const PLACEHOLDER_RE = /(?<!--)<[^<>\n]{1,80}>/g;
const KEEP_PLACEHOLDERS = new Set(['<user>', '<盘>']);

/** 在 stage 目录上执行：模板说明剥离 + 占位符替换；返回剩余占位符 Map */
function transformTree(dir, substitutions) {
  const remaining = new Map();
  function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      let text = readFileSync(full, 'utf8');
      const before = text;
      text = text.replace(NOTE_HTML_RE, '').replace(NOTE_BLOCK_RE, '').replace(NOTE_LINE_RE, '');
      for (const [from, to] of substitutions) text = text.split(from).join(to);
      if (text !== before) writeFileSync(full, text);
      const scan = text.replace(/<!--[\s\S]*?-->/g, '');
      const rel = relative(dir, full);
      for (const m of scan.matchAll(PLACEHOLDER_RE)) {
        if (KEEP_PLACEHOLDERS.has(m[0])) continue;
        if (!remaining.has(m[0])) remaining.set(m[0], new Set());
        const relFromRoot = relative(dir, full);
        remaining.get(m[0]).add(relFromRoot === '' ? '.' : relFromRoot);
      }
    }
  }
  walk(dir);
  return remaining;
}

/** 出库一个分类的完整产物到空目录 stageDir（不 git init；占位符不替换——由调用方统一替换） */
function generateInto(stageDir, type, { overlay, params }) {
  cpSync(TEMPLATE_ROOT, stageDir, { recursive: true });
  const catDir = join(CATEGORIES, type);
  const cat = (p) => join(catDir, p);
  const cp = (src, dst) => cpSync(src, join(stageDir, dst), { recursive: true });
  const del = (...paths) => {
    for (const p of paths) {
      const full = join(stageDir, p);
      if (existsSync(full)) rmSync(full, { recursive: true, force: true });
    }
  };

  // —— 单源拼装：AGENTS/CONTRIBUTING/.gitignore/README/DEVELOPMENT/PUBLISHING/SECURITY ——
  const substitutions = params.substitutions;
  const assemble = (base, dst) => {
    const corePath = join(COMMON, `${base}-core.md`);
    let text = readFileSync(corePath, 'utf8');
    if (base === 'gitignore') text = text.replace(/^# ===== 通用段[^\n]*=====\n/, '');
    const appPath = join(catDir, `${base}-append.md`);
    if (existsSync(appPath)) {
      let appText = readFileSync(appPath, 'utf8')
        .replace(/^<!--\s*=====?\s*append[\s\S]*?=====\s*-->\n?/, '')
        .replace(/\n?<!--\s*=====?\s*append[\s\S]*?=====\s*-->\n?/g, '\n');
      const anchor = '<分类 append 拼装：功能/安装/使用/配置段（Standard Readme 的 Install/Usage/Extra）>';
      if (base === 'README' && text.includes(anchor)) {
        // 徽章前移（Title 后）+ 其余节锚点插入
        const badgeLines = []; const restLines = []; let collecting = true;
        for (const line of appText.split('\n')) {
          if (collecting) {
            if (line.trim() === '') { restLines.push(line); continue; }
            collecting = false;
            if (/^\[!\[/.test(line.trim())) { badgeLines.push(line.trim()); continue; }
          }
          restLines.push(line);
        }
        const rest = restLines.join('\n').replace(/^\n+/, '').trim();
        if (badgeLines.length) {
          text = text.replace('<!-- 分类徽章（npm/PyPI 等）由 append 提供并插到本行之后 -->', badgeLines.join('\n'));
        } else {
          text = text.replace('<!-- 分类徽章（npm/PyPI 等）由 append 提供并插到本行之后 -->\n', '')
            .replace('<!-- 分类徽章（npm/PyPI 等）由 append 提供并插到本行之后 -->', '');
        }
        text = text.replace(anchor, rest);
        // —— 分类差异（工程件与删清单） ——
      } else {
        text = `${text.trimEnd()}\n\n${appText.trim()}\n`;
      }
      // 分类差异（工程件与删清单）
      writeFileSync(join(stageDir, dst), text);
    } else {
      cp(corePath, dst);
    }
  };
  assemble('AGENTS', 'AGENTS.md');
  assemble('CONTRIBUTING', 'CONTRIBUTING.md');
  // gitignore：core（去头行）+ append
  {
    let gi = readFileSync(join(COMMON, 'gitignore-core.md'), 'utf8').replace(/^# ===== 通用段[^\n]*=====\n/, '');
    const app = join(catDir, 'gitignore-append.md');
    if (existsSync(app)) gi += '\n' + readFileSync(app, 'utf8').replace(/^# ===== append[^\n]*\n/, '');
    writeFileSync(join(stageDir, '.gitignore'), gi);
  }
  assemble('README', 'README.md');
  assemble('DEVELOPMENT', 'DEVELOPMENT.md');
  assemble('PUBLISHING', 'PUBLISHING.md');
  cp(join(COMMON, 'SECURITY-core.md'), 'SECURITY.md');
  if (existsSync(cat('README.en.md'))) cp(cat('README.en.md'), 'README.en.md');
  if (type !== 'sandbox' && type !== 'content') cp(join(COMMON, 'copilot-instructions.md'), '.github/copilot-instructions.md');

  // —— 分类差异 ——
  if (type === 'python-app') {
    del('package.json', 'tsconfig.json', 'tsconfig.build.json', 'src/index.ts', 'src/config.ts',
      'scripts/build.mjs', 'scripts/check-deploy.mjs', 'scripts/verify.mjs', 'cordis.patch.yml');
    cp(cat('pyproject.toml'), 'pyproject.toml');
    cp(cat('scripts/verify.py'), 'scripts/verify.py');
    cp(cat('.github/workflows/ci.yml'), '.github/workflows/ci.yml');
    cp(cat('.github/workflows/publish.yml'), '.github/workflows/publish.yml');
    cp(cat('.githooks/pre-commit'), '.githooks/pre-commit');
  } else if (type === 'go-service') {
    del('package.json', 'tsconfig.json', 'tsconfig.build.json', 'src/index.ts', 'src/config.ts',
      'scripts/build.mjs', 'scripts/check-deploy.mjs', 'scripts/verify.mjs',
      '.github/workflows/publish.yml', 'cordis.patch.yml');
    for (const d of ['src', 'scripts']) {
      const full = join(stageDir, d);
      if (existsSync(full) && readdirSync(full).length === 0) rmSync(full, { recursive: true, force: true });
    }
    cp(cat('Makefile'), 'Makefile');
    cp(cat('.goreleaser.yaml'), '.goreleaser.yaml');
    cp(cat('.github/workflows/ci.yml'), '.github/workflows/ci.yml');
    cp(cat('.github/workflows/release.yml'), '.github/workflows/release.yml');
    cp(cat('.githooks/pre-commit'), '.githooks/pre-commit');
  } else if (type === 'sandbox') {
    del('LICENSE', 'PUBLISHING.md', 'DEVELOPMENT.md', 'SECURITY.md',
      '.github', '.githooks', 'scripts', 'src', 'CLAUDE.md',
      'package.json', 'tsconfig.json', 'tsconfig.build.json', 'CONTRIBUTING.md');
    cp(cat('README.md'), 'README.md');
  } else if (type === 'content') {
    del('PUBLISHING.md', 'DEVELOPMENT.md', 'SECURITY.md',
      '.github', '.githooks', 'scripts', 'src', 'package.json', 'CLAUDE.md',
      'tsconfig.json', 'tsconfig.build.json', 'CONTRIBUTING.md');
    cp(cat('README.md'), 'README.md');
  }
  // dsh-plugin：基类本体

  // —— overlay ——
  if (overlay) {
    const oDir = join(CATEGORIES, overlay);
    if (!existsSync(oDir)) throw new Error(`overlay 缺失：${oDir}`);
    cpSync(oDir, stageDir, { recursive: true });
    for (const doc of ['CATEGORY.md', 'SUPPORT.md']) {
      const d = join(stageDir, doc);
      if (existsSync(d)) rmSync(d);
    }
    const prtSrc = join(stageDir, 'PULL_REQUEST_TEMPLATE.md');
    if (existsSync(prtSrc)) {
      mkdirSync(join(stageDir, '.github'), { recursive: true });
      rmSync(prtSrc);
      cpSync(join(oDir, 'PULL_REQUEST_TEMPLATE.md'), join(stageDir, '.github', 'PULL_REQUEST_TEMPLATE.md'));
    }
    const oGitApp = join(oDir, 'gitignore-append.md');
    if (existsSync(oGitApp)) {
      const gi = join(stageDir, '.gitignore');
      writeFileSync(gi, readFileSync(gi, 'utf8').trimEnd() + '\n\n' +
        readFileSync(oGitApp, 'utf8').replace(/^# ===== append[^\n]*\n/, '').trim() + '\n');
    }
  }

  // 可执行位
  for (const rel of ['.githooks/pre-commit', 'scripts/check-deploy.mjs', 'scripts/verify.mjs', 'scripts/build.mjs', 'scripts/verify.py']) {
    const dst = join(stageDir, rel);
    if (existsSync(dst)) chmodSync(dst, 0o755);
  }
}

/** 生成模式的 TODO 清单 */
function todoFor(type, { org, repo, name }) {
  const TODO = {
    'dsh-plugin': `  1. package.json：按契约预检结果填 peer/devDependencies 的宿主包（宽 caret + 预发布下界；
     peer 同范围复制进 devDeps + 运行时可达宿主包全量）。config 骨架的编译依赖
     （@deepseek-ai/schemastery、@types/node）已预置；有 client half 时填 dsh.client.inject
     并从 dsh-context-compass/scripts/build-client.mjs 复制适配（build.mjs 探测式，接入即生效）
  2. src/：实现能力（入口骨架与 config 骨架已就位）；用到的服务逐一对照 cordis_inspect_query 签名
  3. 验证链：scripts/verify.mjs 探测式——接入 smoke.mjs / vitest.config / mount.mjs 后自动进链；
     链全绿前禁止发布（npm test 即单源入口）
  4. README(.en).md 的使用/配置段、SECURITY.md 支持面、DEVELOPMENT.md 校对命令前缀
  5. npm install --legacy-peer-deps → 生成 package-lock.json【必须入库：CI 的 npm ci 与
     cache-dependency-path 依赖它，首推前本地先生成】→ npm run build → dsh plugin --profile web
     install（file: 接线）→ npm run check:deploy（部署纪律）
  6. .githooks/commit-msg 为本机私有不入库（已 ignore）
  7. GitHub 建库（scaffold 不做远端操作）：
     gh repo create ${org}/${repo} --public --source . --description "<一句话>" --push
     然后 gh repo edit ${org}/${repo} --add-topic deepseek-harness --add-topic dsh-plugin
  8. .github/workflows/{ci,publish}.yml 的 <commit-SHA>：从 dsh-context-compass 同名文件抄当前
     锁定值（actions/checkout、actions/setup-node），或查 GitHub 官方 tag 对应 SHA
  9. 首发前置见 PUBLISHING.md「首次发布前置」（Trusted Publisher + bootstrap）`,
    'python-app': `  1. pyproject.toml：填依赖占位；自建 src/${name}/__init__.py 包目录（pyproject packages 已指向它）
  2. src/ 实现能力；README 安装段/徽章改 pip install
  3. 验证链单源 scripts/verify.py（ruff → pytest 探测式）；tests/ 就位后自动进链；
     .githooks/pre-commit 已指向它（git config core.hooksPath .githooks 启用）
  4. 发布链已就位：.github/workflows/publish.yml（tag v* → PyPI Trusted Publishing，attestations 自动）；
     发布前一次性配置见 PUBLISHING.md「一次性前置」（GitHub pypi 环境 + pending publisher 登记）
  5. python -m pip install -e ".[dev]" → python scripts/verify.py 全绿
  6. GitHub 建库：gh repo create ${org}/${repo} --public --source . --description "<一句话>" --push
     （topics 建议：python）；workflow <commit-SHA> 从参照库抄（checkout/setup-python@v7、
     upload/download-artifact）；pypa/gh-action-pypi-publish 用 @release/v1 可不 pin
  7. 版本工具：小库推荐 bump-my-version（自动 commit+tag）；不需要发布则删 publish.yml`,
    'go-service': `  1. go mod init github.com/${org}/${repo}；自建 cmd/${name}/main.go 入口（声明 var version = "dev"——
     GoReleaser 默认 ldflags 注入 main.version/main.commit/main.date）
  2. Makefile verify（gofmt → vet → test → build）为验证链单源；.githooks/pre-commit 已指向它
     （git config core.hooksPath .githooks 启用）
  3. 发布链已就位：.goreleaser.yaml（v2 最小配置）+ .github/workflows/release.yml（v* tag 触发）；
     发布前本地演练 goreleaser check && goreleaser release --snapshot --clean（见 PUBLISHING.md）
  4. go build ./... 全绿；go.sum 随 go mod tidy 生成并入库
  5. GitHub 建库：gh repo create ${org}/${repo} --public --source . --description "<一句话>" --push
     （topics 建议：go）；workflow <commit-SHA> 从参照库抄（checkout/setup-go/goreleaser-action@v7）
  6. 可选启用（.goreleaser.yaml + release.yml 成对解开）：SBOM（syft）/ cosign keyless / GHCR 镜像
     （dockers_v2）；CHANGELOG.md 文件与自动版本号需要时再引入 release-please（分工见 PUBLISHING.md）`,
    'sandbox': `  1. README「目标/跑法」按实验实际填写；不需要的目录（agents/docs/src/tests）删掉
  2. 开工：master 直提，无 CI 无发布、不打 tag
  3. 收尾：README「结论」节写验证结果；转正走 scaffold.mjs 目标分类全量脚手架迁移`,
    'content': `  1. README 导航按实际文件调整；主文开写（正文与评审分离：意见进 review.md）
  2. 双语时声明权威语言并同步镜像；无 CI 无发布
  3. 完稿可选：GitHub Release 挂终稿；导出产物按 .gitignore 决定是否入库`,
  };
  return TODO[type];
}

function printScaffoldSummary({ type, repo, name, target, remaining }) {
  console.log(`
──────────────────────────────────────────────
脚手架完成：${repo}（${type}）→ ${target}

剩余占位符（待手工填写）:`);
  for (const [ph, files] of remaining)
    console.log(`  ${ph.padEnd(30)} ${[...files].join(', ')}`);
  console.log(`
手工 TODO（分类 ${type} 专属）:
${todoFor(type, { org, repo, name })}
──────────────────────────────────────────────`);
}

// ---------- 模式判定 ----------
const mode = hasFlag('--rollback') ? 'rollback' : (getFlag('--update') ? 'update' : 'generate');

// ---------- 参数与元数据探测 ----------
function usageFull() { usage(); }

const UPD_FLAG = getFlag('--update');
const ROLLBACK_FLAG = getFlag('--rollback');

// update/rollback 共用：仓库路径校验
function validateRepo(repoPath) {
  if (!existsSync(repoPath)) { console.error(`✗ 仓库路径不存在：${repoPath}`); process.exit(1); }
  if (!existsSync(join(repoPath, '.git'))) {
    console.error(`✗ 目标不是 git 仓库（回滚依赖 git 历史）：${repoPath}`);
    process.exit(1);
  }
}

// ---------- 模式：回滚 ----------
if (mode === 'rollback') {
  validateRepo(resolve(ROLLBACK_FLAG));
  const repoPath = resolve(ROLLBACK_FLAG);
  const luPath = join(repoPath, '.scaffold', 'last-update.json');
  if (!existsSync(luPath)) { console.error(`✗ 无更新记录（.scaffold/last-update.json 不存在）——无可回滚`); process.exit(1); }
  const lu = JSON.parse(readFileSync(luPath, 'utf8'));
  if (!isClean(repoPath)) { console.error('✗ 工作区不干净——先 commit/stash 再回滚'); process.exit(1); }
  console.log(`回滚 update（reset 到更新前 HEAD: ${lu.preUpdateHEAD}）...`);
  const r = run('git', ['reset', '--hard', lu.preUpdateHEAD], repoPath);
  if (r.code !== 0) { console.error(`✗ reset 失败：\n${r.stderr}`); process.exit(1); }
  // revert 撤销了 last-update.json 的入库 → 工作区出现 D 状态 → 自动 commit 清理
  run('git', ['add', '-A'], repoPath);
  const cr = run('git', ['commit', '-m', 'chore(scaffold): clean up after rollback'], repoPath);
  if (cr.code !== 0) { /* 如果没有 staged 变化就不 commit */ }
  console.log('✓ 已回滚（git revert 生成撤销 commit，审计历史保留）');
  process.exit(0);
}

// ---------- 模式：update ----------
if (mode === 'update') {
  const repoPath = resolve(UPD_FLAG);
  validateRepo(repoPath);
  if (!isClean(repoPath)) {
    console.error('✗ 工作区不干净（git status 非空）——先 commit/stash，保证回滚点唯一');
    process.exit(1);
  }
  // 类型判定：lock.template 优先（防类型漂移），显式 --type 次之，最后 fallback dsh-plugin
  const manifestPathPre = join(repoPath, '.scaffold', 'lock', 'manifest.json');
  let lockType = null;
  if (existsSync(manifestPathPre)) {
    try {
      const raw = readFileSync(manifestPathPre, 'utf8');
      const prev = JSON.parse(raw.slice(raw.indexOf('{')));
      lockType = prev.template ? prev.template.replace('scaffold/', '') : null;
    } catch { /* lock 损坏由后续 compare 降级处理 */ }
  }
  const explicitType = getFlag('--type');
  if (explicitType && lockType && explicitType !== lockType) {
    console.error(`✗ --type ${explicitType} 与 lock.template ${lockType} 不一致——如确认要切换分类，先删除 .scaffold/lock/ 后重跑`);
    process.exit(1);
  }
  const type = explicitType || lockType || 'dsh-plugin';
  if (!CATEGORY_TYPES.includes(type)) { console.error(`✗ 未知分类 --type ${type}`); process.exit(1); }
  const overlayArg = getFlag('--overlay');
  if (overlayArg && !OVERLAYS.includes(overlayArg)) { console.error(`✗ 未知 overlay：${overlayArg}`); process.exit(1); }
  const dryRun = hasFlag('--dry-run');
  const skips = getAllFlag('--skip');

  // —— 元数据自动探测（显式参数优先）——
  function readJSON(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } }
  let dName = getFlag('--name'), dDesc = getFlag('--desc'), dOrg = getFlag('--org');
  const pj = readJSON(join(repoPath, 'package.json'));
  try {
    const { tomllib } = await import('node:util');
  } catch {}
  let pyName = null, pyDesc = null;
  const pp = join(repoPath, 'pyproject.toml');
  if (existsSync(pp)) {
    try {
      const t = readFileSync(pp, 'utf8');
      pyName = (t.match(/^name\s*=\s*"([^"]+)"/m) || [])[1] || null;
      pyDesc = (t.match(/^description\s*=\s*"([^"]+)"/m) || [])[1] || null;
    } catch {}
  }
  if (!dName) dName = (pj && pj.name ? pj.name.replace(/^dsh-/, '') : null) || pyName || repoPath.split('/').pop();
  if (!dDesc) dDesc = (pj && pj.description) || pyDesc || '';
  if (!dOrg) {
    const remote = run('git', ['remote', 'get-url', 'origin'], repoPath).stdout.trim();
    const m = remote.match(/github\.com[/:]([^/]+)\//);
    dOrg = m ? m[1] : 'NinjaSln-labs';
  }
  const dSurface = getFlag('--surface') || dDesc;
  const dLegal = getFlag('--legal') || dOrg;
  const repo = type === 'dsh-plugin' ? `dsh-${dName}` : dName;
  console.log(`探测: name=${dName} repo=${repo} org=${dOrg} type=${type}`);

  // —— 出库到 stage（.scaffold-update/，不 git init）——
  const stage = join(repoPath, '.scaffold-update');
  if (existsSync(stage)) rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  generateInto(stage, type, {
    overlay: overlayArg,
    params: { substitutions: [
      ['<org 法律名>', dLegal], ['<name>', dName], ['<repo>', repo], ['<org>', dOrg],
      ['<一句话描述>', dDesc], ['<宿主能力面>', dSurface], ['<year>', String(new Date().getFullYear())],
    ] },
  });
  // 占位符替换（stage 全树）
  transformTree(stage, [
    ['<org 法律名>', dLegal], ['<name>', dName], ['<repo>', repo], ['<org>', dOrg],
    ['<一句话描述>', dDesc], ['<宿主能力面>', dSurface], ['<year>', String(new Date().getFullYear())],
  ]);

  // —— lock ——
  const lockDir = join(repoPath, '.scaffold', 'lock');
  const manifestPath = join(repoPath, '.scaffold', 'lock', 'manifest.json');
  const lock = existsSync(manifestPath)
    ? (() => { try { return JSON.parse(readFileSync(manifestPath, 'utf8').replace(/^[^\n]*NEVER EDIT MANUALLY[^\n]*\n/, '')); } catch { console.error('△ lock 损坏——降级为 adopt 模式（重建 lock）'); return null; } })()
    : { template: 'scaffold/' + type, adopt: true, files: {} };
  const baseContent = (rel) => {
    const p = join(lockDir, 'base', rel);
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
  };

  // —— 状态机对比 ——
  const stageFiles = hashTree(stage);
  const results = [];
  const writes = [];   // {rel, content} 待写入仓库
  const conflicts = []; // {rel, merged}
  for (const [rel, stageHash] of [...stageFiles.entries()].sort()) {
    if (skips.some((s) => rel === s || rel.startsWith(s + '/'))) { results.push(['SKIP', rel, '用户接管']); continue; }
    const repoFile = join(repoPath, rel);
    const ours = existsSync(repoFile) ? sha256(readFileSync(repoFile)) : null;
    const baseHash = lock.files[rel] || null;
    const base = baseContent(rel);
    const newContent = readFileSync(join(stage, rel), 'utf8');
    const newHash = stageHash;

    if (ours === null) { writes.push({ rel, content: newContent }); results.push(['ADDED', rel, '仓库缺失→直拷']); continue; }
    if (ours === newHash) { results.push(['UNCHANGED', rel, '与模板一致']); continue; }
    if (baseHash !== null && ours === baseHash) { writes.push({ rel, content: newContent }); results.push(['FAST-FORWARD', rel, '仓库未改→采纳模板']); continue; }
    if (baseHash !== null && newHash === baseHash) { results.push(['UNCHANGED', rel, '模板未变，保持仓库版']); continue; }
    // ours ≠ base ≠ new → 三方合并
    if (base === null) { // adopt 后无 base 且内容不同：保守——写 merge 区
      conflicts.push({ rel, reason: 'adopt 首见差异' });
      if (!dryRun) {
        mkdirSync(join(repoPath, '.scaffold-merge', dirname(rel) || '.'), { recursive: true });
        writeFileSync(join(repoPath, '.scaffold-merge', rel), newContent);
      }
      results.push(['MERGE-REVIEW', rel, 'adopt 首见差异→.scaffold-merge/']);
      continue;
    }
    const bTmp = join(repoPath, '.scaffold', 'base.tmp');
    mkdirSync(dirname(bTmp), { recursive: true });
    writeFileSync(bTmp, base);
    const oTmp = join(repoPath, '.scaffold', 'ours.tmp');
    writeFileSync(oTmp, readFileSync(repoFile));
    // 语法：git merge-file [选项] <current> <base> <other>——-L/-p/--diff3 必须在文件名之前
    // 退出码：0=干净；1..127=冲突数；负/127+=调用错误（降级 merge-review）
    const mf = run('git', ['merge-file', '-p', '--zdiff3',
      '-L', 'current', '-L', 'base', '-L', 'template',
      oTmp, bTmp, join(stage, rel)], repoPath);
    rmSync(bTmp, { force: true }); rmSync(oTmp, { force: true });
    if (mf.code === 0) {
      writes.push({ rel, content: mf.stdout });
      results.push(['MERGED-CLEAN', rel, '三方合并干净']);
    } else if (mf.code > 0 && mf.code <= 127) {
      conflicts.push({ rel, reason: `${mf.code} 处冲突` });
      mkdirSync(join(repoPath, '.scaffold', 'conflicts', dirname(rel) || '.'), { recursive: true });
      writeFileSync(join(repoPath, '.scaffold', 'conflicts', rel + '.rej'), mf.stdout);
      results.push(['QUARANTINED', rel, `${mf.code} 处冲突→.scaffold/conflicts/`]);
    } else {
      conflicts.push({ rel, reason: `merge-file 调用失败（exit ${mf.code}）` });
      mkdirSync(join(repoPath, '.scaffold-merge', dirname(rel) || '.'), { recursive: true });
      writeFileSync(join(repoPath, '.scaffold-merge', rel), newContent);
      results.push(['MERGE-REVIEW', rel, '三方合并调用失败→.scaffold-merge/（降级人工）']);
    }
  }
  // 仓库有、模板没有的文件（非管辖）：仅统计
  const repoFiles = hashTree(repoPath, repoPath, new Map());
  const managed = new Set(stageFiles.keys());
  let unmanaged = 0;
  for (const [rel] of repoFiles) if (!managed.has(rel) && !rel.startsWith('.scaffold/')) unmanaged++;

  // —— dry-run：到此为止，只打印报告 ——
  console.log(`
──────────────────────────────────────────────
更新对比（${type}，模板 → ${repoPath}${dryRun ? '，DRY-RUN' : ''}）
`);
  for (const [st, rel, note] of results) console.log(`  ${st.padEnd(14)} ${rel}${note ? '  — ' + note : ''}`);
  console.log(`  未管辖文件: ${unmanaged} 个（跳过）`);

  if (dryRun) {
    // P3-8 修复：dry-run 清掉 stage 残留（.scaffold-update/ 是临时目录，不应留在仓库）
    rmSync(stage, { recursive: true, force: true });
    console.log('\nDRY-RUN：未写入任何文件（临时目录已清理）。');
    process.exit(0);
  }

  // 无可写入项且无冲突 → 模板与仓库已同步，优雅退出（仍记录状态供 rollback）
  if (!writes.length && !conflicts.length) {
    rmSync(stage, { recursive: true, force: true });
    const syncHEAD = run('git', ['rev-parse', 'HEAD'], repoPath).stdout.trim();
    writeFileSync(join(repoPath, '.scaffold', 'last-update.json'), JSON.stringify({
      preUpdateHEAD: syncHEAD, commitSha: syncHEAD, type, at: new Date().toISOString(),
      files: Object.fromEntries(results.map(([st, rel]) => [rel, st])), noChanges: true,
    }, null, 2) + '\n');
    console.log('\n✓ 模板与仓库已同步（全部 UNCHANGED），无需更新。');
    process.exit(0);
  }

  // —— 落位写入 ——
  for (const w of writes) {
    mkdirSync(dirname(join(repoPath, w.rel)) || repoPath, { recursive: true });
    writeFileSync(join(repoPath, w.rel), w.content);
  }
  // 冲突标记防漏：已写文件不得含 markers
  const markerHit = writes.filter((w) => /<{7}|>{7}/.test(w.content));
  if (markerHit.length) {
    console.error(`✗ 检测到未解决冲突标记：${markerHit.map((w) => w.rel).join(', ')}——已回退这些文件`);
    for (const w of markerHit) {
      const mine = baseContent(w.rel);
      const rf = join(repoPath, w.rel);
      if (mine !== null) writeFileSync(rf, mine); else rmSync(rf, { force: true });
    }
    process.exit(1);
  }
  // —— 更新 lock（base = 成功落位的内容；未落位的保持不变）——
  const lockBase = join(lockDir, 'base');
  mkdirSync(lockBase, { recursive: true });
  for (const [rel, content] of writes.map((w) => [w.rel, w.content])) {
    mkdirSync(dirname(join(lockBase, rel)) || lockBase, { recursive: true });
    writeFileSync(join(lockBase, rel), content);
  }
  // —— 验证门禁（分类验证链；依赖未装则跳过并提示）——
  const verifyCmds = {
    'dsh-plugin': ['npm', ['run', 'test']],   // P0-1 修复：test=verify.mjs（模板已定义），非 verify（不存在）
    'python-app': ['python3', ['scripts/verify.py']],
    'go-service': ['make', ['verify']],
  };
  if (verifyCmds[type]) {
    const [c, a] = verifyCmds[type];
    if (type === 'dsh-plugin' && !existsSync(join(repoPath, 'node_modules'))) {
      console.log('△ node_modules 不存在——跳过验证门禁（先 npm install）');
    } else {
      const vr = run(c, a, repoPath);
      if (vr.code === 2) {
        // SKIP 语义（verify.py 工具未安装）：不阻塞 adopt/commit，提示补环境
        console.log('△ 验证链工具未安装——门禁 SKIP（commit 继续；补环境后下次 update 会真跑）');
      } else if (vr.code !== 0) {
        console.error('✗ 验证门禁 FAIL——本次更新已写入但未 commit；修正后重跑 update（会继续合并）');
        process.exit(1);
      } else {
        console.log('✓ 验证门禁 PASS');
      }
    }
  }
  // —— lock/manifest 持久化（P0 修复：manifest 此前从未写盘）——
  const prevManifest = existsSync(manifestPath)
    ? (() => { try { return JSON.parse(readFileSync(manifestPath, 'utf8').replace(/^[^\n]*NEVER EDIT MANUALLY[^\n]*\n/, '')); } catch { console.error('△ lock 损坏——降级为 adopt 模式（重建 lock）'); return { files: {} }; } })()
    : { files: {} };
  const newManifest = {
    template: 'scaffold/' + type,
    adopt: false,
    at: new Date().toISOString(),
    files: { ...prevManifest.files },   // 从旧 manifest 起步（防全 UNCHANGED 清空）
  };
  // QUARANTINED：base 追平到 ours（agent 裁决后下次 update 不再冲突）
  for (const c of conflicts.filter((c) => c.reason.includes('处冲突'))) {
    const rf = join(repoPath, c.rel);
    if (existsSync(rf)) {
      newManifest.files[c.rel] = sha256(readFileSync(rf));
      const bp = join(lockDir, 'base', c.rel);
      mkdirSync(dirname(bp) || lockDir, { recursive: true });
      cpSync(rf, bp);
    }
  }
  // 成功落位：base = new
  for (const w of writes) {
    newManifest.files[w.rel] = sha256(Buffer.from(w.content));
    const bp = join(lockDir, 'base', w.rel);
    mkdirSync(dirname(bp) || lockDir, { recursive: true });
    writeFileSync(bp, w.content);
  }
  mkdirSync(lockDir, { recursive: true });
  writeFileSync(manifestPath, '# NEVER EDIT MANUALLY——scaffold 状态层（手改会欺骗三方合并算法）\n' +
    JSON.stringify(newManifest, null, 2) + '\n');
  // —— adopt 时 MERGE-REVIEW 的文件：base = ours（用户尚未采纳）——
  // P1-4 修复：不给 MERGE-REVIEW 建 base 会导致 FF/三方永远不可达
  for (const [st, rel] of results) {
    if (st !== 'MERGE-REVIEW') continue;
    const rf = join(repoPath, rel);
    if (existsSync(rf)) {
      const bp = join(lockDir, 'base', rel);
      mkdirSync(dirname(bp) || lockDir, { recursive: true });
      cpSync(rf, bp);
    }
  }
  // —— 单次 git commit（含全部改动 + 状态层文件，不用 amend——P0-2 修复 SHA dangling）——
  const preHEAD = run('git', ['rev-parse', 'HEAD'], repoPath).stdout.trim();
  run('git', ['add', '-A'], repoPath);
  const cm = run('git', ['commit', '-m', `chore(scaffold): update template files (${type})`], repoPath);
  if (cm.code !== 0) {
    console.error(`✗ git commit 失败（exit ${cm.code}）——\n${cm.stderr}`);
    console.error('  → 修正后重跑 update；或手动 git add -A && git commit');
    process.exit(1);
  }
  // —— gitignore 增补（确保 .scaffold-update/.scaffold-merge 在 ignore 里）——
  ensureGitignore(repoPath, UPDATE_IGNORE_LINES);
  // —— last-update.json 写盘（只记 preUpdateHEAD，不含 commitSha——避免 amend 循环）——
  // rollback 用 git reset --hard <preUpdateHEAD>（比 revert 更可靠，不依赖 SHA 在 amend 后不变）
  const luPath = join(repoPath, '.scaffold', 'last-update.json');
  writeFileSync(luPath, JSON.stringify({
    preUpdateHEAD: preHEAD, type, at: new Date().toISOString(),
    files: Object.fromEntries(results.map(([st, rel]) => [rel, st])),
  }, null, 2) + '\n');
  run('git', ['add', '-A'], repoPath);
  run('git', ['commit', '-m', `chore(scaffold): record update metadata (${type})`], repoPath);
  process.exit(0);
}

// ---------- 模式：生成（默认） ----------
const name0 = getFlag('--name');
if (!name0) { console.error('✗ 缺少必填参数 --name'); usage(); process.exit(1); }
let name = name0;
if (/^dsh-/.test(name)) {
  const stripped = name.replace(/^dsh-/, '');
  console.error(`⚠ --name 带了 dsh- 前缀：已自动剥除（${name} → ${stripped}）；npm 包名/仓库名将派生为 dsh-${stripped}`);
  name = stripped;
}
const pkgName = `dsh-${name}`;
const org = getFlag('--org') || 'NinjaSln-labs';
const desc = getFlag('--desc');
if (!desc) { console.error('✗ 缺少必填参数 --desc'); usage(); process.exit(1); }
const surface = getFlag('--surface') || desc;
const legal = getFlag('--legal') || org;
const target = resolve(getFlag('--target') || `../${pkgName}`);

// ---------- 目标目录防护 ----------
if (existsSync(target)) {
  const existing = readdirSync(target);
  if (existing.length) {
    if (!hasFlag('--force')) {
      console.error(`✗ 目标目录非空：${target}（防误并覆盖；确认空库复用请加 --force，含 .git 时强烈建议换目录）`);
      process.exit(1);
    }
    if (existing.includes('.git')) {
      console.error(`✗ 目标目录含 .git，--force 也会损坏仓库状态——请换目录`);
      process.exit(1);
    }
  }
}

// ---------- 出库 ----------
const type = getFlag('--type') || 'dsh-plugin';
if (!CATEGORY_TYPES.includes(type)) {
  console.error(`✗ 未知分类 --type ${type}（可选：${CATEGORY_TYPES.join(' | ')}）`);
  process.exit(1);
}
const overlayArg = getFlag('--overlay');
if (overlayArg && !OVERLAYS.includes(overlayArg)) {
  console.error(`✗ 未知 overlay：${overlayArg}（可选：${OVERLAYS.join(' | ')}）`);
  process.exit(1);
}
mkdirSync(target, { recursive: true });
generateInto(target, type, { overlay: overlayArg, params: { substitutions: [] } });

// 可执行位
for (const rel of ['.githooks/pre-commit', 'scripts/check-deploy.mjs', 'scripts/verify.mjs', 'scripts/build.mjs', 'scripts/verify.py']) {
  const dst = join(target, rel);
  if (existsSync(dst)) chmodSync(dst, 0o755);
}

// ---------- 占位符替换 + 模板说明剥离 ----------
const repo = type === 'dsh-plugin' ? pkgName : name;
const substitutions = [
  ['<org 法律名>', legal],
  ['<name>', name],
  ['<repo>', repo],
  ['<org>', org],
  ['<一句话描述>', desc],
  ['<宿主能力面>', surface],
  ['<year>', String(new Date().getFullYear())],
];
const remaining = transformTree(target, substitutions);
console.log('✓ 占位符替换 + 模板说明注释删除');

// ---------- git init + hooks ----------
const git = (args) => spawnSync('git', args, { cwd: target, stdio: 'ignore' });
const usesHooks = type !== 'sandbox' && type !== 'content';
if (git(['init']).status !== 0) {
  console.error('✗ git init 失败（git 不可用？）——请手动执行 git init');
} else if (usesHooks) {
  git(['config', 'core.hooksPath', '.githooks']);
  console.log('✓ git init + core.hooksPath .githooks（pre-commit 验证链前门已启用）');
} else {
  console.log('✓ git init（沙盒/内容仓：无钩子、无 CI）');
}

// ---------- TODO 清单（分类感知） ----------
printScaffoldSummary({ type, repo, name, org, target, remaining });
process.exit(0);
