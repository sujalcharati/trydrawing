import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ToolNavbar } from "./Components/ToolNavbar"
import { PropertiesPanel } from "./Components/PropertiesPanel"

type Point = { x: number; y: number }
type ElementType = "pen" | "eraser" | "select" | "rectangle" | "diamond" | "ellipse" | "arrow" | "line" | "text" | "image"

type Element = {
  id: string
  type: ElementType
  text?: string
  x: number
  y: number
  width: number
  height: number
  strokeColor: string
  strokeWidth: number
  fontSize: number
  points: Point[]
}

const FONT_SIZE   = 16
const LINE_HEIGHT = FONT_SIZE * 1.35
const PAD_X       = 4
const PAD_Y       = 2

function hitTestText(ctx: CanvasRenderingContext2D, point: Point, el: Element): boolean {
  ctx.font = `${el.fontSize}px sans-serif`
  const lines = (el.text ?? "").split("\n")
  const maxW  = Math.max(...lines.map(l => ctx.measureText(l).width), 20)
  const h     = lines.length * LINE_HEIGHT + PAD_Y * 2
  return (
    point.x >= el.x - 4 && point.x <= el.x + maxW + PAD_X * 2 + 4 &&
    point.y >= el.y - 4 && point.y <= el.y + h + 4
  )
}

