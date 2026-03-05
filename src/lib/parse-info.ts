import { SHELL_LANGS } from "./constants"

export interface CodeBlockMeta {
  lang: string
  name?: string
}

export function parseInfoString(raw: string | undefined): CodeBlockMeta {
  if (!raw) return { lang: "", name: undefined }

  const trimmed = raw.trim()
  const spaceIdx = trimmed.search(/\s/)
  if (spaceIdx === -1) return { lang: trimmed.toLowerCase(), name: undefined }

  const lang = trimmed.slice(0, spaceIdx).toLowerCase()
  const rest = trimmed.slice(spaceIdx + 1)

  // Parse key="value" or key=value pairs
  const regex = /(\w+)=(?:"([^"]*)"|([\S]+))/g
  let name: string | undefined
  let match
  while ((match = regex.exec(rest)) !== null) {
    if (match[1] === "name") {
      name = match[2] ?? match[3]
    }
  }

  return { lang, name }
}

export function isShellLang(meta: CodeBlockMeta): boolean {
  return SHELL_LANGS.has(meta.lang)
}
