import { useCallback, useEffect, useRef, useState } from "react"
import { useKeyboard, useRenderer } from "@opentui/react"
import {
  SyntaxStyle,
  getTreeSitterClient,
  BoxRenderable,
  TextRenderable,
  CodeRenderable,
  StyledText,
  TextAttributes,
  type RenderContext,
  type Renderable,
  type KeyEvent,
  type RenderNodeContext,
  parseColor,
  type TextareaRenderable,
} from "@opentui/core"
import type { Token, Tokens } from "marked"
import { execShellStreamingWithHandle, killAllProcesses, type ExecHandle } from "./lib/exec"
import { substituteEnv } from "./lib/env"
import { checkForUpdate } from "./lib/version"
import { parseInfoString, isShellLang } from "./lib/parse-info"
import { resolve } from "path"

type Mode = "normal" | "insert"

const syntaxStyle = SyntaxStyle.fromStyles({
  default: { fg: parseColor("#b0b0b0") },
  "markup.heading.1": { fg: parseColor("#bd93f9"), bold: true },
  "markup.heading.2": { fg: parseColor("#bd93f9"), bold: true },
  "markup.heading.3": { fg: parseColor("#bd93f9") },
  "markup.heading.4": { fg: parseColor("#e0e0e0"), bold: true },
  "markup.heading.5": { fg: parseColor("#e0e0e0") },
  "markup.heading.6": { fg: parseColor("#b0b0b0") },
  "markup.strong": { fg: parseColor("#e0e0e0"), bold: true },
  "markup.italic": { fg: parseColor("#b0b0b0"), italic: true },
  "markup.raw": { fg: parseColor("#f1fa8c") },
  "markup.link": { fg: parseColor("#bd93f9") },
  "markup.link.label": { fg: parseColor("#bd93f9"), underline: true },
  "markup.link.url": { fg: parseColor("#444444") },
  "markup.list": { fg: parseColor("#b0b0b0") },
  "markup.strikethrough": { fg: parseColor("#444444"), dim: true },
  punctuation: { fg: parseColor("#444444") },
  "punctuation.special": { fg: parseColor("#444444") },
  conceal: { fg: parseColor("#333333") },
  keyword: { fg: parseColor("#bd93f9") },
  string: { fg: parseColor("#f1fa8c") },
  comment: { fg: parseColor("#444444"), italic: true },
  variable: { fg: parseColor("#b0b0b0") },
  "function": { fg: parseColor("#e0e0e0") },
  number: { fg: parseColor("#bd93f9") },
  operator: { fg: parseColor("#666666") },
  type: { fg: parseColor("#e0e0e0") },
  constant: { fg: parseColor("#bd93f9") },
})

class RunBlockRenderable extends BoxRenderable {
  private _code: string
  private _lang: string
  private _name: string | undefined
  private _cwd: string
  private _state: "idle" | "running" | "done" = "idle"
  private _exitCode = 0
  private _output = ""
  private _stderr = ""
  private _headerText: TextRenderable
  private _codeBox: BoxRenderable
  private _outputBox: BoxRenderable | null = null
  private _outputCode: CodeRenderable | null = null
  private _stderrBox: BoxRenderable | null = null
  private _stderrCode: CodeRenderable | null = null

  private _handle: ExecHandle | null = null
  private _env: Record<string, string>
  private _syntaxStyle: SyntaxStyle
  private _treeSitterClient?: any

