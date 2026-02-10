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

```bash
runmd <file.md>
```

Shell code blocks (```bash, ```sh, ```zsh) become interactive — navigate to them with `Tab` and hit `Enter` to execute. Other code blocks render as syntax-highlighted read-only blocks.

## Keybindings

### Normal mode

| Key | Action |
|---|---|
| `Tab` / `Shift+Tab` | Cycle between shell blocks |
| `Enter` | Run focused shell block |
| `↑` / `↓` | Scroll |
| `i` | Enter insert (edit) mode |
| `q` | Quit |

### Insert mode

| Key | Action |
|---|---|
| `Esc` | Save and return to normal mode |

## Features

**Executable shell blocks** — Shell code blocks show a run indicator (`▶` idle, `⟳` running, `✓` success, `✗` error) and display output inline after execution.

**Inline editing** — Press `i` to edit the markdown source directly in the terminal. Changes are saved to disk on `Esc`.

**Environment variables** — Loads `.env` from the markdown file's directory. Use `${VAR_NAME}` in your markdown and it gets substituted before rendering.

**Syntax highlighting** — Tree-sitter powered highlighting for code blocks in any language.

**Update notifications** — Shows your current version in the title bar and checks GitHub releases for updates on startup.

## How it works

Built with [Bun](https://bun.sh), [OpenTUI](https://opentui.com) (React-based terminal UI), and tree-sitter for syntax highlighting. Shell execution uses `Bun.spawn()`.

## License

MIT
