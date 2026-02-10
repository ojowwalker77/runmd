import { join } from "path"

export async function loadEnv(dir: string): Promise<Record<string, string>> {
  const envPath = join(dir, ".env")
  const file = Bun.file(envPath)

  if (!(await file.exists())) return {}

  const text = await file.text()
  const env: Record<string, string> = {}

  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const eqIndex = trimmed.indexOf("=")
    if (eqIndex === -1) continue

    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()

    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    env[key] = value
  }

  return env
}

export function substituteEnv(content: string, env: Record<string, string>): string {
  return content.replace(/\$\{(\w+)\}/g, (match, key: string) => {
    return env[key] ?? match
  })
}