  constructor(ctx: RenderContext, opts: {
    id: string
    code: string
    lang: string
    name?: string
    cwd: string
    env: Record<string, string>
    syntaxStyle: SyntaxStyle
    treeSitterClient?: any
  }) {
    super(ctx, {
      id: opts.id,
      flexDirection: "column",
      width: "100%",
      marginBottom: 1,
    })

    this._code = opts.code
    this._lang = opts.lang
    this._name = opts.name
    this._cwd = opts.cwd
    this._env = opts.env
    this._syntaxStyle = opts.syntaxStyle
    this._treeSitterClient = opts.treeSitterClient
    this._focusable = true

    const label = opts.name ? `${opts.lang}: ${opts.name}` : opts.lang
    this._headerText = new TextRenderable(ctx, {
      id: `${opts.id}-header`,
      content: new StyledText([
        { __isChunk: true, text: "▶ ", fg: parseColor("#666666"), attributes: 0 },
        { __isChunk: true, text: label, fg: parseColor("#b0b0b0"), attributes: TextAttributes.BOLD },
        { __isChunk: true, text: "  click block to focus, ", fg: parseColor("#444444"), attributes: 0 },
        { __isChunk: true, text: "enter", fg: parseColor("#666666"), attributes: TextAttributes.BOLD },
        { __isChunk: true, text: " to run", fg: parseColor("#444444"), attributes: 0 },
      ]),
      width: "100%",
      marginBottom: 0,
    })
    this.add(this._headerText)

    this._codeBox = new BoxRenderable(ctx, {
      id: `${opts.id}-codebox`,
      border: true,
      borderColor: parseColor("#1a1a1a"),
      width: "100%",
      paddingLeft: 1,
      paddingRight: 1,
    })

    const codeRenderable = new CodeRenderable(ctx, {
      id: `${opts.id}-code`,
      content: opts.code,
      filetype: opts.lang,
      syntaxStyle: opts.syntaxStyle,
      treeSitterClient: opts.treeSitterClient,
      width: "100%",
    })
    this._codeBox.add(codeRenderable)
    this.add(this._codeBox)
  }

  get state() { return this._state }

  override handleKeyPress(key: KeyEvent): boolean {
    if (key.name === "return" && this._state !== "running") {
      this.execute()
      key.preventDefault()
      return true
    }
    if (key.name === "c" && key.ctrl && this._state === "running") {
      this.cancel()
      key.preventDefault()
      return true
    }
    return false
  }

  cancel(): void {
    if (this._state === "running" && this._handle) {
      this._handle.kill()
    }
  }

  private async execute() {
    this._state = "running"
    this._output = ""
    this._stderr = ""
    this.updateHeader()
    this.createOutputBox()
    this.requestRender()

    try {
      const command = substituteEnv(this._code, this._env)
      const handle = execShellStreamingWithHandle(command, this._cwd, {
        onData: (chunk, stream) => {
          if (stream === "stderr") {
            this._stderr += chunk
            this.updateStderrDisplay()
          } else {
            this._output += chunk
            this.updateOutputDisplay()
          }
        },
      }, this._env)
      this._handle = handle
      const result = await handle.result
      this._exitCode = result.exitCode
    } catch (e: any) {
      this._exitCode = 1
      this._output += e.message || "Execution failed"
    }

    this._handle = null
    this._state = "done"
    this.updateHeader()
    this.finalizeOutput()
    this.requestRender()
  }

  private updateHeader() {
    if (this._state === "running") {
      this._headerText.content = new StyledText([
        { __isChunk: true, text: "⟳ ", fg: parseColor("#f1fa8c"), attributes: 0 },
        { __isChunk: true, text: "running...  ", fg: parseColor("#f1fa8c"), attributes: TextAttributes.ITALIC },
        { __isChunk: true, text: "ctrl+c", fg: parseColor("#666666"), attributes: TextAttributes.BOLD },
        { __isChunk: true, text: " cancel", fg: parseColor("#444444"), attributes: 0 },
      ])
      this._codeBox.borderColor = parseColor("#f1fa8c")
    } else if (this._state === "done") {
      const ok = this._exitCode === 0
      const label = this._name ? `${this._lang}: ${this._name}` : this._lang
      this._headerText.content = new StyledText([
        { __isChunk: true, text: ok ? "✓ " : "✗ ", fg: ok ? parseColor("#50fa7b") : parseColor("#ff5555"), attributes: 0 },
        { __isChunk: true, text: label, fg: parseColor("#b0b0b0"), attributes: TextAttributes.BOLD },
        { __isChunk: true, text: ok ? "  done" : `  exit ${this._exitCode}`, fg: ok ? parseColor("#444444") : parseColor("#ff5555"), attributes: 0 },
        { __isChunk: true, text: "  enter", fg: parseColor("#666666"), attributes: TextAttributes.BOLD },
        { __isChunk: true, text: " to re-run", fg: parseColor("#444444"), attributes: 0 },
      ])
      this._codeBox.borderColor = ok ? parseColor("#50fa7b") : parseColor("#ff5555")
    }
  }

