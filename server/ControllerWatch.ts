import type { PlayerSlot } from '../src/shared/types';
import { CONTROLLER_LIFECYCLE } from '../src/shared/controllerLifecycle';

export const watchKey = (roomId: string, slot: PlayerSlot): string => `${roomId}:${slot}`;

/** 방 ID에는 ':'가 없다(RoomManager: [A-Z0-9]{3,8})는 전제로 마지막 ':'에서 나눈다. */
export function parseWatchKey(key: string): { roomId: string; slot: PlayerSlot } {
  const i = key.lastIndexOf(':');
  return { roomId: key.slice(0, i), slot: Number(key.slice(i + 1)) === 2 ? 2 : 1 };
}

interface WatchEntry {
  lastMs: number;
  lost: boolean;
}

/**
 * 컨트롤러가 센서 프레임을 계속 보내는지 지켜본다.
 * 소켓이 닫히지 않은 채 폰이 사라지는 경우(화면 꺼짐, 네트워크 끊김)를 서버가 알아채기 위한 순수 판정부다.
 * 시간은 항상 인자로 받는다.
 */
export class ControllerWatch {
  private readonly entries = new Map<string, WatchEntry>();

  /** 프레임을 받았을 때. 사라진 것으로 표시돼 있었다면 'recovered'. */
  public onFrame(key: string, nowMs: number): 'ok' | 'recovered' {
    const entry = this.entries.get(key);
    if (!entry) {
      this.entries.set(key, { lastMs: nowMs, lost: false });
      return 'ok';
    }
    entry.lastMs = nowMs;
    if (entry.lost) {
      entry.lost = false;
      return 'recovered';
    }
    return 'ok';
  }

  /** 사라진 것으로 표시한다(백그라운드 신호용). 새로 표시했으면 true, 이미 표시돼 있었으면 false. */
  public markLost(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) {
      this.entries.set(key, { lastMs: 0, lost: true });
      return true;
    }
    if (entry.lost) return false;
    entry.lost = true;
    return true;
  }

  /** timeoutMs를 넘겨 새로 사라진 키들. 같은 키는 다시 돌려주지 않는다. */
  public check(nowMs: number, timeoutMs: number = CONTROLLER_LIFECYCLE.FRAME_TIMEOUT_MS): string[] {
    const lost: string[] = [];
    for (const [key, entry] of this.entries) {
      if (!entry.lost && nowMs - entry.lastMs > timeoutMs) {
        entry.lost = true;
        lost.push(key);
      }
    }
    return lost;
  }

  /** 소켓이 닫히거나 자리가 지워진 컨트롤러를 더 이상 추적하지 않는다. */
  public forget(key: string): void {
    this.entries.delete(key);
  }
}
