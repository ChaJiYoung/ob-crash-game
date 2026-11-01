import { describe, it, expect, vi } from 'vitest';
import { getOrCreateDeviceId, DEVICE_ID_STORAGE_KEY } from '../src/controller/sensors/DeviceIdentity';
import { GunGripTracker } from '../src/controller/sensors/GunGripTracker';
import { UnifiedTouchPadController } from '../src/controller/sensors/UnifiedTouchPad';

describe('GunGripTracker & UnifiedTouchPadController', () => {
  it('should generate and persist deviceId', () => {
    const memoryStore: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => memoryStore[key] || null,
      setItem: (key: string, val: string) => {
        memoryStore[key] = val;
      },
    };

    const id1 = getOrCreateDeviceId(mockStorage);
    expect(id1).toMatch(/^dev_/);
    expect(mockStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(id1);

    const id2 = getOrCreateDeviceId(mockStorage);
    expect(id2).toBe(id1);
  });

  it('should compute 3D quaternion aim and detect snap fire in gun-grip posture', () => {
    const tracker = new GunGripTracker();

    // Typical gun-grip posture: screen facing left (gamma ≈ -90), phone pointing at monitor
    const zeroPose = { alpha: 180, beta: 0, gamma: -85 };
    tracker.calibrateZero(zeroPose);

    // Same orientation -> aim (0, 0)
    const center = tracker.computeAim(zeroPose);
    expect(Math.abs(center.aimX)).toBeLessThan(0.01);
    expect(Math.abs(center.aimY)).toBeLessThan(0.01);

    // Aim right: rotate yaw (alpha decreases or relative turn)
    const turnRight = tracker.computeAim({ alpha: 165, beta: 0, gamma: -85 });
    expect(turnRight.aimX).toBeGreaterThan(0.2);

    // Aim up: tilt gun barrel up (pitch elevation changes gamma from -85 to -97)
    const tiltUp = tracker.computeAim({ alpha: 180, beta: 0, gamma: -97 });
    expect(tiltUp.aimY).toBeGreaterThan(0.2);

    // Snap fire test
    const low = tracker.detectSnapFire({ x: 8.5, y: 0, z: 0, timestampMs: 1000 });
    expect(low).toBe(false);

    const snap1 = tracker.detectSnapFire({ x: 14.2, y: 0, z: 0, timestampMs: 1050 });
    expect(snap1).toBe(true);

    // Cooldown test (within 180ms)
    const snapCooldown = tracker.detectSnapFire({ x: 15.0, y: 0, z: 0, timestampMs: 1120 });
    expect(snapCooldown).toBe(false);

    // After cooldown
    const snap2 = tracker.detectSnapFire({ x: 13.5, y: 0, z: 0, timestampMs: 1300 });
    expect(snap2).toBe(true);
  });

  it('should differentiate hold rapid-fire from double-tap fever', async () => {
    vi.useFakeTimers();

    const onRapidFireChange = vi.fn();
    const onFeverTrigger = vi.fn();

    const pad = new UnifiedTouchPadController({
      onRapidFireChange,
      onFeverTrigger,
    });

    // 1. Hold gesture (>= 250ms)
    pad.handlePointerDown(1000);
    expect(onRapidFireChange).not.toHaveBeenCalled();

    // Advance 260ms
    vi.advanceTimersByTime(260);
    expect(onRapidFireChange).toHaveBeenCalledWith(true);

    pad.handlePointerUp(1300);
    expect(onRapidFireChange).toHaveBeenCalledWith(false);

    // 2. Double-tap gesture (two taps within 300ms)
    pad.handlePointerDown(2000);
    pad.handlePointerUp(2080);
    expect(onFeverTrigger).not.toHaveBeenCalled();

    pad.handlePointerDown(2220); // 220ms after first tap (< 300ms)
    expect(onFeverTrigger).toHaveBeenCalledTimes(1);

    pad.dispose();
    vi.useRealTimers();
  });
});
