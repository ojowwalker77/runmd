import { test, expect, describe } from "bun:test"
import { loadEnv, substituteEnv } from "../src/lib/env"
import { join } from "path"

describe("loadEnv", () => {
  test("loads .env file from directory", async () => {
    const env = await loadEnv(join(import.meta.dir, "fixtures/test-env"))
    expect(env.TEST_PROJECT).toBe("runmd-test")
    expect(env.TEST_VERSION).toBe("1.0.0")
  })

  test("returns empty object if .env doesn't exist", async () => {
    const env = await loadEnv("/tmp/nonexistent-dir-runmd-test")
    expect(env).toEqual({})
  })

  test("ignores comments and empty lines", async () => {
    const dir = join(import.meta.dir, "fixtures/tmp-env-test")
    await Bun.write(join(dir, ".env"), "# comment\n\nKEY=value\n# another comment\n")
    const env = await loadEnv(dir)
    expect(env).toEqual({ KEY: "value" })
    // cleanup
    const { unlinkSync, rmdirSync } = await import("fs")
    unlinkSync(join(dir, ".env"))
    rmdirSync(dir)
  })

  test("strips surrounding quotes from values", async () => {
    const dir = join(import.meta.dir, "fixtures/tmp-quotes-test")
    await Bun.write(join(dir, ".env"), 'A="double"\nB=\'single\'\nC=noquotes\n')
    const env = await loadEnv(dir)
    expect(env.A).toBe("double")
    expect(env.B).toBe("single")
    expect(env.C).toBe("noquotes")
    const { unlinkSync, rmdirSync } = await import("fs")
    unlinkSync(join(dir, ".env"))
    rmdirSync(dir)
  })

  test("handles equals signs in values", async () => {
    const dir = join(import.meta.dir, "fixtures/tmp-equals-test")
    await Bun.write(join(dir, ".env"), "URL=https://example.com?a=1&b=2\n")
    const env = await loadEnv(dir)
    expect(env.URL).toBe("https://example.com?a=1&b=2")
    const { unlinkSync, rmdirSync } = await import("fs")
    unlinkSync(join(dir, ".env"))
    rmdirSync(dir)
  })

  test("strips export prefix", async () => {
    const dir = join(import.meta.dir, "fixtures/tmp-export-test")
    await Bun.write(join(dir, ".env"), 'export FOO=bar\nexport BAZ="quoted"\nREGULAR=yes\n')
    const env = await loadEnv(dir)
    expect(env.FOO).toBe("bar")
    expect(env.BAZ).toBe("quoted")
    expect(env.REGULAR).toBe("yes")
    const { unlinkSync, rmdirSync } = await import("fs")
    unlinkSync(join(dir, ".env"))
    rmdirSync(dir)
  })

  test("handles escaped quotes in values", async () => {
    const dir = join(import.meta.dir, "fixtures/tmp-escape-test")
    await Bun.write(join(dir, ".env"), 'MSG="hello \\"world\\""\n')
    const env = await loadEnv(dir)
    expect(env.MSG).toBe('hello "world"')
    const { unlinkSync, rmdirSync } = await import("fs")
    unlinkSync(join(dir, ".env"))
    rmdirSync(dir)
  })

  test("handles multiline quoted values", async () => {
    const dir = join(import.meta.dir, "fixtures/tmp-multiline-test")
    await Bun.write(join(dir, ".env"), 'MULTI="line1\nline2\nline3"\nAFTER=ok\n')
    const env = await loadEnv(dir)
    expect(env.MULTI).toBe("line1\nline2\nline3")
    expect(env.AFTER).toBe("ok")
    const { unlinkSync, rmdirSync } = await import("fs")
    unlinkSync(join(dir, ".env"))
    rmdirSync(dir)
  })
})

describe("substituteEnv", () => {
  test("substitutes environment variables", () => {
    expect(substituteEnv("Hello ${NAME}", { NAME: "World" })).toBe("Hello World")
  })

  test("leaves unmatched variables unchanged", () => {
    expect(substituteEnv("Hello ${MISSING}", {})).toBe("Hello ${MISSING}")
  })

  test("handles multiple substitutions", () => {
    const result = substituteEnv("${A} and ${B}", { A: "one", B: "two" })
    expect(result).toBe("one and two")
  })

  test("handles adjacent substitutions", () => {
    const result = substituteEnv("${A}${B}", { A: "hello", B: "world" })
    expect(result).toBe("helloworld")
  })

  test("handles empty env", () => {
    expect(substituteEnv("no vars here", {})).toBe("no vars here")
  })
})