  private createOutputBox() {
    if (this._outputBox) {
      this.remove(this._outputBox.id)
    }
    if (this._stderrBox) {
      this.remove(this._stderrBox.id)
      this._stderrBox = null
      this._stderrCode = null
    }

    this._outputBox = new BoxRenderable(this.ctx, {
      id: `${this.id}-output`,
      flexDirection: "column",
      width: "100%",
      marginTop: 0,
      paddingLeft: 1,
      border: ["left"],
      borderColor: parseColor("#1a1a1a"),
    })

    this._outputCode = new CodeRenderable(this.ctx, {
      id: `${this.id}-output-code`,
      content: "",
      syntaxStyle: this._syntaxStyle,
      treeSitterClient: this._treeSitterClient,
      drawUnstyledText: true,
      width: "100%",
    })

    this._outputBox.add(this._outputCode)
    this.add(this._outputBox)
  }

  private createStderrBox() {
    this._stderrBox = new BoxRenderable(this.ctx, {
      id: `${this.id}-stderr`,
      flexDirection: "column",
      width: "100%",
      marginTop: 0,
      paddingLeft: 1,
      border: ["left"],
      borderColor: parseColor("#ff5555"),
    })

    this._stderrCode = new CodeRenderable(this.ctx, {
      id: `${this.id}-stderr-code`,
      content: "",
      syntaxStyle: this._syntaxStyle,
      treeSitterClient: this._treeSitterClient,
      drawUnstyledText: true,
      width: "100%",
      fg: parseColor("#ff5555"),
    })

    this._stderrBox.add(this._stderrCode)
    this.add(this._stderrBox)
  }

  private updateStderrDisplay() {
    if (!this._stderrBox) {
      this.createStderrBox()
    }
    if (!this._stderrCode) return
    const trimmed = this._stderr.replace(/\n$/, "")
    if (!trimmed) return
    this._stderrCode.content = trimmed
    this.requestRender()
  }

  private _filetypeDetected = false

  private detectFiletype(text: string): string | undefined {
    const t = text.trimStart()
    if (t.startsWith("{") || t.startsWith("[")) return "javascript"
    if (t.startsWith("<")) return "html"
    return undefined
  }

  private prettyPrint(text: string, filetype: string | undefined): string {
    if (filetype !== "javascript") return text
    try {
      return JSON.stringify(JSON.parse(text), null, 2)
    } catch {
      return text
    }
  }

  private updateOutputDisplay() {
    if (!this._outputCode) return
    const trimmed = this._output.replace(/\n$/, "")
    if (!trimmed) return

    if (!this._filetypeDetected) {
      const ft = this.detectFiletype(trimmed)
      if (ft) {
        this._outputCode.filetype = ft
        this._filetypeDetected = true
      }
    }

    this._outputCode.content = trimmed
    this.requestRender()
  }

