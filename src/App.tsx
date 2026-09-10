import { useEffect, useRef, useState  } from "react"
import { ToolNavbar } from "./Components/ToolNavbar"

type Point = { x: number; y: number };
// type Stroke = { points: Point[]; color: string; width: number };

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
              
            } else if (el.type === "rectangle")
                ctx.strokeRect(el.x, el.y, el.width, el.height);
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

      const point = getPoint(e);
      const element: Element = {
        id: crypto.randomUUID(),
        type: activeTool as ElementType,
        x: point.x,
        y: point.y,
        width: 0,
        height: 0,
        strokeColor: "white",
        strokeWidth: 1,
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

    const handleClear = () => {
        elementRefs.current = [];
        redraw();
    }

    const [activeTool, setActiveTool] = useState("pen");

    return (
      <div className="relative w-screen h-screen overflow-hidden bg-[#1e1e2e]">

        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-10">
          <ToolNavbar activeTool={activeTool} setActiveTool={setActiveTool}/>
        </div>
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