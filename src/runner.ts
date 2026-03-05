import { Lexer, type Token, type Tokens } from "marked"
import { resolve, dirname, basename } from "path"
import { execShellWithHandle, type ExecHandle } from "./lib/exec"
import { loadEnv, substituteEnv } from "./lib/env"
import { parseInfoString, isShellLang } from "./lib/parse-info"

export interface RunnerOptions {
  filePath: string
  failFast?: boolean
  blocks?: (number | string)[]
  timeout?: number
  parallel?: boolean
}

export interface BlockResult {
  index: number
  lang: string
  name?: string
  code: string
  exitCode: number
  stdout: string
  stderr: string
  duration: number
  timedOut?: boolean
}

export interface RunnerResult {
  totalBlocks: number
  executed: number
  passed: number
  failed: number
  skipped: number
  results: BlockResult[]
}

interface ShellBlock {
  lang: string
  name?: string
  code: string
}

function extractShellBlocks(tokens: Token[]): ShellBlock[] {
  const blocks: ShellBlock[] = []
  for (const token of tokens) {
    if (token.type === "code") {
      const codeToken = token as Tokens.Code
      const meta = parseInfoString(codeToken.lang)
      if (isShellLang(meta)) {
        blocks.push({ lang: meta.lang, name: meta.name, code: codeToken.text })
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

  if (options.parallel) {
    await runBlocksParallel(shellBlocks, cwd, env, options, result)
  } else {
    await runBlocksSequential(shellBlocks, cwd, env, options, result)
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

async function runBlocksSequential(
  shellBlocks: ShellBlock[],
  cwd: string,
  env: Record<string, string>,
  options: RunnerOptions,
  result: RunnerResult,
): Promise<void> {
  for (let i = 0; i < shellBlocks.length; i++) {
    const block = shellBlocks[i]!
    const shouldRun = !options.blocks || options.blocks.some(b =>
      typeof b === "number" ? b === i : b === block.name
    )

    if (!shouldRun) {
      result.skipped++
      continue
    }

    if (options.failFast && result.failed > 0) {
      result.skipped++
      continue
    }

    const blockResult = await executeBlock(block, i, cwd, env, options.timeout)
    result.results.push(blockResult)
    result.executed++

    if (blockResult.exitCode === 0) {
      result.passed++
    } else {
      result.failed++
    }

    logBlockResult(blockResult)
  }
}

async function runBlocksParallel(
  shellBlocks: ShellBlock[],
  cwd: string,
  env: Record<string, string>,
  options: RunnerOptions,
  result: RunnerResult,
): Promise<void> {
  const blocksToRun: { block: ShellBlock; i: number }[] = []

  for (let i = 0; i < shellBlocks.length; i++) {
    const block = shellBlocks[i]!
    const shouldRun = !options.blocks || options.blocks.some(b =>
      typeof b === "number" ? b === i : b === block.name
    )
    if (shouldRun) {
      blocksToRun.push({ block, i })
    } else {
      result.skipped++
    }
  }

  const handles: ExecHandle[] = []
  let failFastTriggered = false

  const promises = blocksToRun.map(async ({ block, i }) => {
    const preview = block.code.split("\n")[0]!.slice(0, 60)
    const label = block.name ? `${block.lang}: ${block.name}` : block.lang
    console.log(`\nBlock ${i + 1} [${label}]: ${preview} (starting...)`)

    const start = performance.now()
    const command = block.code
    const handle = execShellWithHandle(command, cwd, env)
    handles.push(handle)

    let timedOut = false
    let timer: ReturnType<typeof setTimeout> | undefined

    if (options.timeout) {
      timer = setTimeout(() => {
        timedOut = true
        handle.kill()
      }, options.timeout * 1000)
    }

    let execResult
    try {
      execResult = await handle.result
    } catch (e: any) {
      execResult = { stdout: "", stderr: e.message || "Execution failed", exitCode: 1 }
    }
    if (timer) clearTimeout(timer)

    const duration = Math.round(performance.now() - start)

    if (execResult.exitCode !== 0 && options.failFast && !failFastTriggered) {
      failFastTriggered = true
      for (const h of handles) h.kill()
    }

    return {
      index: i,
      lang: block.lang,
      name: block.name,
      code: block.code,
      exitCode: execResult.exitCode,
      stdout: execResult.stdout,
      stderr: execResult.stderr,
      duration,
      timedOut: timedOut || undefined,
    } satisfies BlockResult
  })

  const blockResults = await Promise.all(promises)
  blockResults.sort((a, b) => a.index - b.index)

  for (const br of blockResults) {
    result.results.push(br)
    result.executed++
    if (br.exitCode === 0) {
      result.passed++
    } else {
      result.failed++
    }
    logBlockResult(br)
  }
}

async function executeBlock(
  block: ShellBlock,
  index: number,
  cwd: string,
  env: Record<string, string>,
  timeout?: number,
): Promise<BlockResult> {
  const preview = block.code.split("\n")[0]!.slice(0, 60)
  const label = block.name ? `${block.lang}: ${block.name}` : block.lang
  console.log(`\nBlock ${index + 1} [${label}]: ${preview}`)

  const start = performance.now()
  const handle = execShellWithHandle(block.code, cwd, env)

  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined

  if (timeout) {
    timer = setTimeout(() => {
      timedOut = true
      handle.kill()
    }, timeout * 1000)
  }

  let execResult
  try {
    execResult = await handle.result
  } catch (e: any) {
    execResult = { stdout: "", stderr: e.message || "Execution failed", exitCode: 1 }
  }
  if (timer) clearTimeout(timer)

  const duration = Math.round(performance.now() - start)

  return {
    index,
    lang: block.lang,
    name: block.name,
    code: block.code,
    exitCode: execResult.exitCode,
    stdout: execResult.stdout,
    stderr: execResult.stderr,
    duration,
    timedOut: timedOut || undefined,
  }
}

function logBlockResult(br: BlockResult): void {
  if (br.timedOut) {
    console.log(`\x1b[31m✗ timed out\x1b[0m (${br.duration}ms)`)
  } else if (br.exitCode === 0) {
    console.log(`\x1b[32m✓ passed\x1b[0m (${br.duration}ms)`)
  } else {
    console.log(`\x1b[31m✗ failed\x1b[0m (${br.duration}ms)`)
    console.log(`  exit code: ${br.exitCode}`)
    if (br.stderr.trim()) {
      const indented = br.stderr.trim().split("\n").map((l: string) => `  ${l}`).join("\n")
      console.log(`\x1b[31m${indented}\x1b[0m`)
    }
  }
}
