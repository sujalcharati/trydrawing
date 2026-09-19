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

const FONT_SIZE         = 16
const LINE_HEIGHT_RATIO = 1.35
const PAD_X             = 4
const PAD_Y             = 2
const SEL_PAD           = 4
const HANDLE_SIZE       = 8

type Bounds = { minX: number; minY: number; maxX: number; maxY: number }
type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"

const HANDLE_CURSORS: Record<Handle, string> = {
  nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize",
  n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
}

// Axis-aligned bounding box of an element in world coordinates
function getBounds(ctx: CanvasRenderingContext2D, el: Element): Bounds {
  switch (el.type) {
    case "pen": {
      const xs = el.points.map(p => p.x), ys = el.points.map(p => p.y)
      return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
    }
    case "text": {
      ctx.font = `${el.fontSize}px sans-serif`
      const lines = (el.text ?? "").split("\n")
      const maxW  = Math.max(...lines.map(l => ctx.measureText(l).width), 20)
      const h     = lines.length * el.fontSize * LINE_HEIGHT_RATIO + PAD_Y * 2
      return { minX: el.x, minY: el.y, maxX: el.x + maxW + PAD_X * 2, maxY: el.y + h }
    }
    default:
      return {
        minX: Math.min(el.x, el.x + el.width),  minY: Math.min(el.y, el.y + el.height),
        maxX: Math.max(el.x, el.x + el.width),  maxY: Math.max(el.y, el.y + el.height),
      }
  }
}

function hitTestText(ctx: CanvasRenderingContext2D, point: Point, el: Element): boolean {
  const b = getBounds(ctx, el)
  return point.x >= b.minX - 4 && point.x <= b.maxX + 4 && point.y >= b.minY - 4 && point.y <= b.maxY + 4
}

// Shortest distance from point p to line segment a-b
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

// Returns true if point is within threshold pixels of any part of the element
function hitTestElement(ctx: CanvasRenderingContext2D, point: Point, el: Element, threshold = 8): boolean {
  switch (el.type) {
    case "pen": { 
      for (let i = 1; i < el.points.length; i++) {
        if (distToSegment(point, el.points[i - 1], el.points[i]) <= threshold) return true
      }
      return false
    }
    case "text":
      return hitTestText(ctx, point, el)
    default: {
      const x1 = Math.min(el.x, el.x + el.width)  - threshold
      const y1 = Math.min(el.y, el.y + el.height) - threshold
      const x2 = Math.max(el.x, el.x + el.width)  + threshold
      const y2 = Math.max(el.y, el.y + el.height) + threshold
      return point.x >= x1 && point.x <= x2 && point.y >= y1 && point.y <= y2
    }
  }
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
      const lh = el.fontSize * LINE_HEIGHT_RATIO
      ;(el.text ?? "").split("\n").forEach((line, i) => {
        ctx.fillText(line, el.x + PAD_X, el.y + PAD_Y + i * lh)
      })
      ctx.textBaseline = "alphabetic"
      break
    }
    default: break
  }
}

function handlePositions(b: Bounds): Record<Handle, Point> {
  const x1 = b.minX - SEL_PAD, y1 = b.minY - SEL_PAD, x2 = b.maxX + SEL_PAD, y2 = b.maxY + SEL_PAD
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  return {
    nw: { x: x1, y: y1 }, n: { x: mx, y: y1 }, ne: { x: x2, y: y1 },
    e:  { x: x2, y: my },
    se: { x: x2, y: y2 }, s: { x: mx, y: y2 }, sw: { x: x1, y: y2 },
    w:  { x: x1, y: my },
  }
}

function hitHandle(b: Bounds, p: Point): Handle | null {
  const r = HANDLE_SIZE / 2 + 2
  for (const [name, pos] of Object.entries(handlePositions(b)) as [Handle, Point][]) {
    if (Math.abs(p.x - pos.x) <= r && Math.abs(p.y - pos.y) <= r) return name
  }
  return null
}

