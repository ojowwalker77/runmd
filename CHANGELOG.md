# Changelog

## v0.2.0

### Features

- **Streaming output** — Command stdout/stderr now streams in real-time as it's produced, instead of buffering until completion
- **Headless runner** — New `runmd run <file.md>` command for non-interactive execution with `--fail-fast` and `--blocks` flags
- **Syntax-highlighted output** — Command output is now syntax-highlighted using tree-sitter (auto-detects JSON)
- **JSON pretty-printing** — JSON responses are automatically formatted with indentation for readability

### Security

- **Environment variables hidden in UI** — `${VAR_NAME}` placeholders are now displayed as-is in code blocks instead of showing substituted values; variables are only resolved at execution time

### Developer Experience

- **CI workflow** — GitHub Actions pipeline for automated testing on push/PR

## v0.1.0

Initial release.

### Features

- **Interactive shell execution** — Run `bash`, `sh`, `zsh`, and `shell` code blocks directly from markdown with `Enter`
- **Syntax highlighting** — Tree-sitter powered highlighting for code blocks in any language
- **Vim-like modes** — Normal mode for viewing/running, Insert mode for editing
- **Inline editing** — Edit markdown source in-place, auto-saves on exit
- **Environment variable substitution** — Loads `.env` and substitutes `${VAR_NAME}` in markdown content
- **Run indicators** — Visual status per block: `▶` idle, `⟳` running, `✓` success, `✗` error
- **Inline output** — Command output displayed directly below each block
- **Version display** — Shows current version in title bar
- **Update notifications** — Checks GitHub releases on startup, shows "Update Available!" when a newer version exists
- **Mouse support** — Click blocks to focus, scroll with mouse
- **Curl install** — One-liner install via `curl | bash`