  private finalizeOutput() {
    const hasStdout = this._output.trim().length > 0
    const hasStderr = this._stderr.trim().length > 0

    // Remove empty stdout box
    if (!hasStdout && this._outputBox) {
      this.remove(this._outputBox.id)
      this._outputBox = null
      this._outputCode = null
    }

    // Remove empty stderr box
    if (!hasStderr && this._stderrBox) {
      this.remove(this._stderrBox.id)
      this._stderrBox = null
      this._stderrCode = null
    }

    if (!hasStdout && !hasStderr) return

    const ok = this._exitCode === 0

    if (hasStdout && this._outputCode) {
      const trimmed = this._output.replace(/\n$/, "")
      const filetype = this.detectFiletype(trimmed)
      const formatted = this.prettyPrint(trimmed, filetype)
      if (filetype) this._outputCode.filetype = filetype
      this._outputCode.content = formatted
    }

    if (this._outputBox) {
      this._outputBox.borderColor = ok ? parseColor("#1a1a1a") : parseColor("#ff5555")
    }

    if (hasStderr && this._stderrCode) {
      this._stderrCode.content = this._stderr.replace(/\n$/, "")
    }

    this._filetypeDetected = false
  }

  public override focus(): void {
    super.focus()
    this._codeBox.borderColor = parseColor("#bd93f9")
    this.requestRender()
  }

  public override blur(): void {
    super.blur()
    if (this._state === "idle") {
      this._codeBox.borderColor = parseColor("#1a1a1a")
    }
    this.requestRender()
  }
}

interface FocusState {
  blocks: RunBlockRenderable[]
  focusIndex: number
  focusedDocIndex: number  // persisted across re-renders
  counter: number
}

