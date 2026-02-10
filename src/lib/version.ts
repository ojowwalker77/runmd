import { resolve } from "path"

const pkg = await Bun.file(resolve(import.meta.dir, "../../package.json")).json()
export const VERSION: string = pkg.version

const GITHUB_REPO = "ojowwalker77/runmd"

export async function checkForUpdate(current: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers: { "Accept": "application/vnd.github.v3+json" } },
    )
    if (!res.ok) return null
    const data = await res.json() as { tag_name: string }
    const latest = data.tag_name.replace(/^v/, "")
    return isNewer(latest, current) ? latest : null
  } catch {
    return null
  }
}

function isNewer(a: string, b: string): boolean {
  const pa = a.split(".").map(Number)
  const pb = b.split(".").map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false
  }
  return false
}