function drawElement(ctx: CanvasRenderingContext2D, el: Element) {
  ctx.strokeStyle = el.strokeColor
  ctx.lineWidth   = el.strokeWidth

  switch (el.type) {
    case "pen":
      ctx.beginPath()
      el.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
      ctx.stroke()
      break
    case "rectangle":
      ctx.strokeRect(el.x, el.y, el.width, el.height)
      break
    case "ellipse": {
      const cx = el.x + el.width / 2, cy = el.y + el.height / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, Math.abs(el.width / 2), Math.abs(el.height / 2), 0, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case "line":
      ctx.beginPath()
      ctx.moveTo(el.x, el.y)
      ctx.lineTo(el.x + el.width, el.y + el.height)
      ctx.stroke()
      break
    case "diamond": {
      const cx = el.x + el.width / 2, cy = el.y + el.height / 2
      ctx.beginPath()
      ctx.moveTo(cx, el.y)
      ctx.lineTo(el.x + el.width, cy)
      ctx.lineTo(cx, el.y + el.height)
      ctx.lineTo(el.x, cy)
      ctx.closePath()
      ctx.stroke()
      break
    }
    case "arrow": {
      const ex = el.x + el.width, ey = el.y + el.height
      const ang = Math.atan2(el.height, el.width)
      const hl = 15, ha = Math.PI / 7
      ctx.beginPath()
      ctx.moveTo(el.x, el.y)
      ctx.lineTo(ex, ey)
      ctx.lineTo(ex - hl * Math.cos(ang - ha), ey - hl * Math.sin(ang - ha))
      ctx.moveTo(ex, ey)
      ctx.lineTo(ex - hl * Math.cos(ang + ha), ey - hl * Math.sin(ang + ha))
      ctx.stroke()
      break
    }
    case "text": {
      ctx.fillStyle    = el.strokeColor
      ctx.font         = `${el.fontSize}px sans-serif`
      ctx.textAlign    = "left"
      ctx.textBaseline = "top"
      ;(el.text ?? "").split("\n").forEach((line, i) => {
        ctx.fillText(line, el.x + PAD_X, el.y + PAD_Y + i * LINE_HEIGHT)
      })
      ctx.textBaseline = "alphabetic"
      break
    }
    default: break
  }
}

function App() {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const ctxRef      = useRef<CanvasRenderingContext2D | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isDrawingRef      = useRef(false)
  const elementRefs       = useRef<Element[]>([])
  const currentElementRef = useRef<Element | null>(null)
  const historyRef        = useRef<Element[][]>([])
  const redoRef           = useRef<Element[][]>([])
  const editingElRef      = useRef<Element | null>(null)

  const [activeTool, setActiveTool]   = useState("pen")
  const [strokeColor, setStrokeColor] = useState("#ffffff")
  const [bgColor,     setBgColor]     = useState("transparent")
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [opacity,     setOpacity]     = useState(100)
  const [textPos, setTextPos]         = useState<{ x: number; y: number } | null>(null)

  // ── Canvas setup ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.lineCap  = "round"
    ctx.lineJoin = "round"
    ctxRef.current = ctx
  }, [])

  const redraw = (skipId?: string) => {
    const ctx = ctxRef.current, canvas = canvasRef.current
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    elementRefs.current.forEach(el => {
      if (skipId && el.id === skipId) return
      drawElement(ctx, el)
    })
  }

  // ── Undo / Redo ───────────────────────────────────────────────────────────────

  const undo = () => {
    if (!historyRef.current.length) return
    redoRef.current.push([...elementRefs.current])
    elementRefs.current = historyRef.current.pop()!
    redraw()
  }

  const redo = () => {
    if (!redoRef.current.length) return
    historyRef.current.push([...elementRefs.current])
    elementRefs.current = redoRef.current.pop()!
    redraw()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (textPos) return
      if (e.ctrlKey && e.key === "z") undo()
      if (e.ctrlKey && e.key === "y") redo()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textPos])

  // ── Open editor ───────────────────────────────────────────────────────────────
  // useLayoutEffect fires before paint so the caret appears on frame 1.

  useLayoutEffect(() => {
    if (!textPos) return
    const ta = textareaRef.current
    if (!ta) return
    ta.value = editingElRef.current?.text ?? ""
    ta.style.height = "auto"
    ta.style.height = `${ta.scrollHeight}px`
    ta.style.width  = "auto"
    ta.style.width  = `${ta.scrollWidth + PAD_X * 2}px`
    ta.focus()
    ta.selectionStart = ta.selectionEnd = ta.value.length
  }, [textPos])

  // ── Commit / cancel ───────────────────────────────────────────────────────────

  const commitText = () => {
    const ta  = textareaRef.current
    const val = ta?.value ?? ""
    const pos = textPos

    if (editingElRef.current) {
      const idx = elementRefs.current.findIndex(e => e.id === editingElRef.current!.id)
      if (idx !== -1) {
        if (val.trim()) {
          elementRefs.current[idx] = { ...elementRefs.current[idx], text: val }
        } else {
          elementRefs.current.splice(idx, 1)
        }
      }
      editingElRef.current = null
    } else if (pos && val.trim()) {
      elementRefs.current.push({
        id: crypto.randomUUID(), type: "text", text: val,
        x: pos.x, y: pos.y, width: 0, height: 0,
        strokeColor, strokeWidth, fontSize: FONT_SIZE, points: [],
      })
    }

    redraw()
    setTextPos(null)
  }

  const cancelText = () => {
    editingElRef.current = null
    redraw()
    setTextPos(null)
  }

  // Stable ref so the rAF-deferred listener always calls the latest commitText
  const commitRef = useRef(commitText)
  commitRef.current = commitText

  // "Click elsewhere to commit". Register via rAF so the opening click (which
  // set textPos) has already fully propagated and won't immediately close the editor.
  useEffect(() => {
    if (!textPos) return
    let active = false
    const rId = requestAnimationFrame(() => {
      active = true
      window.addEventListener("pointerdown", onOutsideClick, true)
    })
    function onOutsideClick(e: PointerEvent) {
      if (!textareaRef.current?.contains(e.target as Node)) commitRef.current()
    }
    return () => {
      cancelAnimationFrame(rId)
      if (active) window.removeEventListener("pointerdown", onOutsideClick, true)
    }
  }, [textPos])

  // ── Pointer events ────────────────────────────────────────────────────────────

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getPoint(e)

    if (activeTool === "text") {
      // Prevent the canvas from receiving browser focus so it can't steal focus
      // back from the textarea after useLayoutEffect calls ta.focus().
      e.preventDefault()

      const ctx = ctxRef.current
      const hit = ctx
        ? elementRefs.current.find(el => el.type === "text" && hitTestText(ctx, point, el))
        : undefined

      historyRef.current.push([...elementRefs.current])
      redoRef.current = []

      if (hit) {
        editingElRef.current = hit
        redraw(hit.id)
        setTextPos({ x: hit.x, y: hit.y })
      } else {
        editingElRef.current = null
        setTextPos({ x: point.x, y: point.y })
      }
      return
    }

    isDrawingRef.current = true
    historyRef.current.push([...elementRefs.current])
    redoRef.current = []

    const el: Element = {
      id: crypto.randomUUID(), type: activeTool as ElementType,
      x: point.x, y: point.y, width: 0, height: 0,
      strokeColor, strokeWidth, fontSize: FONT_SIZE, points: [point],
    }
    elementRefs.current.push(el)
    currentElementRef.current = el
    redraw()
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentElementRef.current) return
    const point = getPoint(e)
    const el    = currentElementRef.current
    switch (el.type) {
      case "pen": el.points.push(point); break
      case "rectangle": case "ellipse": case "line": case "diamond": case "arrow":
        el.width = point.x - el.x; el.height = point.y - el.y; break
    }
    redraw()
  }

  const handlePointerUp = () => {
    isDrawingRef.current      = false
    currentElementRef.current = null
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const isEditing = textPos !== null

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1e1e2e]">

      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-10">
        <ToolNavbar activeTool={activeTool} setActiveTool={setActiveTool} />
      </div>

      <PropertiesPanel
        strokeColor={strokeColor} setStrokeColor={setStrokeColor}
        bgColor={bgColor}         setBgColor={setBgColor}
        strokeWidth={strokeWidth} setStrokeWidth={setStrokeWidth}
        opacity={opacity}         setOpacity={setOpacity}
      />

      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`absolute inset-0 touch-none ${
          isEditing
            ? "pointer-events-none"
            : activeTool === "text" ? "cursor-text" : "cursor-crosshair"
        }`}
      />

      {/* Always in the DOM — parked at -9999 when inactive to avoid
          mount/unmount focus-timing races with StrictMode. */}
      <textarea
        ref={textareaRef}
        rows={1}
        spellCheck={false}
        style={{
          position     : "fixed",
          left         : textPos ? textPos.x : -9999,
          top          : textPos ? textPos.y  : -9999,
          zIndex       : 99999,
          fontSize     : FONT_SIZE,
          fontFamily   : "sans-serif",
          lineHeight   : `${LINE_HEIGHT}px`,
          padding      : `${PAD_Y}px ${PAD_X}px`,
          color        : strokeColor,
          caretColor   : strokeColor,
          background   : "transparent",
          border       : "none",
          outline      : "none",
          resize       : "none",
          overflow     : "hidden",
          minWidth     : "80px",
          minHeight    : `${LINE_HEIGHT + PAD_Y * 2}px`,
          whiteSpace   : "pre",
          boxSizing    : "border-box",
          pointerEvents: isEditing ? "auto" : "none",
        }}
        onInput={(e) => {
          const ta = e.currentTarget
          ta.style.height = "auto"
          ta.style.height = `${ta.scrollHeight}px`
          ta.style.width  = "auto"
          ta.style.width  = `${ta.scrollWidth + PAD_X * 2}px`
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitText() }
          if (e.key === "Escape")               { e.preventDefault(); cancelText() }
        }}
      />
    </div>
  )
}

export default App