function inPaddedBounds(b: Bounds, p: Point): boolean {
  return p.x >= b.minX - SEL_PAD && p.x <= b.maxX + SEL_PAD && p.y >= b.minY - SEL_PAD && p.y <= b.maxY + SEL_PAD
}

function drawSelection(ctx: CanvasRenderingContext2D, b: Bounds) {
  ctx.save()
  ctx.lineWidth   = 1
  ctx.strokeStyle = "#6965db"
  ctx.strokeRect(b.minX - SEL_PAD, b.minY - SEL_PAD, b.maxX - b.minX + SEL_PAD * 2, b.maxY - b.minY + SEL_PAD * 2)
  ctx.fillStyle = "#232329"
  for (const pos of Object.values(handlePositions(b))) {
    ctx.fillRect(pos.x - HANDLE_SIZE / 2, pos.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
    ctx.strokeRect(pos.x - HANDLE_SIZE / 2, pos.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
  }
  ctx.restore()
}

// Elements are replaced, never mutated, so undo snapshots stay intact
function moveElement(el: Element, dx: number, dy: number): Element {
  return { ...el, x: el.x + dx, y: el.y + dy, points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy })) }
}

function resizeElement(orig: Element, oldB: Bounds, handle: Handle, dx: number, dy: number): Element {
  const MIN  = 4
  const oldW = oldB.maxX - oldB.minX, oldH = oldB.maxY - oldB.minY
  let { minX, minY, maxX, maxY } = oldB

  // an axis with no extent (e.g. a flat line) can't be scaled
  if (oldW > 1) {
    if (handle.includes("w")) minX = Math.min(minX + dx, maxX - MIN)
    if (handle.includes("e")) maxX = Math.max(maxX + dx, minX + MIN)
  }
  if (oldH > 1) {
    if (handle.includes("n")) minY = Math.min(minY + dy, maxY - MIN)
    if (handle.includes("s")) maxY = Math.max(maxY + dy, minY + MIN)
  }
  const sx = oldW > 1 ? (maxX - minX) / oldW : 1
  const sy = oldH > 1 ? (maxY - minY) / oldH : 1

  if (orig.type === "text") {
    const s = handle.length === 2 ? Math.max(sx, sy) : (handle === "e" || handle === "w" ? sx : sy)
    const fontSize = Math.min(400, Math.max(6, orig.fontSize * s))
    const k = fontSize / orig.fontSize
    return {
      ...orig, fontSize,
      x: handle.includes("w") ? oldB.maxX - oldW * k : oldB.minX,
      y: handle.includes("n") ? oldB.maxY - oldH * k : oldB.minY,
    }
  }

  const mapX = (v: number) => minX + (v - oldB.minX) * sx
  const mapY = (v: number) => minY + (v - oldB.minY) * sy
  const x = mapX(orig.x), y = mapY(orig.y)
  return {
    ...orig, x, y,
    width:  mapX(orig.x + orig.width)  - x,
    height: mapY(orig.y + orig.height) - y,
    points: orig.points.map(p => ({ x: mapX(p.x), y: mapY(p.y) })),
  }
}

