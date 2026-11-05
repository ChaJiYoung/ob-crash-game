import { WebSocket } from 'ws';

export interface RoomSession {
  roomId: string;
  pcSocket?: WebSocket;
  controllerSocket?: WebSocket;
  deviceId?: string;
  createdAt: number;
}

export class RoomManager {
  private rooms: Map<string, RoomSession> = new Map();
  private socketToRoom: Map<WebSocket, string> = new Map();

  private generateUniqueRoomId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid easily confused 0/O, 1/I
    for (let attempts = 0; attempts < 1000; attempts++) {
      let id = '';
      for (let i = 0; i < 4; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
      }
      if (!this.rooms.has(id)) {
        return id;
      }
    }
    return `R${Date.now().toString(36).slice(-3).toUpperCase()}`;
  }

  public createRoom(requestedRoomId?: string): RoomSession {
    const id = requestedRoomId ? requestedRoomId.toUpperCase().trim() : this.generateUniqueRoomId();
    const session: RoomSession = {
      roomId: id,
      createdAt: Date.now(),
    };
    this.rooms.set(id, session);
    return session;
  }

  /**
   * A PC that comes back with its saved room code must get the same room, not a fresh one:
   * overwriting it would drop the controller socket that is still attached.
   */
  public getOrCreateRoom(requestedRoomId?: string): RoomSession {
    const normalized = requestedRoomId ? requestedRoomId.toUpperCase().trim() : undefined;
    if (normalized && /^[A-Z0-9]{3,8}$/.test(normalized)) {
      return this.getRoom(normalized) ?? this.createRoom(normalized);
    }
    return this.createRoom();
  }

  public getRoom(roomId: string): RoomSession | undefined {
    return this.rooms.get(roomId.toUpperCase().trim());
  }

  public attachPcSocket(roomId: string, socket: WebSocket): RoomSession {
    let session = this.getRoom(roomId);
    if (!session) {
      session = this.createRoom(roomId);
    }
    session.pcSocket = socket;
    this.socketToRoom.set(socket, session.roomId);
    return session;
  }

  public attachControllerSocket(
    roomId: string,
    socket: WebSocket,
    deviceId: string
  ): RoomSession | undefined {
    const session = this.getRoom(roomId);
    if (!session) {
      return undefined;
    }
    session.controllerSocket = socket;
    session.deviceId = deviceId;
    this.socketToRoom.set(socket, session.roomId);
    return session;
  }

  public removeSocket(socket: WebSocket): { roomId?: string; role?: 'PC' | 'CONTROLLER' } {
    const roomId = this.socketToRoom.get(socket);
    if (!roomId) return {};

    this.socketToRoom.delete(socket);
    const session = this.rooms.get(roomId);
    if (!session) return { roomId };

    let role: 'PC' | 'CONTROLLER' | undefined;
    if (session.pcSocket === socket) {
      session.pcSocket = undefined;
      role = 'PC';
    } else if (session.controllerSocket === socket) {
      session.controllerSocket = undefined;
      role = 'CONTROLLER';
    }

    // Clean up empty room if both disconnected
    if (!session.pcSocket && !session.controllerSocket) {
      this.rooms.delete(roomId);
    }

    return { roomId, role };
  }
}
