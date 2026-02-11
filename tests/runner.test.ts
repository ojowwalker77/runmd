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
})