function App() {  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const ctxRef      = useRef<CanvasRenderingContext2D | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isDrawingRef      = useRef(false)
  const elementRefs       = useRef<Element[]>([])
  const currentElementRef = useRef<Element | null>(null)
  const historyRef        = useRef<Element[][]>([])
  const redoRef           = useRef<Element[][]>([])
  const editingElRef      = useRef<Element | null>(null)
  const panRef            = useRef<Point>({ x: 0, y: 0 })
  const panStartRef       = useRef<{ mouse: Point; pan: Point } | null>(null)
  const selectedIdRef     = useRef<string | null>(null)
  const activeToolRef     = useRef("pen")
  const dragRef           = useRef<{
    mode: "move" | "resize"; start: Point; orig: Element
    origBounds: Bounds; handle: Handle | null; pushed: boolean
  } | null>(null)
  const [activeTool, setActiveTool]   = useState("pen")
  const [strokeColor, setStrokeColor] = useState("#ffffff")
  const [bgColor,     setBgColor]     = useState("transparent")
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [opacity,     setOpacity]     = useState(100)
  const [textPos, setTextPos] = useState<{ x: number; y: number; sx: number; sy: number; fontSize: number } | null>(null)
  const [isLocked, setIsLocked] = useState(false);
  const [isPanning, setIsPanning] = useState(false)

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
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.translate(panRef.current.x, panRef.current.y)
    elementRefs.current.forEach(el => {
      if (skipId && el.id === skipId) return
      drawElement(ctx, el)
    })
    if (activeToolRef.current === "select" && selectedIdRef.current) {
      const sel = elementRefs.current.find(e => e.id === selectedIdRef.current)
      if (sel) drawSelection(ctx, getBounds(ctx, sel))
      else selectedIdRef.current = null
    }
  }

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
      if ((e.key === "Delete" || e.key === "Backspace") && activeToolRef.current === "select" && selectedIdRef.current) {
        historyRef.current.push([...elementRefs.current])
        redoRef.current = []
        elementRefs.current = elementRefs.current.filter(el => el.id !== selectedIdRef.current)
        selectedIdRef.current = null
        redraw()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textPos])

  // leaving the select tool drops the selection and any hover cursor
  useEffect(() => {
    activeToolRef.current = activeTool
    if (activeTool !== "select") selectedIdRef.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = ""
    redraw()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool])

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
    if (!isLocked) setActiveTool("select")
  }

  const cancelText = () => {
    editingElRef.current = null
    redraw()
    setTextPos(null)
    if (!isLocked) setActiveTool("select")
  }

  const commitRef = useRef(commitText)
  commitRef.current = commitText

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

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left - panRef.current.x, y: e.clientY - rect.top - panRef.current.y }
  }

  const updateHoverCursor = (ctx: CanvasRenderingContext2D, point: Point) => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cursor = "default"
    const sel = elementRefs.current.find(el => el.id === selectedIdRef.current)
    if (sel) {
      const b = getBounds(ctx, sel)
      const h = hitHandle(b, point)
      if (h) cursor = HANDLE_CURSORS[h]
      else if (inPaddedBounds(b, point)) cursor = "move"
    }
    if (cursor === "default" && elementRefs.current.some(el => hitTestElement(ctx, point, el))) cursor = "move"
    canvas.style.cursor = cursor
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {    const point = getPoint(e)

    if (activeTool === "hand") {
      e.currentTarget.setPointerCapture(e.pointerId)
      panStartRef.current = { mouse: { x: e.clientX, y: e.clientY }, pan: { ...panRef.current } }
      setIsPanning(true)
      return
    }

    if (activeTool === "select") {
      const ctx = ctxRef.current
      if (!ctx) return
      let target: Element | undefined
      let handle: Handle | null = null
      const sel = elementRefs.current.find(el => el.id === selectedIdRef.current)
      if (sel) {
        const b = getBounds(ctx, sel)
        handle = hitHandle(b, point)
        if (handle || inPaddedBounds(b, point)) target = sel
      }
      if (!target) {
        for (let i = elementRefs.current.length - 1; i >= 0; i--) {
          if (hitTestElement(ctx, point, elementRefs.current[i])) { target = elementRefs.current[i]; break }
        }
      }
      selectedIdRef.current = target?.id ?? null
      if (target) {
        e.currentTarget.setPointerCapture(e.pointerId)
        dragRef.current = {
          mode: handle ? "resize" : "move", start: point, orig: target,
          origBounds: getBounds(ctx, target), handle, pushed: false,
        }
      }
      redraw()
      return
    }

    if (activeTool === "text") {
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
        setTextPos({ x: hit.x, y: hit.y, sx: hit.x + panRef.current.x, sy: hit.y + panRef.current.y, fontSize: hit.fontSize })
      } else {
        editingElRef.current = null
        setTextPos({ x: point.x, y: point.y, sx: point.x + panRef.current.x, sy: point.y + panRef.current.y, fontSize: FONT_SIZE })
      }
      return
    }

    if (activeTool === "eraser") {
      isDrawingRef.current = true
      historyRef.current.push([...elementRefs.current])
      redoRef.current = []
      // Also erase whatever is directly under the initial click
      const ctx = ctxRef.current
      if (ctx) {
        const before = elementRefs.current.length
        elementRefs.current = elementRefs.current.filter(el => !hitTestElement(ctx, point, el))
        if (elementRefs.current.length !== before) redraw()
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
    if (panStartRef.current) {
      const { mouse, pan } = panStartRef.current
      panRef.current = { x: pan.x + e.clientX - mouse.x, y: pan.y + e.clientY - mouse.y }
      redraw()
      return
    }

    if (activeTool === "select") {
      const ctx = ctxRef.current
      if (!ctx) return
      const point = getPoint(e)
      const drag  = dragRef.current
      if (!drag) { updateHoverCursor(ctx, point); return }
      const dx = point.x - drag.start.x, dy = point.y - drag.start.y
      if (!drag.pushed) {
        if (!dx && !dy) return
        historyRef.current.push([...elementRefs.current])
        redoRef.current = []
        drag.pushed = true
      }
      const next = drag.mode === "move"
        ? moveElement(drag.orig, dx, dy)
        : resizeElement(drag.orig, drag.origBounds, drag.handle!, dx, dy)
      elementRefs.current = elementRefs.current.map(el => el.id === next.id ? next : el)
      redraw()
      return
    }

    // Eraser: delete any element the cursor sweeps over
    if (activeTool === "eraser" && isDrawingRef.current) {
      const ctx = ctxRef.current
      if (!ctx) return
      const point = getPoint(e)
      const before = elementRefs.current.length
      elementRefs.current = elementRefs.current.filter(el => !hitTestElement(ctx, point, el))
      if (elementRefs.current.length !== before) redraw()
      return
    }

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
    if (panStartRef.current) {
      panStartRef.current = null
      setIsPanning(false)
      return
    }
    if (dragRef.current) {
      dragRef.current = null
      return
    }
    const drawn = currentElementRef.current
    isDrawingRef.current      = false
    currentElementRef.current = null
    if (drawn && !isLocked) {
      selectedIdRef.current = drawn.id
      setActiveTool("select")
    }
  }

  const isEditing = textPos !== null
  const editFontSize = textPos?.fontSize ?? FONT_SIZE

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1e1e2e]">

      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-10">
        <ToolNavbar activeTool={activeTool} setActiveTool={setActiveTool} isLocked={isLocked} setIsLocked={setIsLocked} />
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
            : activeTool === "select" ? "cursor-default"
            : activeTool === "hand"   ? (isPanning ? "cursor-grabbing" : "cursor-grab")
            : activeTool === "text"   ? "cursor-text"
            : activeTool === "eraser" ? "cursor-cell"
            : "cursor-crosshair"
        }`}
      />

      <textarea
        ref={textareaRef}
        rows={1}
        spellCheck={false}
        style={{
          position     : "fixed",
          left         : textPos ? textPos.sx : -9999,
          top          : textPos ? textPos.sy : -9999,
          zIndex       : 99999,
          fontSize     : editFontSize,
          fontFamily   : "sans-serif",
          lineHeight   : `${editFontSize * LINE_HEIGHT_RATIO}px`,
          padding      : `${PAD_Y}px ${PAD_X}px`,
          color        : strokeColor,
          caretColor   : strokeColor,
          background   : "transparent",
          border       : "none",
          outline      : "none",
          resize       : "none",
          overflow     : "hidden",
          minWidth     : "80px",
          minHeight    : `${editFontSize * LINE_HEIGHT_RATIO + PAD_Y * 2}px`,
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
