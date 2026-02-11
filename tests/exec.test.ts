import { test, expect, describe } from "bun:test"
import { execShell, execShellStreaming } from "../src/lib/exec"

describe("execShell", () => {
  test("executes simple command and captures stdout", async () => {
    const result = await execShell("echo hello", process.cwd())
    expect(result.stdout.trim()).toBe("hello")
    expect(result.exitCode).toBe(0)
  })

  test("captures stderr", async () => {
    const result = await execShell("echo error >&2", process.cwd())
    expect(result.stderr.trim()).toBe("error")
    expect(result.exitCode).toBe(0)
  })

  test("reports non-zero exit code", async () => {
    const result = await execShell("exit 42", process.cwd())
    expect(result.exitCode).toBe(42)
  })

  test("respects working directory", async () => {
    const result = await execShell("pwd", "/tmp")
    expect(result.stdout.trim()).toMatch(/\/tmp/)
  })

  test("passes environment variables", async () => {
    const result = await execShell('echo "$TEST_VAR"', process.cwd(), { TEST_VAR: "myvalue" })
    expect(result.stdout.trim()).toBe("myvalue")
  })

  test("handles multi-line output", async () => {
    const result = await execShell("echo line1; echo line2; echo line3", process.cwd())
    expect(result.stdout.trim()).toBe("line1\nline2\nline3")
  })
})

describe("execShellStreaming", () => {
  test("streams output via callback", async () => {
    const chunks: string[] = []
    const result = await execShellStreaming("echo hello", process.cwd(), {
      onData: (chunk) => chunks.push(chunk),
    })

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.join("")).toContain("hello")
    expect(result.exitCode).toBe(0)
  })

  test("distinguishes stdout and stderr", async () => {
    const stdout: string[] = []
    const stderr: string[] = []

    await execShellStreaming(
      'echo out && echo err >&2',
      process.cwd(),
      {
        onData: (chunk, stream) => {
          if (stream === "stdout") stdout.push(chunk)
          else stderr.push(chunk)
        },
      },
    )

    expect(stdout.join("")).toContain("out")
    expect(stderr.join("")).toContain("err")
  })

  test("returns same result as buffered exec", async () => {
    const command = "echo hello; echo err >&2; exit 3"
    const buffered = await execShell(command, process.cwd())

    const chunks: string[] = []
    const streamed = await execShellStreaming(command, process.cwd(), {
      onData: (chunk) => chunks.push(chunk),
    })

    expect(streamed.stdout).toBe(buffered.stdout)
    expect(streamed.stderr).toBe(buffered.stderr)
    expect(streamed.exitCode).toBe(buffered.exitCode)
  })

  test("handles large output", async () => {
    const chunks: string[] = []
    await execShellStreaming(
      "for i in $(seq 1 500); do echo line$i; done",
      process.cwd(),
      { onData: (chunk) => chunks.push(chunk) },
    )

    const output = chunks.join("")
    expect(output).toContain("line1\n")
    expect(output).toContain("line500\n")
  })

  test("handles command with no output", async () => {
    const chunks: string[] = []
    const result = await execShellStreaming("true", process.cwd(), {
      onData: (chunk) => chunks.push(chunk),
    })

    expect(result.exitCode).toBe(0)
    expect(chunks.join("")).toBe("")
  })
})
