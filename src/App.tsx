import { useEffect, useRef, useState  } from "react"
import { ToolNavbar } from "./Components/ToolNavbar"
import { PropertiesPanel } from "./Components/PropertiesPanel"

type Point = { x: number; y: number };

type ElementType = "pen" | "eraser" | "select" | "rectangle" | "diamond" | "ellipse" | "arrow" | "line" | "text" | "image";

type Element = { 
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  strokeColor: string
  strokeWidth: number
  points: Point[]
}

function App() {
    const canvasref = useRef<HTMLCanvasElement>(null);
    const ctxref = useRef<CanvasRenderingContext2D | null>(null);
    const isDrawingRef = useRef(false);
    const elementRefs = useRef<Element[]>([]);
  const currentElementRef = useRef<Element | null>(null);
  const historyRef = useRef<Element[][]>([]);
  const redoRef = useRef<Element[][]>([]);

    const [activeTool, setActiveTool]   = useState("pen");
    const [strokeColor, setStrokeColor] = useState("#ffffff");
    const [bgColor, setBgColor]         = useState("transparent");
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [opacity, setOpacity]         = useState(100);

    const redraw = () => {
        const ctx = ctxref.current;
        const canvas = canvasref.current;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const el of elementRefs.current) {
            ctx.strokeStyle = el.strokeColor;
            ctx.lineWidth = el.strokeWidth;

            if (el.type === "pen") {
                ctx.beginPath();
                el.points.forEach((p, i) => {
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.stroke();
            } else if (el.type === "rectangle") {
                ctx.strokeRect(el.x, el.y, el.width, el.height);
            }
        }
    }

    useEffect(() => {
        const canvas = canvasref.current;
        if (!canvas) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctxref.current = ctx;
    }, [])

    const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
        const rect = canvasref.current!.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      isDrawingRef.current = true;
      historyRef.current.push([...elementRefs.current]);
      redoRef.current = [];

      const point = getPoint(e);
      const element: Element = {
        id: crypto.randomUUID(),
        type: activeTool as ElementType,
        x: point.x,
        y: point.y,
        width: 0,
        height: 0,
        strokeColor: strokeColor,
        strokeWidth: strokeWidth,
        points: [point],
      }

      elementRefs.current.push(element);
      currentElementRef.current = element;
      redraw();
    }

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current || !currentElementRef.current) return;
      const point = getPoint(e);
      if (currentElementRef.current.type === "pen") {
        currentElementRef.current.points.push(point)
      } else if (currentElementRef.current.type === "rectangle") {
        currentElementRef.current.width = point.x - currentElementRef.current.x;
        currentElementRef.current.height = point.y - currentElementRef.current.y;
      }
      redraw();
    }

    const handlePointerUp = () => {
        isDrawingRef.current = false;
      currentElementRef.current = null;
    }

    const handleUndo = () => {
      if (historyRef.current.length === 0) return;
      redoRef.current.push([...elementRefs.current]);
      elementRefs.current = [...historyRef.current.pop()!];
      redraw();
    }


    const handleRedo = () => {
      if (redoRef.current.length === 0) return;
      historyRef.current.push([...elementRefs.current]);
      elementRefs.current = [...redoRef.current.pop()!];
      redraw();
    }

    useEffect(() => {
      const handleKey = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === "z") handleUndo();
        if (e.ctrlKey && e.key === "y") handleRedo();
      }
      window.addEventListener("keydown", handleKey);
      return () => {
        window.removeEventListener("keydown", handleKey);
      }
    }, [])

    return (
      <div className="relative w-screen h-screen overflow-hidden bg-[#1e1e2e]">

        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-10">
          <ToolNavbar activeTool={activeTool} setActiveTool={setActiveTool}/>
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
            className="absolute inset-0 cursor-crosshair touch-none"
        />
      </div>
    )
}

export default App