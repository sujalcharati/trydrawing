// Wire protocol shared by client and server. All messages are JSON text frames.

// The server never interprets drawing data; it only needs these sync fields.
// Everything else on an element (x, y, strokeColor, points, ...) passes through untouched.
export type SyncElement = {
    id: string
    version: number        // bumped on every local change
    versionNonce: number   // random per change; deterministic tie-break when versions are equal
    isDeleted?: boolean    // tombstone, so deletions propagate instead of the element just vanishing locally
    [key: string]: unknown
}

export type ClientMessage =
    | { type: "scene-update"; elements: SyncElement[] }
    | { type: "cursor"; x: number; y: number }

export type ServerMessage =
    | { type: "init"; clientId: string; elements: SyncElement[]; peers: string[] }
    | { type: "scene-update"; from: string; elements: SyncElement[] }
    | { type: "cursor"; from: string; x: number; y: number }
    | { type: "peer-joined"; clientId: string }
    | { type: "peer-left"; clientId: string }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

export function isSyncElement(v: unknown): v is SyncElement {
    return isObject(v) && typeof v.id === "string" && v.id.length > 0 && v.id.length <= 64
        && isNum(v.version) && isNum(v.versionNonce)
}

// Returns null for anything malformed so the caller can just drop it.
export function parseClientMessage(raw: string): ClientMessage | null {
    let msg: unknown
    try { msg = JSON.parse(raw) } catch { return null }
    if (!isObject(msg)) return null

    if (msg.type === "scene-update") {
        if (!Array.isArray(msg.elements) || !msg.elements.every(isSyncElement)) return null
        return { type: "scene-update", elements: msg.elements }
    }
    if (msg.type === "cursor") {
        if (!isNum(msg.x) || !isNum(msg.y)) return null
        return { type: "cursor", x: msg.x, y: msg.y }
    }
    return null
}

// True if `incoming` should replace `existing`. Higher version wins; on a tie the lower
// versionNonce wins, so every client and the server converge on the same element
// regardless of the order updates arrive in.
export function shouldAccept(existing: SyncElement | undefined, incoming: SyncElement): boolean {
    if (!existing) return true
    if (incoming.version !== existing.version) return incoming.version > existing.version
    return incoming.versionNonce < existing.versionNonce
}
