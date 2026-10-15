import type { WebSocket } from "ws"
import { shouldAccept } from "../../shared/protocol.ts"
import type { ServerMessage, SyncElement } from "../../shared/protocol.ts"

const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000

export class Room {
    readonly clients = new Map<string, WebSocket>()
    private readonly elements = new Map<string, SyncElement>()
    cleanupTimer: NodeJS.Timeout | null = null

    snapshot(): SyncElement[] {
        return [...this.elements.values()]
    }

    // Merges updates into the scene and returns only the ones that actually changed it.
    merge(updates: SyncElement[]): SyncElement[] {
        const accepted: SyncElement[] = []
        for (const el of updates) {
            if (shouldAccept(this.elements.get(el.id), el)) {
                this.elements.set(el.id, el)
                accepted.push(el)
            }
        }
        return accepted
    }

    broadcast(msg: ServerMessage, exceptId?: string) {
        const data = JSON.stringify(msg)
        for (const [id, ws] of this.clients) {
            if (id !== exceptId && ws.readyState === ws.OPEN) ws.send(data)
        }
    }
}

export class RoomManager {
    private readonly rooms = new Map<string, Room>()

    join(roomId: string, clientId: string, ws: WebSocket): Room {
        let room = this.rooms.get(roomId)
        if (!room) {
            room = new Room()
            this.rooms.set(roomId, room)
        }
        if (room.cleanupTimer) {
            clearTimeout(room.cleanupTimer)
            room.cleanupTimer = null
        }
        room.clients.set(clientId, ws)
        return room
    }

    leave(roomId: string, clientId: string) {
        const room = this.rooms.get(roomId)
        if (!room) return
        room.clients.delete(clientId)
        // Keep the scene around briefly so a refresh or reconnect doesn't wipe the drawing.
        if (room.clients.size === 0) {
            room.cleanupTimer = setTimeout(() => this.rooms.delete(roomId), EMPTY_ROOM_TTL_MS)
        }
    }
}
