import { useEffect, useRef, useState } from "react"
import { Check, Copy, Share2 } from "lucide-react"

type Props = {
  roomId: string | null
  state: "idle" | "connecting" | "connected" | "disconnected"
  peers: number
  onStart: () => void   // creates a room; called the first time Share is clicked
}

const DOT = { idle: "bg-gray-500", connected: "bg-green-400", connecting: "bg-yellow-400", disconnected: "bg-red-400" }

export function ShareButton({ roomId, state, peers, onStart }: Props) {
  const [open, setOpen]     = useState(false)
  const [copied, setCopied] = useState(false)
  const rootRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    window.addEventListener("pointerdown", onDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointerdown", onDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  const copy = async () => {
    const link = window.location.href
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      // clipboard API unavailable (e.g. insecure context): fall back to selecting the text
      inputRef.current?.select()
      document.execCommand("copy")
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div ref={rootRef} className="fixed top-3 right-3 z-10">
      <button
        onClick={() => {
          if (!roomId) onStart()
          setOpen(o => !o)
        }}
        title="Share"
        className="flex items-center gap-2 rounded-lg bg-[#2a2a3c] px-3 py-2 text-sm text-gray-200 shadow hover:bg-[#3b3b52]"
      >
        <span className={`h-2 w-2 rounded-full ${DOT[state]}`} />
        <Share2 size={16} />
        <span>Share</span>
      </button>

      {open && roomId && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[#2a2a3c] p-4 text-gray-200 shadow-xl">
          <div className="mb-1 text-sm font-medium">Live collaboration</div>
          <div className="mb-3 text-xs text-gray-400">
            Anyone with this link can join and edit.{" "}
            {state === "connected" ? `${peers + 1} in room.` : state === "connecting" ? "Connecting…" : "Disconnected, retrying…"}
          </div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              readOnly
              value={window.location.href}
              onFocus={e => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md bg-[#1e1e2e] px-2 py-1.5 text-xs text-gray-300 outline-none"
            />
            <button
              onClick={copy}
              className="flex items-center gap-1 rounded-md bg-[#6965db] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#7a76e6]"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
