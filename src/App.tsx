import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { ToolNavbar } from "./Components/ToolNavbar"
import { PropertiesPanel } from "./Components/PropertiesPanel"

type Point = { x: number; y: number };

type ElementType = "pen" | "eraser" | "select" | "rectangle" | "diamond" | "ellipse" | "arrow" | "line" | "text" | "image";

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
  points: Point[]
}

const drawElement = (ctx: CanvasRenderingContext2D, el: Element) => {
  ctx.strokeStyle = el.strokeColor
  ctx.lineWidth = el.strokeWidth

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
      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
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
      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
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
      const ex = el.x + el.width
      const ey = el.y + el.height
      const angle = Math.atan2(el.height, el.width)
      const headLen = 15
      const headAngle = Math.PI / 7
      ctx.beginPath()
      ctx.moveTo(el.x, el.y)
      ctx.lineTo(ex, ey)
      ctx.lineTo(ex - headLen * Math.cos(angle - headAngle), ey - headLen * Math.sin(angle - headAngle))
      ctx.moveTo(ex, ey)
      ctx.lineTo(ex - headLen * Math.cos(angle + headAngle), ey - headLen * Math.sin(angle + headAngle))
      ctx.stroke()
      break
    }

    case "text":
      ctx.fillStyle = el.strokeColor
      ctx.font = "16px sans-serif"
      ctx.fillText(el.text ?? "", el.x, el.y)
      break

    default:
      break
  }
}

function App() {
  const canvasref = useRef<HTMLCanvasElement>(null)
  const ctxref = useRef<CanvasRenderingContext2D | null>(null)
  const isDrawingRef = useRef(false)
  const elementRefs = useRef<Element[]>([])
  const currentElementRef = useRef<Element | null>(null)
  const historyRef = useRef<Element[][]>([])
  const redoRef = useRef<Element[][]>([])

  const [activeTool, setActiveTool]   = useState("pen")
  const [strokeColor, setStrokeColor] = useState("#ffffff")
  const [bgColor, setBgColor]         = useState("transparent")
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [opacity, setOpacity]         = useState(100)
  const [textInput, setTextInput]     = useState<{ x: number; y: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const redraw = () => {
    const ctx = ctxref.current
    const canvas = canvasref.current
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const el of elementRefs.current) {
      drawElement(ctx, el)
    }
  }

  useEffect(() => {
    const canvas = canvasref.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctxref.current = ctx
  }, [])

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = canvasref.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getPoint(e)

    if (activeTool === "text") {
      historyRef.current.push([...elementRefs.current])
      redoRef.current = []
      setTextInput({ x: point.x, y: point.y })
      return
    }

    isDrawingRef.current = true
    historyRef.current.push([...elementRefs.current])
    redoRef.current = []

    const element: Element = {
      id: crypto.randomUUID(),
      type: activeTool as ElementType,
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      strokeColor,
      strokeWidth,
      points: [point],
    }
    elementRefs.current.push(element)
    currentElementRef.current = element
    redraw()
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentElementRef.current) return
    const point = getPoint(e)
    const el = currentElementRef.current

    switch (el.type) {
      case "pen":
        el.points.push(point)
        break
      case "rectangle":
      case "ellipse":
      case "line":
      case "diamond":
      case "arrow":
        el.width  = point.x - el.x
        el.height = point.y - el.y
        break
    }
    redraw()
  }

  const handlePointerUp = () => {
    isDrawingRef.current = false
    currentElementRef.current = null
  }

  const commitText = (value: string, x: number, y: number) => {
    if (value.trim()) {
      const element: Element = {
        id: crypto.randomUUID(),
        type: "text",
        text: value,
        x,
        y,
        width: 0,
        height: 0,
        strokeColor,
        strokeWidth,
        points: [],
      }
      elementRefs.current.push(element)
      redraw()
    }
    setTextInput(null)
  }

  const handleUndo = () => {
    if (historyRef.current.length === 0) return
    redoRef.current.push([...elementRefs.current])
    elementRefs.current = historyRef.current.pop()!
    redraw()
  }

  const handleRedo = () => {
    if (redoRef.current.length === 0) return
    historyRef.current.push([...elementRefs.current])
    elementRefs.current = redoRef.current.pop()!
    redraw()
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "z") handleUndo()
      if (e.ctrlKey && e.key === "y") handleRedo()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [])

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
        ref={canvasref}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`absolute inset-0 touch-none ${textInput ? "pointer-events-none cursor-text" : "cursor-crosshair"}`}
      />

      {textInput && (
        <textarea
          autoFocus     
          style={{ position: "fixed", left: textInput.x, top: textInput.y }}
          className="bg-transparent outline-none text-white resize-none z-20 min-w-[100px] min-h-[24px] caret-white text-base border border-dashed border-white/50"
          onBlur={(e) => commitText(e.target.value, textInput.x, textInput.y)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setTextInput(null)
          }}
        />
      )}
    </div>
  )
}

export default App