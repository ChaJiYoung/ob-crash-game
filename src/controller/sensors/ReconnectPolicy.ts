export const CONTROLLER_ROOM_STORAGE_KEY = 'beer_crusher_controller_room_id';

const ROOM_ID_PATTERN = /^[A-Z0-9]{3,8}$/;

/** 500ms, 1s, 2s, 4s, then every 5s: quick enough for a screen wake, gentle while the PC is away. */
export function getReconnectDelayMs(attempt: number): number {
  const safe = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  return Math.min(500 * 2 ** safe, 5000);
}

function normalize(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toUpperCase();
  return ROOM_ID_PATTERN.test(normalized) ? normalized : undefined;
}

function resolveStorage<T>(storage?: T): T | undefined {
  if (storage) return storage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage as unknown as T;
    }
  } catch {
    // Storage access blocked
  }
  return undefined;
}

export function loadSavedControllerRoomId(storage?: Pick<Storage, 'getItem'>): string | undefined {
  const target = resolveStorage(storage);
  if (!target) return undefined;
  try {
    return normalize(target.getItem(CONTROLLER_ROOM_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

export function saveControllerRoomId(roomId: string, storage?: Pick<Storage, 'setItem'>): void {
  const target = resolveStorage(storage);
  const normalized = normalize(roomId);
  if (!target || !normalized) return;
  try {
    target.setItem(CONTROLLER_ROOM_STORAGE_KEY, normalized);
  } catch {
    // Storage access blocked
  }
}
