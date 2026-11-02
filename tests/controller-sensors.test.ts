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

    // Aim up: tilt gun barrel up (pitch elevation increases beta)
    const tiltUp = tracker.computeAim({ alpha: 180, beta: 10, gamma: -85 });
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

  it('should differentiate tap-fire, hold rapid-fire and double-tap fever', async () => {
    vi.useFakeTimers();

    const onRapidFireChange = vi.fn();
    const onFeverTrigger = vi.fn();
    const onTapFire = vi.fn();

    const pad = new UnifiedTouchPadController({
      onRapidFireChange,
      onFeverTrigger,
      onTapFire,
    });

    // 1. Single tap fire (immediate on pointer down)
    pad.handlePointerDown(1000);
    expect(onTapFire).toHaveBeenCalledTimes(1);
    expect(onRapidFireChange).not.toHaveBeenCalled();

    // Advance 260ms -> hold triggers rapid-fire
    vi.advanceTimersByTime(260);
    expect(onRapidFireChange).toHaveBeenCalledWith(true);

    pad.handlePointerUp(1300);
    expect(onRapidFireChange).toHaveBeenCalledWith(false);

    // 2. Double-tap gesture (two taps within 300ms)
    pad.handlePointerDown(2000);
    expect(onTapFire).toHaveBeenCalledTimes(2);
    pad.handlePointerUp(2080);
    expect(onFeverTrigger).not.toHaveBeenCalled();

    pad.handlePointerDown(2220); // 220ms after first tap (< 300ms)
    expect(onFeverTrigger).toHaveBeenCalledTimes(1);
    // Double tap also fired initial tap
    expect(onTapFire).toHaveBeenCalledTimes(2);

    pad.dispose();
    vi.useRealTimers();
  });

  it('should apply adaptive smoothing to aim coordinates for tremor suppression', () => {
    const tracker = new GunGripTracker();
    const zeroPose = { alpha: 180, beta: 0, gamma: -85 };
    tracker.calibrateZero(zeroPose);

    // Tiny jitter movement (alpha moves by 0.5 degrees, ~0.02 aim delta)
    const jitterSample = { alpha: 179.5, beta: 0, gamma: -85 };
    const firstSmooth = tracker.computeAim(jitterSample, 0.5);

    // Raw delta would be around (0.5/25) = 0.02
    // With 0.5 alpha filter, smoothed value should be less than raw
    expect(firstSmooth.aimX).toBeGreaterThan(0);
    expect(firstSmooth.aimX).toBeLessThan(0.025);

    // Large flick movement (alpha moves by 15 degrees, >0.15 delta) -> instant snap
    const flickSample = { alpha: 165, beta: 0, gamma: -85 };
    const flickResult = tracker.computeAim(flickSample, 0.5);
    expect(flickResult.aimX).toBeGreaterThan(0.5);
  });

  it('should support beta pitch elevation, 2-step custom range calibration and sensitivity scaling', () => {
    const tracker = new GunGripTracker();
    const zeroPose = { alpha: 180, beta: 20, gamma: -80 };
    tracker.calibrateZero(zeroPose);

    // 1. Beta tilt up (beta increases from 20 to 30) -> aimY > 0
    const tiltUp = tracker.computeAim({ alpha: 180, beta: 30, gamma: -80 });
    expect(tiltUp.pitchDeg).toBeCloseTo(10, 1);
    expect(tiltUp.aimY).toBeGreaterThan(0.3);

    // Tilt down (beta decreases from 20 to 10) -> aimY < 0
    const tiltDown = tracker.computeAim({ alpha: 180, beta: 10, gamma: -80 });
    expect(tiltDown.pitchDeg).toBeCloseTo(-10, 1);
    expect(tiltDown.aimY).toBeLessThan(-0.3);

    // 2. Range calibration: user only moves wrist 10 degrees yaw and 8 degrees pitch
    tracker.startRangeMeasurement();
    tracker.recordRangeSample({ alpha: 170, beta: 20, gamma: -80 }); // yaw +10
    tracker.recordRangeSample({ alpha: 190, beta: 20, gamma: -80 }); // yaw -10
    tracker.recordRangeSample({ alpha: 180, beta: 28, gamma: -80 }); // pitch +8
    tracker.recordRangeSample({ alpha: 180, beta: 12, gamma: -80 }); // pitch -8
    const updatedConfig = tracker.finishRangeMeasurement();

    expect(updatedConfig.yawHalfRangeDeg).toBeLessThanOrEqual(12);
    expect(updatedConfig.pitchHalfRangeDeg).toBeLessThanOrEqual(10);

    // Now moving 10 degrees yaw hits full scale (aimX ≈ 1.0)
    const smallFlick = tracker.computeAim({ alpha: 170, beta: 20, gamma: -80 });
    expect(smallFlick.aimX).toBeGreaterThanOrEqual(0.9);

    // 3. Sensitivity & Invert Y
    tracker.setCalibrationConfig({ sensitivityX: 1.5, invertY: true });
    const invertedAim = tracker.computeAim({ alpha: 180, beta: 28, gamma: -80 }); // was positive pitch
    expect(invertedAim.aimY).toBeLessThan(0); // inverted to negative
  });

  it('should reliably aim into 4 diagonal quadrants without gimbal lock or axis flipping', () => {
    // 1. Gun-grip posture (screen facing left, gamma ≈ -85, beta: 20)
    const gunTracker = new GunGripTracker();
    gunTracker.calibrateZero({ alpha: 180, beta: 20, gamma: -85 });

    // Top-Left: turn left (alpha: 195) + tilt up (beta: 30) -> aimX < 0, aimY > 0
    const gunTopLeft = gunTracker.computeAim({ alpha: 195, beta: 30, gamma: -85 });
    expect(gunTopLeft.yawDeg).toBeLessThan(-10);
    expect(gunTopLeft.pitchDeg).toBeGreaterThan(8);
    expect(gunTopLeft.aimX).toBeLessThan(-0.1);
    expect(gunTopLeft.aimY).toBeGreaterThan(0.1);

    // Top-Right: turn right (alpha: 165) + tilt up (beta: 30) -> aimX > 0, aimY > 0
    const gunTopRight = gunTracker.computeAim({ alpha: 165, beta: 30, gamma: -85 });
    expect(gunTopRight.yawDeg).toBeGreaterThan(10);
    expect(gunTopRight.pitchDeg).toBeGreaterThan(8);
    expect(gunTopRight.aimX).toBeGreaterThan(0.1);
    expect(gunTopRight.aimY).toBeGreaterThan(0.1);

    // Bottom-Left: turn left (alpha: 195) + tilt down (beta: 10) -> aimX < 0, aimY < 0
    const gunBottomLeft = gunTracker.computeAim({ alpha: 195, beta: 10, gamma: -85 });
    expect(gunBottomLeft.yawDeg).toBeLessThan(-10);
    expect(gunBottomLeft.pitchDeg).toBeLessThan(-8);
    expect(gunBottomLeft.aimX).toBeLessThan(-0.1);
    expect(gunBottomLeft.aimY).toBeLessThan(-0.1);

    // Bottom-Right: turn right (alpha: 165) + tilt down (beta: 10) -> aimX > 0, aimY < 0
    const gunBottomRight = gunTracker.computeAim({ alpha: 165, beta: 10, gamma: -85 });
    expect(gunBottomRight.yawDeg).toBeGreaterThan(10);
    expect(gunBottomRight.pitchDeg).toBeLessThan(-8);
    expect(gunBottomRight.aimX).toBeGreaterThan(0.1);
    expect(gunBottomRight.aimY).toBeLessThan(-0.1);

    // 2. Remote posture (screen facing up, gamma ≈ 0, beta: 45)
    const remoteTracker = new GunGripTracker();
    remoteTracker.calibrateZero({ alpha: 0, beta: 45, gamma: 0 });

    // Remote Top-Left: turn left (alpha: 15) + tilt up (beta: 55)
    const remoteTopLeft = remoteTracker.computeAim({ alpha: 15, beta: 55, gamma: 0 });
    expect(remoteTopLeft.yawDeg).toBeLessThan(-5);
    expect(remoteTopLeft.pitchDeg).toBeGreaterThan(5);
    expect(remoteTopLeft.aimX).toBeLessThan(-0.1);
    expect(remoteTopLeft.aimY).toBeGreaterThan(0.1);

    // Remote Top-Right: turn right (alpha: 345) + tilt up (beta: 55)
    const remoteTopRight = remoteTracker.computeAim({ alpha: 345, beta: 55, gamma: 0 });
    expect(remoteTopRight.yawDeg).toBeGreaterThan(5);
    expect(remoteTopRight.pitchDeg).toBeGreaterThan(5);
    expect(remoteTopRight.aimX).toBeGreaterThan(0.1);
    expect(remoteTopRight.aimY).toBeGreaterThan(0.1);

    // Remote Bottom-Left: turn left (alpha: 15) + tilt down (beta: 35)
    const remoteBottomLeft = remoteTracker.computeAim({ alpha: 15, beta: 35, gamma: 0 });
    expect(remoteBottomLeft.yawDeg).toBeLessThan(-5);
    expect(remoteBottomLeft.pitchDeg).toBeLessThan(-5);
    expect(remoteBottomLeft.aimX).toBeLessThan(-0.1);
    expect(remoteBottomLeft.aimY).toBeLessThan(-0.1);

    // Remote Bottom-Right: turn right (alpha: 345) + tilt down (beta: 35)
    const remoteBottomRight = remoteTracker.computeAim({ alpha: 345, beta: 35, gamma: 0 });
    expect(remoteBottomRight.yawDeg).toBeGreaterThan(5);
    expect(remoteBottomRight.pitchDeg).toBeLessThan(-5);
    expect(remoteBottomRight.aimX).toBeGreaterThan(0.1);
    expect(remoteBottomRight.aimY).toBeLessThan(-0.1);
  });
});
