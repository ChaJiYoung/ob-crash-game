import { describe, it, expect } from 'vitest';
import { buildControllerPairingUrl } from '../src/pc/components/QRPairingModal';
import {
  parseControllerSlot,
  loadSavedControllerSlot,
  saveControllerSlot,
  CONTROLLER_SLOT_STORAGE_KEY,
} from '../src/controller/sensors/ReconnectPolicy';

describe('controller slot routing and pairing URL (P04-T02)', () => {
  it('builds pairing URLs with slot query parameter', () => {
    // Default slot 1
    const url1 = buildControllerPairingUrl('https://mygame.com', 'ROOM1');
    expect(url1).toBe('https://mygame.com/controller?room=ROOM1&slot=1');

    // Slot 2
    const url2 = buildControllerPairingUrl('https://mygame.com', 'ROOM2', undefined, 2);
    expect(url2).toBe('https://mygame.com/controller?room=ROOM2&slot=2');

    // Lan IP replacement with slot
    const urlLan = buildControllerPairingUrl('http://localhost:5173', 'ROOM3', '192.168.0.10', 2);
    expect(urlLan).toBe('http://192.168.0.10:5173/controller?room=ROOM3&slot=2');
  });

  it('parses controller slot from search string', () => {
    expect(parseControllerSlot('?room=A&slot=2')).toBe(2);
    expect(parseControllerSlot('?room=A')).toBe(1);
    expect(parseControllerSlot('?slot=3')).toBe(1); // invalid slot -> 1
    expect(parseControllerSlot('')).toBe(1);
    expect(parseControllerSlot('?slot=1')).toBe(1);
    expect(parseControllerSlot('room=A&slot=2')).toBe(2);
  });

  it('saves and loads slot from storage', () => {
    const memStorage = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => memStorage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        memStorage.set(k, v);
      },
    };

    // Initially 1
    expect(loadSavedControllerSlot(mockStorage)).toBe(1);

    // Save slot 2
    saveControllerSlot(2, mockStorage);
    expect(mockStorage.getItem(CONTROLLER_SLOT_STORAGE_KEY)).toBe('2');
    expect(loadSavedControllerSlot(mockStorage)).toBe(2);

    // Save slot 1
    saveControllerSlot(1, mockStorage);
    expect(loadSavedControllerSlot(mockStorage)).toBe(1);
  });
});
