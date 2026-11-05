export const PC_ROOM_STORAGE_KEY = 'beer_crusher_pc_room_id';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const ROOM_ID_PATTERN = /^[A-Z0-9]{3,8}$/;

function resolveStorage(storage?: StorageLike): StorageLike | undefined {
  if (storage) return storage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Storage access blocked
  }
  return undefined;
}

function normalizeRoomId(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toUpperCase();
  return ROOM_ID_PATTERN.test(normalized) ? normalized : undefined;
}

/** The room code this PC used last time, so a reload keeps the same QR. */
export function loadSavedRoomId(storage?: StorageLike): string | undefined {
  const target = resolveStorage(storage);
  if (!target) return undefined;
  try {
    return normalizeRoomId(target.getItem(PC_ROOM_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

export function saveRoomId(roomId: string, storage?: StorageLike): void {
  const target = resolveStorage(storage);
  const normalized = normalizeRoomId(roomId);
  if (!target || !normalized) return;
  try {
    target.setItem(PC_ROOM_STORAGE_KEY, normalized);
  } catch {
    // Storage access blocked
  }
}

export function clearSavedRoomId(storage?: StorageLike): void {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.removeItem(PC_ROOM_STORAGE_KEY);
  } catch {
    // Storage access blocked
  }
}
