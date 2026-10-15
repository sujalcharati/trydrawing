import { shouldAccept } from "../../shared/protocol.ts"
import type { ClientMessage, ServerMessage, SyncElement } from "../../shared/protocol.ts"

// What the app hands us: any element with an id. Sync fields are added and stripped here,
// so the rest of the app never sees version / versionNonce / isDeleted.
export type PlainElement = { id: string } & Record<string, unknown>

export type ConnectionState = "connecting" | "connected" | "disconnected"
export type RemoteCursor = { x: number; y: number }

type Handlers = {
  getElements: () => PlainElement[]
  onRemoteChange: (upserts: PlainElement[], removedIds: string[]) => void
  onCursorsChange: () => void
  onStatusChange: (state: ConnectionState, peerCount: number) => void
}

type Known = { sync: SyncElement; sig: string }

const SYNC_DEBOUNCE_MS   = 50
const CURSOR_THROTTLE_MS = 40
const MAX_BACKOFF_MS     = 10_000

const sigOf = (el: PlainElement) => JSON.stringify(el)
const nonce = () => Math.floor(Math.random() * 0x7fffffff)

function stripSync(el: SyncElement): PlainElement {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { version, versionNonce, isDeleted, ...rest } = el
  return rest as PlainElement
}

export class CollabClient {
  readonly cursors = new Map<string, RemoteCursor>()

  private ws: WebSocket | null = null
  private disposed = false
  private attempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private syncTimer: ReturnType<typeof setTimeout> | null = null
  private lastCursorSent = 0
  private peers = new Set<string>()
  private state: ConnectionState = "connecting"

  // Every element we have ever seen or sent, including tombstones. This is what we diff against.
  private known = new Map<string, Known>()

  private readonly url: string
  private readonly handlers: Handlers

  constructor(url: string, handlers: Handlers) {
    this.url = url
    this.handlers = handlers
  }

  connect() {
    if (this.disposed) return
    this.setState("connecting")
    const ws = new WebSocket(this.url)
    this.ws = ws

    ws.onmessage = ev => {
      if (typeof ev.data !== "string") return
      let msg: ServerMessage
      try { msg = JSON.parse(ev.data) as ServerMessage } catch { return }
      this.handleMessage(msg)
    }
    ws.onclose = () => {
      if (this.ws !== ws) return
      this.ws = null
      this.peers.clear()
      this.cursors.clear()
      this.handlers.onCursorsChange()
      this.setState("disconnected")
      this.scheduleReconnect()
    }
    // onclose always follows onerror, so reconnect logic lives there only
    ws.onerror = () => {}
  }

  dispose() {
    this.disposed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.syncTimer) clearTimeout(this.syncTimer)
    const ws = this.ws
    this.ws = null
    ws?.close()
  }

  // Call after any local change to the scene. Batches into one diff every SYNC_DEBOUNCE_MS.
  notifyChange() {
    if (this.syncTimer) return
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null
      this.syncLocal()
    }, SYNC_DEBOUNCE_MS)
  }

  sendCursor(x: number, y: number) {
    const now = performance.now()
    if (now - this.lastCursorSent < CURSOR_THROTTLE_MS) return
    this.lastCursorSent = now
    this.send({ type: "cursor", x, y })
  }

  // Diffs the live scene against `known`, bumps versions on anything that changed, and
  // tombstones anything that disappeared. Because it compares whole-element snapshots it
  // doesn't care how the change happened (draw, drag, style edit, undo, redo).
  private syncLocal() {
    const current = this.handlers.getElements()
    const seen = new Set<string>()
    const out: SyncElement[] = []

    for (const el of current) {
      seen.add(el.id)
      const sig  = sigOf(el)
      const prev = this.known.get(el.id)
      if (prev && !prev.sync.isDeleted && prev.sig === sig) continue
      const sync: SyncElement = {
        ...el, version: (prev?.sync.version ?? 0) + 1, versionNonce: nonce(), isDeleted: false,
      }
      this.known.set(el.id, { sync, sig })
      out.push(sync)
    }

    for (const [id, prev] of this.known) {
      if (seen.has(id) || prev.sync.isDeleted) continue
      const tomb: SyncElement = { ...prev.sync, isDeleted: true, version: prev.sync.version + 1, versionNonce: nonce() }
      this.known.set(id, { sync: tomb, sig: prev.sig })
      out.push(tomb)
    }

    if (out.length > 0) this.send({ type: "scene-update", elements: out })
  }

  private applyRemote(elements: SyncElement[]) {
    const upserts: PlainElement[] = []
    const removedIds: string[] = []
    for (const el of elements) {
      const prev = this.known.get(el.id)
      if (!shouldAccept(prev?.sync, el)) continue
      const plain = stripSync(el)
      // Signature of exactly the object the app will store, so syncLocal sees no diff and doesn't echo it back.
      this.known.set(el.id, { sync: el, sig: el.isDeleted ? (prev?.sig ?? "") : sigOf(plain) })
      if (el.isDeleted) removedIds.push(el.id)
      else upserts.push(plain)
    }
    if (upserts.length > 0 || removedIds.length > 0) this.handlers.onRemoteChange(upserts, removedIds)
  }

  private handleMessage(msg: ServerMessage) {
    switch (msg.type) {
      case "init":
        this.attempts = 0
        this.peers = new Set(msg.peers)
        this.applyRemote(msg.elements)
        // After a reconnect we may hold edits the server missed. It keeps whichever version is newer.
        this.sendAllKnown()
        this.setState("connected")
        break
      case "scene-update":
        this.applyRemote(msg.elements)
        break
      case "cursor":
        this.cursors.set(msg.from, { x: msg.x, y: msg.y })
        this.handlers.onCursorsChange()
        break
      case "peer-joined":
        this.peers.add(msg.clientId)
        this.setState(this.state)
        break
      case "peer-left":
        this.peers.delete(msg.clientId)
        this.cursors.delete(msg.clientId)
        this.handlers.onCursorsChange()
        this.setState(this.state)
        break
    }
  }

  private sendAllKnown() {
    // Reconcile first so edits made while offline get proper versions.
    this.syncLocal()
    const all = [...this.known.values()].map(k => k.sync)
    if (all.length > 0) this.send({ type: "scene-update", elements: all })
  }

  private send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
  }

  private setState(state: ConnectionState) {
    this.state = state
    this.handlers.onStatusChange(state, this.peers.size)
  }

  private scheduleReconnect() {
    if (this.disposed) return
    const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** this.attempts) * (0.75 + Math.random() * 0.5)
    this.attempts++
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }
}
