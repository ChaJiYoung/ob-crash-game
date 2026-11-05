import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import {
  getReconnectDelayMs,
  loadSavedControllerRoomId,
  saveControllerRoomId,
  CONTROLLER_ROOM_STORAGE_KEY,
} from '../src/controller/sensors/ReconnectPolicy';

describe('controller reconnect policy', () => {
  it('backs off exponentially and caps at 5 seconds', () => {
    expect([0, 1, 2, 3, 4, 10].map(getReconnectDelayMs)).toEqual([500, 1000, 2000, 4000, 5000, 5000]);
    expect(getReconnectDelayMs(-1)).toBe(500);
    expect(getReconnectDelayMs(Number.NaN)).toBe(500);
  });

  it('remembers the last room code', () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    };
    saveControllerRoomId('ab12', storage);
    expect(map.get(CONTROLLER_ROOM_STORAGE_KEY)).toBe('AB12');
    expect(loadSavedControllerRoomId(storage)).toBe('AB12');
  });

  it('ignores malformed values and blocked storage', () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    };
    saveControllerRoomId('not a code', storage);
    expect(map.size).toBe(0);
    expect(loadSavedControllerRoomId({ getItem: () => 'x y' })).toBeUndefined();
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSavedControllerRoomId(blocked)).toBeUndefined();
    expect(() => saveControllerRoomId('AB12', blocked)).not.toThrow();
  });
});

describe('MobileControllerPage reconnect wiring (source guard)', () => {
  const source = fs.readFileSync('src/controller/MobileControllerPage.tsx', 'utf8');

  it('no longer blocks the screen with an alert when the PC drops', () => {
    expect(source).not.toMatch(/alert\(\s*['"`]PC 호스트/);
  });

  it('revives the socket when the screen comes back', () => {
    expect(source).toContain('visibilitychange');
    expect(source).toContain("'online'");
    expect(source).toContain('getReconnectDelayMs');
  });
});
