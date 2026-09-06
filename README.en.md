# repo-audit

> **Repository Standardization Audit Tool + Engineering Scaffold Generator**

Audits repositories against industrial best practices (zero npm dependencies, single-file pure Node.js ESM) and generates compliant engineering scaffolds from templates.

## ✨ Features

- **Zero dependencies**: Single `repo-audit.mjs` file, pure Node.js ESM, no `npm install` required
- **Cross-platform**: Built-in launchers for Windows (`.cmd` / `.ps1`) and Linux/macOS (`.sh`)
- **Auto-classification**: Scores file structure to detect 18 repository types (dsh-plugin / python-app / go-service / content / sandbox / archive, etc.)
- **Extensible rules**: YAML rules in `rules/`, covering 5 dimensions (docs / git / quality / security) + category-specific rules
- **Monorepo awareness**: Auto-detects workspace layouts (`apps/*` / `packages/*`, etc.)
- **Repo-level waivers**: `.auditrc.yaml` declares known-accepted findings to prevent alert fatigue
- **Optional LLM enhancement**: Supports 15+ providers (OpenAI / Anthropic / DeepSeek / Qwen / GLM / OpenRouter, etc.)
- **Read-only safety**: Does not modify any files in the audited repository

## 📦 Quick Start

### Audit a repository

```bash
# Direct run (Linux/macOS)
./shim/repo-audit.sh --repo /path/to/repo

# Or with node
node repo-audit.mjs --repo /path/to/repo --format json

# Windows
shim\repo-audit.cmd --repo C:\path\to\repo
```

### Generate a scaffold

```bash
node templates/scaffold.mjs --type dsh-plugin --name my-plugin --org my-org --desc "Plugin description"
```

## 🏗️ Directory Structure

```
repo-audit/
├── repo-audit.mjs          # Core audit engine (single file, zero deps)
├── rules/                  # Audit rules (YAML)
│   ├── domains/            # Cross-dimension rules (docs/git/quality/security)
│   └── categories/         # Category-specific rules (dsh-plugin/python-app/...)
├── shim/                   # Cross-platform launchers
├── templates/              # Engineering scaffold templates + generator
├── docs/repo-audit/        # User manuals (AGENT-GUIDE + HUMAN-GUIDE)
├── AUDIT.md                # Audit methodology
├── BEST-PRACTICES.md       # Best practices reference
├── REPO-CLASSIFICATION.md  # Classification detection guide
└── REPO-AUDIT.md           # Tool overview
```

## 📚 Documentation

- [Human Guide](https://github.com/NinjaSln-labs/repo-audit/blob/master/docs/repo-audit/HUMAN-GUIDE.md) — Full usage documentation
- [Agent Guide](https://github.com/NinjaSln-labs/repo-audit/blob/master/docs/repo-audit/AGENT-GUIDE.md) — Machine-readable operation protocol
- [Audit Methodology](https://github.com/NinjaSln-labs/repo-audit/blob/master/AUDIT.md)
- [Best Practices](https://github.com/NinjaSln-labs/repo-audit/blob/master/BEST-PRACTICES.md)
- [GitHub Pages](https://ninjasln-labs.github.io/repo-audit/) — Online documentation

## 🛠️ Development

- Audit rules: Edit `rules/domains/*.yaml` (cross-dimension) or `rules/categories/*.yaml` (category-specific)
- New categories: Add `<type>.yaml` to `rules/categories/`, or extend via `REPO_AUDIT_TYPES` env var
- Custom rules: `--rules my-rules.yaml` parameter

## 📄 License

MIT © 2026 NinjaSln-labs
