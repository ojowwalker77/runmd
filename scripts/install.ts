#!/usr/bin/env bun

/**
 * Cross-platform installer for runmd.
 * Creates a global `runmd` command that works on macOS, Linux, and Windows.
 *
 * Usage:
 *   bun run install-global
 */

import { resolve, join } from "path"

const ROOT = resolve(import.meta.dirname, "..")
const ENTRY = join(ROOT, "bin", "runmd.ts")

function getInstallDir(): string {
  const platform = process.platform

  // Check common writable PATH dirs in order of preference
  const candidates =
    platform === "win32"
      ? [join(process.env.LOCALAPPDATA ?? "", "Programs", "runmd")]
      : [
          join(process.env.HOME ?? "", ".local", "bin"),
          "/usr/local/bin",
        ]

  const pathDirs = (process.env.PATH ?? "").split(platform === "win32" ? ";" : ":")

  for (const dir of candidates) {
    if (pathDirs.includes(dir)) return dir
  }

  // Default to ~/.local/bin even if not in PATH yet
  return candidates[0]!
}

async function install() {
  const platform = process.platform
  const installDir = getInstallDir()
  const pathDirs = (process.env.PATH ?? "").split(platform === "win32" ? ";" : ":")

  // Ensure install dir exists
  await Bun.$`mkdir -p ${installDir}`.quiet()

  if (platform === "win32") {
    // Windows: create a .cmd wrapper
    const cmdPath = join(installDir, "runmd.cmd")
    await Bun.write(cmdPath, `@echo off\r\nbun run "${ENTRY}" %*\r\n`)
    console.log(`\x1b[32m✓\x1b[0m Installed to ${cmdPath}`)
  } else {
    // Unix: create a shell script
    const binPath = join(installDir, "runmd")
    await Bun.write(binPath, `#!/bin/sh\nexec bun run "${ENTRY}" "$@"\n`)
    await Bun.$`chmod +x ${binPath}`.quiet()
    console.log(`\x1b[32m✓\x1b[0m Installed to ${binPath}`)
  }

  if (!pathDirs.includes(installDir)) {
    console.log()
    console.log(`\x1b[33m!\x1b[0m ${installDir} is not in your PATH.`)
    console.log(`  Add this to your shell config (~/.zshrc, ~/.bashrc, etc.):`)
    console.log()
    console.log(`  export PATH="${installDir}:$PATH"`)
    console.log()
  } else {
    console.log()
    console.log(`  Run \x1b[36mrunmd <file.md>\x1b[0m from anywhere.`)
  }
}

install()
