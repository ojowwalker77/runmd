# runmd

Interactive terminal markdown viewer with executable shell code blocks.

Render any markdown file in your terminal with syntax highlighting, then run the shell commands right inside it.






https://github.com/user-attachments/assets/79d30b91-013c-47db-96e8-e8b2d52565ec





## Install

```bash
curl -fsSL https://raw.githubusercontent.com/ojowwalker77/runmd/main/install.sh | bash
```

Or with Bun directly:

```bash
bun install -g runmd
```

Or from source:

```bash
git clone https://github.com/ojowwalker77/runmd.git
cd runmd
bun install
bun run install-global
```

## Usage

### Interactive (TUI)

```bash
runmd <file.md>
```

Shell code blocks (```bash, ```sh, ```zsh) become interactive — navigate to them with `Tab` and hit `Enter` to execute. Other code blocks render as syntax-highlighted read-only blocks.

### Headless (CI/scripts)

```bash
runmd run <file.md> [options]
```

| Flag | Description |
|---|---|
| `--fail-fast` | Stop on first failure |
| `--blocks 0,2,setup` | Run specific blocks by index or name |
| `--timeout 30` | Kill blocks exceeding N seconds |
| `--parallel` | Execute all blocks concurrently |

## Keybindings

### Normal mode

| Key | Action |
|---|---|
| `Tab` / `Shift+Tab` | Cycle between shell blocks |
| `Enter` | Run focused shell block |
| `Ctrl+C` | Cancel running block, or quit |
| `↑` / `↓` | Scroll |
| `i` | Enter insert (edit) mode |
| `q` | Quit |

### Insert mode

| Key | Action |
|---|---|
| `Esc` | Save and return to normal mode |

## Features

**Executable shell blocks** — Shell code blocks show a run indicator (`▶` idle, `⟳` running, `✓` success, `✗` error) and display output inline after execution. Stdout and stderr are displayed separately (stderr in red).

**Named blocks** — Add a name to any code fence to reference it by name:

````
```bash name="setup"
echo "installing dependencies"
```
````

Named blocks display their name in the header and can be targeted with `--blocks setup` in headless mode.

**Process cancellation** — Press `Ctrl+C` to cancel a running block without leaving the TUI. Long-running commands in headless mode can be capped with `--timeout`.

**Parallel execution** — Run all blocks concurrently with `--parallel` in headless mode. Combine with `--fail-fast` to cancel remaining blocks on first failure.

**Inline editing** — Press `i` to edit the markdown source directly in the terminal. Changes are saved to disk on `Esc`. Focus position is preserved across mode transitions.

**Environment variables** — Loads `.env` from the markdown file's directory. Use `${VAR_NAME}` in your markdown and it gets substituted before rendering. Supports `export` prefix, multiline values, and escaped quotes.

**Syntax highlighting** — Tree-sitter powered highlighting for code blocks in any language.

**Update notifications** — Shows your current version in the title bar and checks GitHub releases for updates on startup.

## How it works

Built with [Bun](https://bun.sh), [OpenTUI](https://opentui.com) (React-based terminal UI), and tree-sitter for syntax highlighting. Shell execution uses `Bun.spawn()`.

## License

MIT
