# Changelog

## v0.3.0

### Features

- **Named code blocks** — Add metadata to code fences with `` ```bash name="setup" `` syntax; block names are displayed in the TUI header and can be referenced with `--blocks setup,cleanup`
- **Process cancellation** — Press `Ctrl+C` to cancel a running block in the TUI instead of killing the app; the focused block's process is terminated and the TUI stays open
- **Execution timeout** — New `--timeout <seconds>` flag for the headless runner to kill blocks that exceed a time limit
- **Parallel execution** — New `--parallel` flag for the headless runner to execute all blocks concurrently; supports `--fail-fast` to cancel remaining blocks on first failure
- **Separate stderr display** — stderr output now renders in a distinct red-bordered section below stdout, instead of being mixed together
- **Improved .env parser** — Supports `export` prefix, multiline quoted values, and escaped quotes (`\"`, `\'`) inside values

### Bug Fixes

- **Focus preserved across mode transitions** — Switching between normal and insert mode no longer loses the focused block position

### Internal

- **Signal handling** — Spawned child processes are tracked and cleaned up on SIGINT/SIGTERM in headless mode, preventing zombie processes
- **ExecHandle API** — New `execShellWithHandle()` and `execShellStreamingWithHandle()` functions that return a killable handle for process lifecycle management
- **Info string parser** — New `src/lib/parse-info.ts` module for parsing code fence metadata, fixing a latent bug where `SHELL_LANGS.has()` would break on info strings with attributes

## v0.2.0

### Features

- **Streaming output** — Command stdout/stderr now streams in real-time as it's produced, instead of buffering until completion
- **Headless runner** — New `runmd run <file.md>` command for non-interactive execution with `--fail-fast` and `--blocks` flags
- **Syntax-highlighted output** — Command output is now syntax-highlighted using tree-sitter (auto-detects JSON)
- **JSON pretty-printing** — JSON responses are automatically formatted with indentation for readability

### Security

- **Environment variables hidden in UI** — `${VAR_NAME}` placeholders are now displayed as-is in code blocks instead of showing substituted values; variables are only resolved at execution time

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
