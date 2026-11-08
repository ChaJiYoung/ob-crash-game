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

  it('re-registers sensors only through the return button (no automatic revive or watchdog)', () => {
    expect(source).not.toContain('SensorLiveness');
    expect(source).not.toContain('SENSOR_STALE_MS');
    expect(source).not.toContain('watchdog');
    // the sensor effect still re-runs on sensorEpoch, and its cleanup releases the aim lock
    expect(source).toMatch(/\[sensorsActive,\s*sensorEpoch,/);
    const cleanup = source.slice(source.indexOf("removeEventListener('deviceorientation'") - 400, source.indexOf("removeEventListener('deviceorientation'"));
    expect(cleanup).toContain('tracker.unlockAim()');
  });

  describe('background signals', () => {
    const start = source.indexOf('const onBackgroundSignals');
    const end = source.indexOf("document.addEventListener('visibilitychange', onBackgroundSignals)");
    const block = source.slice(start, end);

    it('sends both signals right away and resumes after a long enough screen-off', () => {
      expect(start).toBeGreaterThan(-1);
      expect(end).toBeGreaterThan(start);
      expect(block).toContain('CONTROLLER_BACKGROUND');
      expect(block).toContain('CONTROLLER_FOREGROUND');
      expect(block).toContain('FOREGROUND_RESUME_MIN_MS');
      expect(block).toContain('hiddenAtMs');
    });

    it('uses no timers and wall-clock time, because a sleeping phone freezes timers and may stop performance.now', () => {
      expect(block).not.toContain('setTimeout');
      expect(block).toContain('Date.now()');
      expect(block).not.toContain('performance.now');
    });

    it('asks for the return button instead of resuming by itself, and never touches the zero', () => {
      expect(block).toContain('setNeedsReturn(true)');
      expect(block).not.toContain("type: 'DEVICE_CHECK'");
      expect(block).not.toContain('isReconnectOpenRef.current = true');
      expect(block).not.toMatch(/calibrateZero|CALIBRATE_ZERO/);
      // the button check must run even when the socket is closed
      expect(block.indexOf('setNeedsReturn(true)')).toBeLessThan(block.indexOf('if (!open) return;'));
    });
  });

  describe('auto zero on sensor permission', () => {
    const grantStart = source.indexOf('const handlePermissionGranted');
    const grantBlock = source.slice(grantStart, source.indexOf('};', grantStart));
    const orientStart = source.indexOf('const onOrientation');
    const orientBlock = source.slice(orientStart, source.indexOf('const onMotion', orientStart));

    it('marks the zero as pending when the permission is granted, with a fallback timer', () => {
      expect(grantStart).toBeGreaterThan(-1);
      expect(grantBlock).toContain('autoZeroPendingRef.current = true');
      expect(grantBlock).toContain('AUTO_ZERO_FALLBACK_MS');
    });

    it('takes the zero from the first reading: the reading is stored before the zero runs', () => {
      expect(orientStart).toBeGreaterThan(-1);
      const store = orientBlock.indexOf('latestOrientationRef.current =');
      const run = orientBlock.indexOf('runAutoZero()');
      expect(store).toBeGreaterThan(-1);
      expect(run).toBeGreaterThan(store);
    });

    it('reaches handleCalibrateZero through a ref and clears the timer on unmount', () => {
      expect(source).toContain('calibrateZeroRef.current = handleCalibrateZero');
      expect(source).toMatch(/clearTimeout\(autoZeroTimerRef\.current\)/);
    });
  });

  it('has no unreachable zeroing guide screen (the phone goes straight to the pad and zeroes by itself)', () => {
    expect(source).not.toContain('ZeroingGuide');
    expect(source).not.toContain("'ZEROING'");
  });

  it('a countdown does not skip the permission gate nor zero without sensors', () => {
    const start = source.indexOf('const startCountdown = useCallback');
    const block = source.slice(start, source.indexOf('startCountdownRef.current = ', start));
    expect(block).toContain("if (sensorsActiveRef.current) setStep('PAD')");
    expect(block).toContain('if (sensorsActiveRef.current) handleCalibrateZero()');
  });

  it('does not expose a step setter on window', () => {
    expect(source).not.toContain('__setStep');
  });

  it('times the aim lock so a lost freeze timer cannot pin the aim', () => {
    expect(source).toMatch(/tracker\.lockAim\(latestOrientationRef\.current,\s*performance\.now\(\)\)/);
    expect(source).toContain('tracker.expireAimLock(performance.now())');
  });

  describe('return to game button', () => {
    const start = source.indexOf('const handleReturnToGame');
    const block = source.slice(start, source.indexOf('}, [runAutoZero]);', start));

    it('asks for sensor permission first, then re-registers sensors and zeroes on the next reading', () => {
      expect(start).toBeGreaterThan(-1);
      expect(block).toContain('requestSensorPermission()');
      expect(block).toContain('setSensorEpoch(');
      expect(block).toContain('autoZeroPendingRef.current = true');
      expect(block).toContain('AUTO_ZERO_FALLBACK_MS');
      expect(block.indexOf('requestSensorPermission()')).toBeLessThan(block.indexOf('setNeedsReturn(false)'));
    });

    it('keeps the button while the socket is down, and blocks the automatic resume meanwhile', () => {
      expect(block.indexOf('readyState !== WebSocket.OPEN')).toBeLessThan(block.indexOf('requestSensorPermission()'));
      expect(source).toContain("stepRef.current === 'PAD' && !needsReturnRef.current");
      expect(source).toContain('<ReturnToGameOverlay onReturn={handleReturnToGame} />');
    });
  });

  it('revives the socket when the screen comes back', () => {
    expect(source).toContain('visibilitychange');
    expect(source).toContain("'online'");
    expect(source).toContain('getReconnectDelayMs');
  });
});
