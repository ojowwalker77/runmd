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
import { execShell } from "./lib/exec"
import { checkForUpdate } from "./lib/version"
import { resolve } from "path"

type Mode = "normal" | "insert"

const SHELL_LANGS = new Set(["sh", "bash", "shell", "zsh"])

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
  private _cwd: string
  private _state: "idle" | "running" | "done" = "idle"
  private _exitCode = 0
  private _output = ""
  private _headerText: TextRenderable
  private _codeBox: BoxRenderable
  private _outputBox: BoxRenderable | null = null

  private _env: Record<string, string>

  constructor(ctx: RenderContext, opts: {
    id: string
    code: string
    lang: string
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
    this._cwd = opts.cwd
    this._env = opts.env
    this._focusable = true

    this._headerText = new TextRenderable(ctx, {
      id: `${opts.id}-header`,
      content: new StyledText([
        { __isChunk: true, text: "▶ ", fg: parseColor("#666666"), attributes: 0 },
        { __isChunk: true, text: opts.lang, fg: parseColor("#b0b0b0"), attributes: TextAttributes.BOLD },
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

  override handleKeyPress(key: KeyEvent): boolean {
    if (key.name === "return" && this._state !== "running") {
      this.execute()
      key.preventDefault()
      return true
    }
    return false
  }

  private async execute() {
    this._state = "running"
    this.updateHeader()

    try {
      const result = await execShell(this._code, this._cwd, this._env)
      this._exitCode = result.exitCode
      this._output = result.stdout || result.stderr
      this._state = "done"
    } catch (e: any) {
      this._exitCode = 1
      this._output = e.message || "Execution failed"
      this._state = "done"
    }

    this.updateHeader()
    this.showOutput()
    this.requestRender()
  }

  private updateHeader() {
    if (this._state === "running") {
      this._headerText.content = new StyledText([
        { __isChunk: true, text: "⟳ ", fg: parseColor("#f1fa8c"), attributes: 0 },
        { __isChunk: true, text: "running...", fg: parseColor("#f1fa8c"), attributes: TextAttributes.ITALIC },
      ])
      this._codeBox.borderColor = parseColor("#f1fa8c")
    } else if (this._state === "done") {
      const ok = this._exitCode === 0
      this._headerText.content = new StyledText([
        { __isChunk: true, text: ok ? "✓ " : "✗ ", fg: ok ? parseColor("#50fa7b") : parseColor("#ff5555"), attributes: 0 },
        { __isChunk: true, text: this._lang, fg: parseColor("#b0b0b0"), attributes: TextAttributes.BOLD },
        { __isChunk: true, text: ok ? "  done" : `  exit ${this._exitCode}`, fg: ok ? parseColor("#444444") : parseColor("#ff5555"), attributes: 0 },
        { __isChunk: true, text: "  enter", fg: parseColor("#666666"), attributes: TextAttributes.BOLD },
        { __isChunk: true, text: " to re-run", fg: parseColor("#444444"), attributes: 0 },
      ])
      this._codeBox.borderColor = ok ? parseColor("#50fa7b") : parseColor("#ff5555")
    }
  }

  private showOutput() {
    if (this._outputBox) {
      this.remove(this._outputBox.id)
    }

    if (!this._output.trim()) return

    const trimmed = this._output.replace(/\n$/, "")
    const ok = this._exitCode === 0

    this._outputBox = new BoxRenderable(this.ctx, {
      id: `${this.id}-output`,
      flexDirection: "column",
      width: "100%",
      marginTop: 0,
      paddingLeft: 1,
      border: ["left"],
      borderColor: ok ? parseColor("#1a1a1a") : parseColor("#ff5555"),
    })

    this._outputBox.add(new TextRenderable(this.ctx, {
      id: `${this.id}-output-text`,
      content: new StyledText([{
        __isChunk: true,
        text: trimmed,
        fg: ok ? parseColor("#666666") : parseColor("#ff5555"),
        attributes: 0,
      }]),
      width: "100%",
    }))

    this.add(this._outputBox)
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

// Track all RunBlock instances for focus cycling
let runBlocks: RunBlockRenderable[] = []
let focusIndex = -1

function createRunBlock(
  ctx: RenderContext,
  token: Tokens.Code,
  index: number,
  cwd: string,
  env: Record<string, string>,
  style: SyntaxStyle,
  treeSitterClient?: any,
): RunBlockRenderable {
  const block = new RunBlockRenderable(ctx, {
    id: `runblock-${index}`,
    code: token.text,
    lang: token.lang || "sh",
    cwd,
    env,
    syntaxStyle: style,
    treeSitterClient,
  })
  runBlocks.push(block)
  return block
}

let blockCounter = 0

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

  useEffect(() => {
    runBlocks = []
    focusIndex = -1
    blockCounter = 0
    checkForUpdate(version).then(setUpdateAvailable)
  }, [])

  const handleRenderNode = useCallback((token: Token, context: RenderNodeContext): Renderable | undefined | null => {
    if (token.type === "code") {
      const codeToken = token as Tokens.Code
      const lang = (codeToken.lang || "").toLowerCase()

      if (SHELL_LANGS.has(lang)) {
        return createRunBlock(
          renderer!,
          codeToken,
          blockCounter++,
          cwd,
          env,
          context.syntaxStyle,
          context.treeSitterClient,
        )
      }
    }
    return context.defaultRender()
  }, [cwd, renderer])

  useKeyboard((key) => {
    if (mode === "normal") {
      if (key.name === "q" && !key.ctrl && !key.meta) {
        renderer?.destroy()
      }

      if (key.name === "i") {
        key.preventDefault()
        // Reset run blocks since we'll rebuild them on return
        runBlocks = []
        focusIndex = -1
        blockCounter = 0
        setMode("insert")
      }

      if (key.name === "tab" && runBlocks.length > 0) {
        key.preventDefault()
        if (focusIndex >= 0 && focusIndex < runBlocks.length) {
          runBlocks[focusIndex]!.blur()
        }
        focusIndex = key.shift
          ? (focusIndex - 1 + runBlocks.length) % runBlocks.length
          : (focusIndex + 1) % runBlocks.length
        runBlocks[focusIndex]!.focus()
      }
    }

    if (mode === "insert") {
      if (key.name === "escape") {
        key.preventDefault()
        // Auto-save and switch back to normal mode
        if (editorRef.current) {
          const text = editorRef.current.editBuffer.getText()
          if (text !== content) {
            setContent(text)
            Bun.write(filePath, text)
          }
        }
        runBlocks = []
        focusIndex = -1
        blockCounter = 0
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
