import { Lexer, type Token, type Tokens } from "marked"
import { resolve, dirname, basename } from "path"
import { execShell } from "./lib/exec"
import { loadEnv, substituteEnv } from "./lib/env"
import { SHELL_LANGS } from "./lib/constants"

export interface RunnerOptions {
  filePath: string
  failFast?: boolean
  blocks?: number[]
}

export interface BlockResult {
  index: number
  lang: string
  code: string
  exitCode: number
  stdout: string
  stderr: string
  duration: number
}

export interface RunnerResult {
  totalBlocks: number
  executed: number
  passed: number
  failed: number
  skipped: number
  results: BlockResult[]
}

function extractShellBlocks(tokens: Token[]): { lang: string; code: string }[] {
  const blocks: { lang: string; code: string }[] = []
  for (const token of tokens) {
    if (token.type === "code") {
      const codeToken = token as Tokens.Code
      const lang = (codeToken.lang || "").toLowerCase()
      if (SHELL_LANGS.has(lang)) {
        blocks.push({ lang, code: codeToken.text })
      }
    }
  }
  return blocks
}

export async function runMarkdown(options: RunnerOptions): Promise<RunnerResult> {
  const filePath = resolve(options.filePath)
  const cwd = dirname(filePath)
  const filename = basename(filePath)

  const file = Bun.file(filePath)
  if (!(await file.exists())) {
    throw new Error(`File not found: ${filePath}`)
  }

  const rawContent = await file.text()
  const env = await loadEnv(cwd)
  const content = substituteEnv(rawContent, env)

  const lexer = new Lexer()
  const tokens = lexer.lex(content)
  const shellBlocks = extractShellBlocks(tokens)

  const result: RunnerResult = {
    totalBlocks: shellBlocks.length,
    executed: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    results: [],
  }

  if (shellBlocks.length === 0) {
    return result
  }

  console.log(`\nRunning: ${filename}`)
  console.log("─".repeat(40))

  for (let i = 0; i < shellBlocks.length; i++) {
    const block = shellBlocks[i]!
    const shouldRun = !options.blocks || options.blocks.includes(i)

    if (!shouldRun) {
      result.skipped++
      continue
    }

    // Check if we should skip due to previous failure in fail-fast mode
    if (options.failFast && result.failed > 0) {
      result.skipped++
      continue
    }

    const preview = block.code.split("\n")[0]!.slice(0, 60)
    console.log(`\nBlock ${i + 1} [${block.lang}]: ${preview}`)

    const start = performance.now()
    let execResult
    try {
      execResult = await execShell(block.code, cwd, env)
    } catch (e: any) {
      execResult = { stdout: "", stderr: e.message || "Execution failed", exitCode: 1 }
    }
    const duration = Math.round(performance.now() - start)

    const blockResult: BlockResult = {
      index: i,
      lang: block.lang,
      code: block.code,
      exitCode: execResult.exitCode,
      stdout: execResult.stdout,
      stderr: execResult.stderr,
      duration,
    }

    result.results.push(blockResult)
    result.executed++

    if (execResult.exitCode === 0) {
      result.passed++
      console.log(`\x1b[32m✓ passed\x1b[0m (${duration}ms)`)
    } else {
      result.failed++
      console.log(`\x1b[31m✗ failed\x1b[0m (${duration}ms)`)
      console.log(`  exit code: ${execResult.exitCode}`)
      if (execResult.stderr.trim()) {
        const indented = execResult.stderr.trim().split("\n").map((l: string) => `  ${l}`).join("\n")
        console.log(`\x1b[31m${indented}\x1b[0m`)
      }
    }
  }

  console.log("\n" + "─".repeat(40))
  const parts: string[] = []
  if (result.passed > 0) parts.push(`\x1b[32m${result.passed} passed\x1b[0m`)
  if (result.failed > 0) parts.push(`\x1b[31m${result.failed} failed\x1b[0m`)
  if (result.skipped > 0) parts.push(`${result.skipped} skipped`)

  const totalDuration = result.results.reduce((sum, r) => sum + r.duration, 0)
  console.log(`${parts.join(", ")} (${totalDuration}ms)\n`)

  return result
}
