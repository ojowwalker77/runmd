import { test, expect, describe } from "bun:test"
import { VERSION, isNewer } from "../src/lib/version"

describe("VERSION", () => {
  test("is defined and is a semver string", () => {
    expect(VERSION).toBeDefined()
    expect(typeof VERSION).toBe("string")
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })
})

describe("isNewer", () => {
  test("detects newer major version", () => {
    expect(isNewer("2.0.0", "1.0.0")).toBe(true)
  })

  test("detects newer minor version", () => {
    expect(isNewer("0.2.0", "0.1.0")).toBe(true)
  })

  test("detects newer patch version", () => {
    expect(isNewer("0.1.1", "0.1.0")).toBe(true)
  })

  test("returns false for same version", () => {
    expect(isNewer("0.1.0", "0.1.0")).toBe(false)
  })

  test("returns false for older version", () => {
    expect(isNewer("0.1.0", "0.2.0")).toBe(false)
  })

  test("handles versions with different lengths", () => {
    expect(isNewer("1.0.0", "0.9.9")).toBe(true)
    expect(isNewer("0.9.9", "1.0.0")).toBe(false)
  })
})
