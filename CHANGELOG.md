# Changelog

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
