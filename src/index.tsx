import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./app"
import { resolve, dirname, basename } from "path"
import { loadEnv, substituteEnv } from "./lib/env"
import { VERSION } from "./lib/version"

const args = process.argv.slice(2)

if (args.length === 0) {
  console.error(`runmd v${VERSION}\n\nUsage: runmd <file.md>`)
  process.exit(1)
}

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
const content = substituteEnv(rawContent, env)

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  useMouse: true,
  useAlternateScreen: true,
})

createRoot(renderer).render(
  <App content={content} filename={filename} cwd={cwd} filePath={filePath} env={env} version={VERSION} />
)
