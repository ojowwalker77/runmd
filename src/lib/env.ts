import { join } from "path"

export async function loadEnv(dir: string): Promise<Record<string, string>> {
  const envPath = join(dir, ".env")
  const file = Bun.file(envPath)

  if (!(await file.exists())) return {}

  const text = await file.text()
  const env: Record<string, string> = {}
  const lines = text.split("\n")
  let i = 0

  while (i < lines.length) {
    let line = lines[i]!.trim()
    i++

    // Skip comments and empty lines
    if (!line || line.startsWith("#")) continue

    // Strip `export ` prefix
    if (line.startsWith("export ")) {
      line = line.slice(7).trim()
    }

    const eqIndex = line.indexOf("=")
    if (eqIndex === -1) continue

    const key = line.slice(0, eqIndex).trim()
    let value = line.slice(eqIndex + 1).trim()

    // Handle quoted values (possibly multiline)
    if ((value.startsWith('"') || value.startsWith("'"))) {
      const quote = value[0]!
      const closingIdx = findClosingQuote(value, quote, 1)
      if (closingIdx !== -1) {
        // Single-line quoted value
        value = unescapeQuotes(value.slice(1, closingIdx), quote)
      } else {
        // Multiline: accumulate lines until closing quote
        let accumulated = value.slice(1) // remove opening quote
        while (i < lines.length) {
          const nextLine = lines[i]!
          i++
          const closeIdx = findClosingQuote(nextLine, quote, 0)
          if (closeIdx !== -1) {
            accumulated += "\n" + nextLine.slice(0, closeIdx)
            break
          }
          accumulated += "\n" + nextLine
        }
        value = unescapeQuotes(accumulated, quote)
      }
    }

    env[key] = value
  }

  return env
}

function findClosingQuote(text: string, quote: string, startIdx: number): number {
  for (let i = startIdx; i < text.length; i++) {
    if (text[i] === "\\" && i + 1 < text.length) {
      i++ // skip escaped character
      continue
    }
    if (text[i] === quote) return i
  }
  return -1
}

function unescapeQuotes(text: string, quote: string): string {
  return text.replaceAll(`\\${quote}`, quote)
}

export function substituteEnv(content: string, env: Record<string, string>): string {
  return content.replace(/\$\{(\w+)\}/g, (match, key: string) => {
    return env[key] ?? match
  })
}
