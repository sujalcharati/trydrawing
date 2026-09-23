import { Lock, Hand, MousePointer2, Square, Diamond, Circle, MoveUpRight, Minus, PenLine, Type, Eraser } from "lucide-react"

const tools = [
    { id: "hand",     icon: Hand,          key: "H"  },
    { id: "select",    icon: MousePointer2, key: "1"  },
    { id: "rectangle", icon: Square,        key: "2"  },
    { id: "diamond",   icon: Diamond,       key: "3"  },
    { id: "ellipse",   icon: Circle,        key: "4"  },
    { id: "arrow",     icon: MoveUpRight,   key: "5"  },
    { id: "line",      icon: Minus,         key: "6"  },
    { id: "pen",       icon: PenLine,       key: "7"  },
    { id: "text",      icon: Type,          key: "8"  },
    { id: "eraser",    icon: Eraser,        key: "9"  },
]

type ToolNavbarProps = { 
    activeTool: string;
    setActiveTool: (tool: string) => void;
    isLocked: boolean;
    setIsLocked: (locked: boolean) => void;
}

export const ToolNavbar = ({ activeTool, setActiveTool, isLocked, setIsLocked }: ToolNavbarProps) => {
    return (
        <div className="flex items-center gap-0.5 h-11 px-2 bg-[#232329] rounded-xl border border-white/10">
            {/* lock is a toggle, not a tool: keeps the active tool after drawing */}
            <button
                onClick={() => setIsLocked(!isLocked)}
                title="Keep selected tool active after drawing"
                aria-pressed={isLocked}
                className={`relative p-2 rounded-lg transition-colors ${
                    isLocked
                        ? "bg-[#403e6a] text-white"
                        : "text-gray-400 hover:bg-white/10"
                }`}
            >
                <Lock size={18} />
            </button>

            {tools.map((tool, i) => {
                const Icon = tool.icon
                const isActive = activeTool === tool.id
                return (
                    <>
                        {/* divider before "select" to match Excalidraw grouping */}
                        {i === 1 && <div key="div1" className="w-px h-5 bg-white/10 mx-1" />}

                        <button
                            key={tool.id}
                            onClick={() => setActiveTool(tool.id)}
                            className={`relative p-2 rounded-lg transition-colors ${
                                isActive
                                    ? "bg-[#403e6a] text-white"
                                    : "text-gray-400 hover:bg-white/10"
                            }`}
                        >
                            <Icon size={18} />
                        </button>
                    </>
                )
            })}


        </div>
    )
}