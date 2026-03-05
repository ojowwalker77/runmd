import { describe, test, expect } from "bun:test"
import { parseInfoString, isShellLang } from "../src/lib/parse-info"

describe("parseInfoString", () => {
  test("parses plain language", () => {
    expect(parseInfoString("bash")).toEqual({ lang: "bash", name: undefined })
  })

  test("parses language with name", () => {
    expect(parseInfoString('bash name="setup"')).toEqual({ lang: "bash", name: "setup" })
  })

  test("parses unquoted name value", () => {
    expect(parseInfoString("sh name=deploy")).toEqual({ lang: "sh", name: "deploy" })
  })

  test("handles empty string", () => {
    expect(parseInfoString("")).toEqual({ lang: "", name: undefined })
  })

  test("handles undefined", () => {
    expect(parseInfoString(undefined)).toEqual({ lang: "", name: undefined })
  })

  test("lowercases language", () => {
    expect(parseInfoString("BASH")).toEqual({ lang: "bash", name: undefined })
  })

  test("lowercases language with metadata", () => {
    expect(parseInfoString('ZSH name="test"')).toEqual({ lang: "zsh", name: "test" })
  })

  test("ignores non-name attributes", () => {
    const result = parseInfoString('bash timeout="30" other=foo')
    expect(result).toEqual({ lang: "bash", name: undefined })
  })

  test("extracts name alongside other attributes", () => {
    const result = parseInfoString('bash name="setup" timeout="30"')
    expect(result).toEqual({ lang: "bash", name: "setup" })
  })
})

describe("isShellLang", () => {
  test("returns true for shell languages", () => {
    expect(isShellLang(parseInfoString("bash"))).toBe(true)
    expect(isShellLang(parseInfoString("sh"))).toBe(true)
    expect(isShellLang(parseInfoString("zsh"))).toBe(true)
    expect(isShellLang(parseInfoString("shell"))).toBe(true)
  })

  test("returns true for shell with metadata", () => {
    expect(isShellLang(parseInfoString('bash name="setup"'))).toBe(true)
  })

  test("returns false for non-shell languages", () => {
    expect(isShellLang(parseInfoString("javascript"))).toBe(false)
    expect(isShellLang(parseInfoString("python"))).toBe(false)
  })

  test("returns false for empty", () => {
    expect(isShellLang(parseInfoString(""))).toBe(false)
    expect(isShellLang(parseInfoString(undefined))).toBe(false)
  })
})
