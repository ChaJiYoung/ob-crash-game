export const DEVICE_ID_STORAGE_KEY = 'beer_crusher_device_id';

export function getOrCreateDeviceId(storage?: Pick<Storage, 'getItem' | 'setItem'>): string {
  let targetStorage = storage;
  if (!targetStorage && typeof window !== 'undefined' && window.localStorage) {
    targetStorage = window.localStorage;
  }

  if (targetStorage) {
    try {
      const existing = targetStorage.getItem(DEVICE_ID_STORAGE_KEY);
      if (existing && existing.trim().length > 0) {
        return existing.trim();
      }
    } catch {
      // Storage access blocked or restricted
    }
  }

  // Generate a random unique device identifier
  const randomPart = Math.random().toString(36).substring(2, 10);
  const timePart = Date.now().toString(36);
  const newDeviceId = `dev_${timePart}_${randomPart}`;

  if (targetStorage) {
    try {
      targetStorage.setItem(DEVICE_ID_STORAGE_KEY, newDeviceId);
    } catch {
      // Storage access blocked
    }
  }

  return newDeviceId;
}
