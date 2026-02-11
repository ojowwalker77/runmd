export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface StreamingExecOptions {
  onData: (chunk: string, stream: "stdout" | "stderr") => void
}

export async function execShell(command: string, cwd: string, env?: Record<string, string>): Promise<ExecResult> {
  const proc = Bun.spawn(["sh", "-c", command], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  })

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])

  const exitCode = await proc.exited

  return { stdout, stderr, exitCode }
}

async function readStream(
  stream: ReadableStream<Uint8Array> | null,
  label: "stdout" | "stderr",
  onData: (chunk: string, stream: "stdout" | "stderr") => void,
): Promise<string> {
  if (!stream) return ""

  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let accumulated = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      accumulated += text
      onData(text, label)
    }
    // Flush any remaining bytes
    const remaining = decoder.decode()
    if (remaining) {
      accumulated += remaining
      onData(remaining, label)
    }
  } finally {
    reader.releaseLock()
  }

  return accumulated
}

export async function execShellStreaming(
  command: string,
  cwd: string,
  options: StreamingExecOptions,
  env?: Record<string, string>,
): Promise<ExecResult> {
  const proc = Bun.spawn(["sh", "-c", command], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    readStream(proc.stdout as ReadableStream<Uint8Array>, "stdout", options.onData),
    readStream(proc.stderr as ReadableStream<Uint8Array>, "stderr", options.onData),
    proc.exited,
  ])

  return { stdout, stderr, exitCode }
}
