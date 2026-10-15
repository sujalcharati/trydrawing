import { useEffect, useRef, useState } from "react"
import { CollabClient } from "./CollabClient.ts"
import type { ConnectionState, PlainElement, RemoteCursor } from "./CollabClient.ts"

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8080"

// The room lives in the URL hash (#room=abc), so opening a shared link joins that room.
// Returns null when the URL has no room: the app then stays local until someone clicks Share.
export function readRoomId(): string | null {
  const existing = new URLSearchParams(window.location.hash.slice(1)).get("room")
  return existing && /^[A-Za-z0-9_-]{1,64}$/.test(existing) ? existing : null
}

export function createRoomId(): string {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 10)
  window.history.replaceState(null, "", `#room=${id}`)
  return id
}

type Options = {
  roomId: string | null
  getElements: () => PlainElement[]
  onRemoteChange: (upserts: PlainElement[], removedIds: string[]) => void
  onCursorsChange: () => void
}

export function useCollab(opts: Options) {
  // Latest callbacks, so the client (created once per room) never holds stale closures.
  const optsRef = useRef(opts)
  useEffect(() => { optsRef.current = opts })

  const clientRef = useRef<CollabClient | null>(null)
  const [status, setStatus] = useState<{ state: ConnectionState; peers: number }>({ state: "connecting", peers: 0 })

  useEffect(() => {
    if (!opts.roomId) return
    const client = new CollabClient(`${WS_URL}/?room=${encodeURIComponent(opts.roomId)}`, {
      getElements:     () => optsRef.current.getElements(),
      onRemoteChange:  (u, r) => optsRef.current.onRemoteChange(u, r),
      onCursorsChange: () => optsRef.current.onCursorsChange(),
      onStatusChange:  (state, peers) => setStatus({ state, peers }),
    })
    clientRef.current = client
    client.connect()
    return () => { client.dispose(); clientRef.current = null }
  }, [opts.roomId])

  return {
    status: opts.roomId ? status : { state: "idle" as const, peers: 0 },
    notifyChange: () => clientRef.current?.notifyChange(),
    sendCursor:   (x: number, y: number) => clientRef.current?.sendCursor(x, y),
    getCursors:   (): ReadonlyMap<string, RemoteCursor> => clientRef.current?.cursors ?? new Map(),
  }
}