export function App({ content: initialContent, filename, cwd, filePath, env, version }: {
  content: string
  filename: string
  cwd: string
  filePath: string
  env: Record<string, string>
  version: string
}) {
  const renderer = useRenderer()
  const [mode, setMode] = useState<Mode>("normal")
  const [content, setContent] = useState(initialContent)
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null)
  const editorRef = useRef<TextareaRenderable | null>(null)
  const treeSitterClient = getTreeSitterClient()
  const focus = useRef<FocusState>({ blocks: [], focusIndex: -1, focusedDocIndex: -1, counter: 0 })

  useEffect(() => {
    focus.current.blocks = []
    focus.current.focusIndex = -1
    focus.current.focusedDocIndex = -1
    focus.current.counter = 0
    checkForUpdate(version).then(setUpdateAvailable)
  }, [])

  const handleRenderNode = useCallback((token: Token, context: RenderNodeContext): Renderable | undefined | null => {
    if (token.type === "code") {
      const codeToken = token as Tokens.Code
      const meta = parseInfoString(codeToken.lang)

      if (isShellLang(meta)) {
        const docIndex = focus.current.counter++
        const block = new RunBlockRenderable(renderer!, {
          id: `runblock-${docIndex}`,
          code: codeToken.text,
          lang: meta.lang || "sh",
          name: meta.name,
          cwd,
          env,
          syntaxStyle: context.syntaxStyle,
          treeSitterClient: context.treeSitterClient,
        })
        focus.current.blocks.push(block)

        // Restore focus if this block matches the previously focused doc index
        if (docIndex === focus.current.focusedDocIndex) {
          focus.current.focusIndex = focus.current.blocks.length - 1
          queueMicrotask(() => block.focus())
        }

        return block
      }
    }
    return context.defaultRender()
  }, [cwd, renderer])

  useKeyboard((key) => {
    const f = focus.current

    if (mode === "normal") {
      if (key.name === "c" && key.ctrl) {
        const focused = f.focusIndex >= 0 ? f.blocks[f.focusIndex] : null
        if (focused && focused.state === "running") {
          focused.cancel()
        } else {
          killAllProcesses()
          renderer?.destroy()
        }
        key.preventDefault()
        return
      }

      if (key.name === "q" && !key.ctrl && !key.meta) {
        killAllProcesses()
        renderer?.destroy()
      }

      if (key.name === "i") {
        key.preventDefault()
        // Reset blocks but preserve focusedDocIndex for restoration
        f.blocks = []
        f.focusIndex = -1
        f.counter = 0
        setMode("insert")
      }

      if (key.name === "tab" && f.blocks.length > 0) {
        key.preventDefault()
        if (f.focusIndex >= 0 && f.focusIndex < f.blocks.length) {
          f.blocks[f.focusIndex]!.blur()
        }
        f.focusIndex = key.shift
          ? (f.focusIndex - 1 + f.blocks.length) % f.blocks.length
          : (f.focusIndex + 1) % f.blocks.length
        f.focusedDocIndex = f.focusIndex
        f.blocks[f.focusIndex]!.focus()
      }
    }

    if (mode === "insert") {
      if (key.name === "escape") {
        key.preventDefault()
        if (editorRef.current) {
          const text = editorRef.current.editBuffer.getText()
          if (text !== content) {
            setContent(text)
            Bun.write(filePath, text)
          }
        }
        // Reset blocks but preserve focusedDocIndex
        f.blocks = []
        f.focusIndex = -1
        f.counter = 0
        setMode("normal")
      }
    }
  })

  return (
    <box style={{ flexDirection: "column", width: "100%", height: "100%" }}>
      {/* Title bar */}
      <box style={{
        width: "100%",
        height: 1,
        flexDirection: "row",
        backgroundColor: parseColor("#000000"),
      }}>
        <box style={{
          backgroundColor: mode === "normal" ? parseColor("#bd93f9") : parseColor("#50fa7b"),
          height: 1,
        }}>
          <text content={mode === "normal" ? " NORMAL " : " INSERT "} style={{
            fg: parseColor("#000000"),
            attributes: TextAttributes.BOLD,
          }} />
        </box>
        <text content={` ${filename}`} style={{
          fg: parseColor("#666666"),
          attributes: TextAttributes.BOLD,
        }} />
        <text content="" style={{ flexGrow: 1 }} />
        {updateAvailable && (
          <text content="Update Available! " style={{
            fg: parseColor("#f1fa8c"),
            attributes: TextAttributes.BOLD,
          }} />
        )}
        <text content={`v${version} `} style={{
          fg: parseColor("#444444"),
        }} />
      </box>

      {/* Main content area */}
      {mode === "normal" ? (
        <scrollbox
          focused
          style={{
            flexGrow: 1,
            contentOptions: {
              padding: 1,
            },
          }}
        >
          <markdown
            content={content}
            syntaxStyle={syntaxStyle}
            conceal
            treeSitterClient={treeSitterClient}
            renderNode={handleRenderNode}
          />
        </scrollbox>
      ) : (
        <textarea
          ref={editorRef}
          initialValue={content}
          focused
          backgroundColor={parseColor("#000000")}
          textColor={parseColor("#b0b0b0")}
          focusedBackgroundColor={parseColor("#000000")}
          focusedTextColor={parseColor("#b0b0b0")}
          syntaxStyle={syntaxStyle}
          style={{
            flexGrow: 1,
            padding: 1,
          }}
        />
      )}

      {/* Status bar */}
      <box style={{
        width: "100%",
        paddingLeft: 1,
        paddingRight: 1,
        height: 1,
        backgroundColor: parseColor("#000000"),
      }}>
        <text content="" style={{ flexGrow: 1 }} />
        {mode === "normal" ? (
          <text style={{ fg: parseColor("#444444") }}>
            <span fg={parseColor("#bd93f9")}>i</span>
            <span> edit  </span>
            <span>↑↓ scroll  </span>
            <span fg={parseColor("#bd93f9")}>tab</span>
            <span> next block  </span>
            <span fg={parseColor("#bd93f9")}>enter</span>
            <span> run  </span>
            <span fg={parseColor("#bd93f9")}>q</span>
            <span> quit</span>
          </text>
        ) : (
          <text style={{ fg: parseColor("#444444") }}>
            <span fg={parseColor("#bd93f9")}>esc</span>
            <span> save & exit edit</span>
          </text>
        )}
      </box>
    </box>
  )
}
