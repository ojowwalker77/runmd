export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
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
