import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./app"
import { resolve, dirname, basename } from "path"
import { loadEnv } from "./lib/env"
import { VERSION } from "./lib/version"
import { runMarkdown } from "./runner"

const args = process.argv.slice(2)

if (args.length === 0) {
  console.error(`runmd v${VERSION}\n\nUsage: runmd <file.md>\n       runmd run <file.md> [--fail-fast] [--blocks 0,2,5]`)
  process.exit(1)
}

// Headless runner mode
if (args[0] === "run") {
  const runArgs = args.slice(1)
  const fileArg = runArgs.find(a => !a.startsWith("--"))

  if (!fileArg) {
    console.error("Usage: runmd run <file.md> [--fail-fast] [--blocks 0,2,5]")
    process.exit(1)
  }

  const failFast = runArgs.includes("--fail-fast")
  const blocksIdx = runArgs.indexOf("--blocks")
  const blocks = blocksIdx !== -1 && runArgs[blocksIdx + 1]
    ? runArgs[blocksIdx + 1]!.split(",").map(Number)
    : undefined

  try {
    const result = await runMarkdown({ filePath: fileArg, failFast, blocks })
    process.exit(result.failed > 0 ? 1 : 0)
  } catch (e: any) {
    console.error(e.message)
    process.exit(1)
  }
}

// TUI mode
const filePath = resolve(args[0]!)
const cwd = dirname(filePath)
const filename = basename(filePath)

const file = Bun.file(filePath)
if (!(await file.exists())) {
  console.error(`File not found: ${filePath}`)
  process.exit(1)
}

const rawContent = await file.text()
const env = await loadEnv(cwd)

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  useMouse: true,
  useAlternateScreen: true,
})

createRoot(renderer).render(
  <App content={rawContent} filename={filename} cwd={cwd} filePath={filePath} env={env} version={VERSION} />
)
