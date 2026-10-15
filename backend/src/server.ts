import { randomUUID } from "node:crypto"
import { WebSocketServer } from "ws"
import { parseClientMessage } from "../../shared/protocol.ts"
import type { ServerMessage } from "../../shared/protocol.ts"
import { RoomManager } from "./rooms.js"

const PORT = Number(process.env.PORT ?? 8080)
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024
const HEARTBEAT_MS = 30_000
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

const wss = new WebSocketServer({ port: PORT, maxPayload: MAX_PAYLOAD_BYTES })
const rooms = new RoomManager()
const alive = new WeakSet<object>()

wss.on("connection", (ws, req) => {
    const roomId = new URL(req.url ?? "/", "http://localhost").searchParams.get("room") ?? ""
    if (!ROOM_ID_PATTERN.test(roomId)) {
        ws.close(1008, "invalid room id")
        return
    }

    const clientId = randomUUID()
    const room = rooms.join(roomId, clientId, ws)
    alive.add(ws)
    ws.on("pong", () => alive.add(ws))

    const init: ServerMessage = {
        type: "init",
        clientId,
        elements: room.snapshot(),
        peers: [...room.clients.keys()].filter(id => id !== clientId),
    }
    ws.send(JSON.stringify(init))
    room.broadcast({ type: "peer-joined", clientId }, clientId)
    console.log(`[${roomId}] + ${clientId} (${room.clients.size} connected)`)

    ws.on("message", (data, isBinary) => {
        if (isBinary) return
        const msg = parseClientMessage(data.toString())
        if (!msg) return

        if (msg.type === "scene-update") {
            const accepted = room.merge(msg.elements)
            if (accepted.length > 0) room.broadcast({ type: "scene-update", from: clientId, elements: accepted }, clientId)
        } else {
            room.broadcast({ type: "cursor", from: clientId, x: msg.x, y: msg.y }, clientId)
        }
    })

    ws.on("close", () => {
        rooms.leave(roomId, clientId)
        room.broadcast({ type: "peer-left", clientId })
        console.log(`[${roomId}] - ${clientId} (${room.clients.size} connected)`)
    })

    ws.on("error", err => console.error(`[${roomId}] ${clientId}:`, err.message))
})

// Drop connections that stopped answering pings (closed laptops, dead networks).
setInterval(() => {
    for (const ws of wss.clients) {
        if (!alive.has(ws)) { ws.terminate(); continue }
        alive.delete(ws)
        ws.ping()
    }
}, HEARTBEAT_MS)

console.log(`collab server listening on ws://localhost:${PORT}`)
