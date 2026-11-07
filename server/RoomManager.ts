import { WebSocket } from 'ws';
import { PlayerSlot } from '../src/shared/types';

export function normalizeSlot(v: unknown): PlayerSlot {
  return v === 2 ? 2 : 1;
}

export interface ControllerSeat {
  socket?: WebSocket;
  deviceId: string;
}

export interface RoomSession {
  roomId: string;
  pcSocket?: WebSocket;
  controllers: Partial<Record<PlayerSlot, ControllerSeat>>;
  createdAt: number;
  /** 호환용: 슬롯 1의 소켓·기기 ID(기존 테스트 및 단일 컨트롤러 호환). */
  readonly controllerSocket?: WebSocket;
  readonly deviceId?: string;
}

function createRoomSession(roomId: string): RoomSession {
  const session: RoomSession = {
    roomId,
    controllers: {},
    createdAt: Date.now(),
  };
  Object.defineProperty(session, 'controllerSocket', {
    get() {
      return this.controllers[1]?.socket;
    },
    enumerable: true,
  });
  Object.defineProperty(session, 'deviceId', {
    get() {
      return this.controllers[1]?.deviceId;
    },
    enumerable: true,
  });
  return session;
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
    const session = createRoomSession(id);
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
    deviceId: string,
    slot: PlayerSlot = 1
  ): { session: RoomSession; movedFromSlot?: PlayerSlot } | { error: 'ROOM_NOT_FOUND' | 'SLOT_OCCUPIED' } {
    const session = this.getRoom(roomId);
    if (!session) {
      return { error: 'ROOM_NOT_FOUND' };
    }

    const currentSeat = session.controllers[slot];
    if (
      currentSeat &&
      currentSeat.deviceId !== deviceId &&
      currentSeat.socket?.readyState === WebSocket.OPEN
    ) {
      return { error: 'SLOT_OCCUPIED' };
    }

    // 다른 슬롯에 같은 deviceId가 있으면 그 슬롯 삭제 및 movedFromSlot 기록
    let movedFromSlot: PlayerSlot | undefined;
    const otherSlot: PlayerSlot = slot === 1 ? 2 : 1;
    if (session.controllers[otherSlot]?.deviceId === deviceId) {
      movedFromSlot = otherSlot;
      delete session.controllers[otherSlot];
    }

    session.controllers[slot] = { socket, deviceId };
    this.socketToRoom.set(socket, session.roomId);
    return { session, movedFromSlot };
  }

  public getControllerSlot(session: RoomSession, socket: WebSocket): PlayerSlot | undefined {
    if (session.controllers[1]?.socket === socket) return 1;
    if (session.controllers[2]?.socket === socket) return 2;
    return undefined;
  }

  public getControllerSockets(session: RoomSession): WebSocket[] {
    const sockets: WebSocket[] = [];
    if (session.controllers[1]?.socket) sockets.push(session.controllers[1].socket);
    if (session.controllers[2]?.socket) sockets.push(session.controllers[2].socket);
    return sockets;
  }

  public removeSocket(
    socket: WebSocket
  ): { roomId?: string; role?: 'PC' | 'CONTROLLER'; slot?: PlayerSlot } {
    const roomId = this.socketToRoom.get(socket);
    if (!roomId) return {};

    this.socketToRoom.delete(socket);
    const session = this.rooms.get(roomId);
    if (!session) return { roomId };

    let role: 'PC' | 'CONTROLLER' | undefined;
    let slot: PlayerSlot | undefined;

    if (session.pcSocket === socket) {
      session.pcSocket = undefined;
      role = 'PC';
    } else {
      const foundSlot = this.getControllerSlot(session, socket);
      if (foundSlot) {
        slot = foundSlot;
        role = 'CONTROLLER';
        const seat = session.controllers[foundSlot];
        if (seat) {
          seat.socket = undefined;
        }
      }
    }

    // Clean up empty room if both PC and all controllers disconnected
    const hasActiveController = Object.values(session.controllers).some(
      (seat) => seat?.socket !== undefined
    );
    if (!session.pcSocket && !hasActiveController) {
      this.rooms.delete(roomId);
    }

    return { roomId, role, slot };
  }
}
