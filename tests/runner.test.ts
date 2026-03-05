import { test, expect, describe } from "bun:test"
import { runMarkdown } from "../src/runner"
import { join } from "path"

const FIXTURES = join(import.meta.dir, "fixtures")

describe("runMarkdown", () => {
  test("executes all shell blocks in a markdown file", async () => {
    const result = await runMarkdown({
      filePath: join(FIXTURES, "test.md"),
    })

    expect(result.totalBlocks).toBe(3)
    expect(result.executed).toBe(3)
    expect(result.passed).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.results).toHaveLength(3)
  })

  test("ignores non-shell code blocks", async () => {
    const result = await runMarkdown({
      filePath: join(FIXTURES, "test.md"),
    })

    // test.md has a javascript block that should be ignored
    const langs = result.results.map(r => r.lang)
    expect(langs).not.toContain("javascript")
  })

  test("reports failures correctly", async () => {
    const result = await runMarkdown({
      filePath: join(FIXTURES, "test-failing.md"),
    })

    expect(result.passed).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.results[1]!.exitCode).not.toBe(0)
  })

  test("stops on first failure with fail-fast", async () => {
    const result = await runMarkdown({
      filePath: join(FIXTURES, "test-failing.md"),
      failFast: true,
    })

    expect(result.failed).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.executed).toBe(2) // first pass + first fail
  })

  test("runs specific blocks only", async () => {
    const result = await runMarkdown({
      filePath: join(FIXTURES, "test.md"),
      blocks: [0, 2],
    })

    expect(result.executed).toBe(2)
    expect(result.skipped).toBe(1)
    expect(result.results).toHaveLength(2)
    expect(result.results[0]!.index).toBe(0)
    expect(result.results[1]!.index).toBe(2)
  })

  test("handles file with no shell blocks", async () => {
    const result = await runMarkdown({
      filePath: join(FIXTURES, "test-empty.md"),
    })

    expect(result.totalBlocks).toBe(0)
    expect(result.executed).toBe(0)
    expect(result.passed).toBe(0)
    expect(result.failed).toBe(0)
  })

  test("tracks execution duration", async () => {
    const result = await runMarkdown({
      filePath: join(FIXTURES, "test.md"),
    })

    for (const r of result.results) {
      expect(r.duration).toBeGreaterThanOrEqual(0)
    }
  })

  test("captures stdout in results", async () => {
    const result = await runMarkdown({
      filePath: join(FIXTURES, "test.md"),
    })

    expect(result.results[0]!.stdout.trim()).toBe("hello world")
    expect(result.results[1]!.stdout.trim()).toBe("second block")
  })

  test("throws on missing file", async () => {
    expect(runMarkdown({
      filePath: join(FIXTURES, "nonexistent.md"),
    })).rejects.toThrow("File not found")
  })

  test("handles environment variable substitution", async () => {
    const result = await runMarkdown({
      filePath: join(FIXTURES, "test-env/test.md"),
    })

    expect(result.passed).toBe(1)
    expect(result.results[0]!.stdout).toContain("runmd-test")
  })

  test("runs blocks by name", async () => {
    const result = await runMarkdown({
      filePath: join(FIXTURES, "test-named.md"),
      blocks: ["setup"],
    })

    expect(result.executed).toBe(1)
    expect(result.skipped).toBe(2)
    expect(result.results[0]!.stdout.trim()).toBe("setting up")
    expect(result.results[0]!.name).toBe("setup")
  })

  test("runs blocks by mixed names and indices", async () => {
    const result = await runMarkdown({
      filePath: join(FIXTURES, "test-named.md"),
      blocks: [0, "test"],
    })

    expect(result.executed).toBe(2)
    expect(result.skipped).toBe(1)
    expect(result.results[0]!.name).toBe("setup")
    expect(result.results[1]!.name).toBe("test")
  })

  test("includes name in block results", async () => {
    const result = await runMarkdown({
      filePath: join(FIXTURES, "test-named.md"),
    })

    expect(result.results[0]!.name).toBe("setup")
    expect(result.results[1]!.name).toBe("test")
    expect(result.results[2]!.name).toBeUndefined()
  })

  test("timeout kills long-running blocks", async () => {
    const result = await runMarkdown({
      filePath: join(FIXTURES, "test-timeout.md"),
      timeout: 1,
    })

    expect(result.results[0]!.exitCode).not.toBe(0)
    expect(result.results[0]!.timedOut).toBe(true)
  }, 10000)

  test("timeout with fail-fast skips remaining blocks", async () => {
    const result = await runMarkdown({
      filePath: join(FIXTURES, "test-timeout.md"),
      timeout: 1,
      failFast: true,
    })

    expect(result.failed).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.results[0]!.timedOut).toBe(true)
  }, 10000)
})

describe("runMarkdown parallel", () => {
  test("executes all blocks and produces same results as sequential", async () => {
    const result = await runMarkdown({
      filePath: join(FIXTURES, "test.md"),
      parallel: true,
    })

    expect(result.totalBlocks).toBe(3)
    expect(result.passed).toBe(3)
    expect(result.failed).toBe(0)
  })

  test("parallel is faster than sequential with sleep blocks", async () => {
    const seqStart = performance.now()
    await runMarkdown({ filePath: join(FIXTURES, "test-parallel.md") })
    const seqDuration = performance.now() - seqStart

    const parStart = performance.now()
    await runMarkdown({ filePath: join(FIXTURES, "test-parallel.md"), parallel: true })
    const parDuration = performance.now() - parStart

    // Parallel should be significantly faster (3 x 0.3s sequential vs ~0.3s parallel)
    expect(parDuration).toBeLessThan(seqDuration * 0.8)
  }, 10000)

  test("parallel results maintain original order", async () => {
    const result = await runMarkdown({
      filePath: join(FIXTURES, "test-parallel.md"),
      parallel: true,
    })

    for (let i = 0; i < result.results.length; i++) {
      expect(result.results[i]!.index).toBe(i)
    }
  })

  test("parallel with blocks filter", async () => {
    const result = await runMarkdown({
      filePath: join(FIXTURES, "test.md"),
      parallel: true,
      blocks: [0, 2],
    })

    expect(result.executed).toBe(2)
    expect(result.skipped).toBe(1)
  })

  test("parallel with timeout", async () => {
    const result = await runMarkdown({
      filePath: join(FIXTURES, "test-timeout.md"),
      parallel: true,
      timeout: 1,
    })

    const timedOutBlock = result.results.find(r => r.timedOut)
    expect(timedOutBlock).toBeDefined()
  }, 10000)
})
