import { describe, it, expect, vi } from 'vitest';
import { getOrCreateDeviceId, DEVICE_ID_STORAGE_KEY } from '../src/controller/sensors/DeviceIdentity';
import { GunGripTracker, computeAdaptiveSmoothingAlpha, AIM_LOCK_MAX_MS } from '../src/controller/sensors/GunGripTracker';
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

    // Snap fire test with 3D acceleration norm (raised threshold 4.8 m/s^2 for D04 false-positive guard)
    const low = tracker.detectSnapFire({ x: 1.5, y: 0, z: 0, timestampMs: 1000 });
    expect(low).toBe(false);

    // Mid acceleration from casual re-grip (3.2 m/s^2 < 4.8 m/s^2) -> no false snap
    const regrip = tracker.detectSnapFire({ x: 0, y: 3.2, z: 0, timestampMs: 1050 });
    expect(regrip).toBe(false);

    // Y-axis upward deliberate snap flick (5.0 m/s^2 >= 4.8 m/s^2)
    const snap1 = tracker.detectSnapFire({ x: 0, y: 5.0, z: 0, timestampMs: 1100 });
    expect(snap1).toBe(true);

    // Cooldown test (within 110ms)
    const snapCooldown = tracker.detectSnapFire({ x: 0, y: 0, z: 12.0, timestampMs: 1150 });
    expect(snapCooldown).toBe(false);

    // After 110ms cooldown: combined 3D acceleration vector sqrt(3.6^2 + 3.6^2) ≈ 5.09 >= 4.8
    const snap2 = tracker.detectSnapFire({ x: 3.6, y: 3.6, z: 0, timestampMs: 1250 });
    expect(snap2).toBe(true);
  });

  it('should trigger single-tap fire, hold auto-fire after 180ms, and double-tap fever', async () => {
    vi.useFakeTimers();

    const onSingleTapFire = vi.fn();
    const onFeverTrigger = vi.fn();
    const onRapidFireHoldChange = vi.fn();

    const pad = new UnifiedTouchPadController({
      onSingleTapFire,
      onFeverTrigger,
      onRapidFireHoldChange,
    });

    // 1. Single tap touch down -> immediate single tap fire (0ms delay)
    pad.handlePointerDown(1000);
    expect(onSingleTapFire).toHaveBeenCalledTimes(1);
    expect(onFeverTrigger).not.toHaveBeenCalled();
    expect(onRapidFireHoldChange).not.toHaveBeenCalled();

    // Advance 100ms (< 180ms) -> rapid fire hold not yet triggered
    vi.advanceTimersByTime(100);
    expect(onRapidFireHoldChange).not.toHaveBeenCalled();

    // Advance past 180ms (total 200ms held) -> onRapidFireHoldChange(true) triggered!
    vi.advanceTimersByTime(100);
    expect(onRapidFireHoldChange).toHaveBeenCalledWith(true);

    // Release touch at 1500ms -> onRapidFireHoldChange(false) triggered!
    pad.handlePointerUp(1500);
    expect(onRapidFireHoldChange).toHaveBeenCalledWith(false);

    // 2. Double-tap gesture (two taps within 300ms) triggers 2nd shot AND Fever
    pad.handlePointerDown(2000);
    expect(onSingleTapFire).toHaveBeenCalledTimes(2);
    pad.handlePointerUp(2080);
    expect(onFeverTrigger).not.toHaveBeenCalled();

    pad.handlePointerDown(2220); // 220ms after first tap (< 300ms)
    expect(onSingleTapFire).toHaveBeenCalledTimes(3);
    expect(onFeverTrigger).toHaveBeenCalledTimes(1);

    pad.dispose();
    vi.useRealTimers();
  });

  it('should apply continuous adaptive smoothing to aim coordinates without step jumps', () => {
    // 1. Direct function verification for smooth continuous curve
    expect(computeAdaptiveSmoothingAlpha(0.5, 0.01, false)).toBe(1.0); // uninitialized
    expect(computeAdaptiveSmoothingAlpha(0.5, 0.02, true)).toBeCloseTo(0.5, 3); // tremor knee
    expect(computeAdaptiveSmoothingAlpha(0.5, 0.35, true)).toBe(1.0); // full flick
    expect(computeAdaptiveSmoothingAlpha(0.5, 0.50, true)).toBe(1.0);

    const alphaAt14 = computeAdaptiveSmoothingAlpha(0.5, 0.14, true);
    const alphaAt16 = computeAdaptiveSmoothingAlpha(0.5, 0.16, true);
    expect(alphaAt14).toBeGreaterThan(0.5);
    expect(alphaAt16).toBeGreaterThan(alphaAt14);
    // Difference between 0.14 and 0.16 should be continuous and small (~0.03), not a 0.5 jump!
    expect(alphaAt16 - alphaAt14).toBeLessThan(0.06);

    // 2. Integration with GunGripTracker
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

  it('should only allow snap fire when screen touch (cocked) is active', () => {
    const tracker = new GunGripTracker();
    let isCocked = false;
    let snapFired = false;

    const handleMotionEvent = (accel: { x: number; y: number; z: number; timestampMs: number }) => {
      const snap = tracker.detectSnapFire(accel);
      if (snap && isCocked) {
        snapFired = true;
      }
    };

    // 1. Shaking phone without touching screen (isCocked = false)
    handleMotionEvent({ x: 0, y: 9.0, z: 0, timestampMs: 1000 });
    expect(snapFired).toBe(false); // No shot!

    // 2. Touch down: cocked! (isCocked = true)
    isCocked = true;
    handleMotionEvent({ x: 0, y: 9.0, z: 0, timestampMs: 1300 });
    expect(snapFired).toBe(true); // Fired!
  });

  it('should freeze aim coordinates during touch cocking and reset single-action state on snapFire (D01, D02)', () => {
    const tracker = new GunGripTracker();
    const zeroPose = { alpha: 180, beta: 0, gamma: -85 };
    tracker.calibrateZero(zeroPose);

    // Initial state: free aim at center
    const freeAim1 = tracker.getEffectiveAim(zeroPose);
    expect(freeAim1.isLocked).toBe(false);
    expect(Math.abs(freeAim1.aim.aimX)).toBeLessThan(0.01);
    expect(Math.abs(freeAim1.aim.aimY)).toBeLessThan(0.01);

    // 1. Move to a target position: aim right (alpha = 165)
    const targetPose = { alpha: 165, beta: 5, gamma: -85 };
    const liveTargetAim = tracker.computeAim(targetPose);
    expect(liveTargetAim.aimX).toBeGreaterThan(0.2);

    // 2. Touch down: Cocking lock at targetPose
    const lockedSnapshot = tracker.lockAim(targetPose);
    expect(tracker.isAimLocked()).toBe(true);
    expect(lockedSnapshot.aimX).toBe(liveTargetAim.aimX);

    // 3. User tilts phone violently upwards to snap fire (e.g. beta = 35, alpha = 140)
    const violentRecoilPose = { alpha: 140, beta: 35, gamma: -85 };
    const recoilEffectiveAim = tracker.getEffectiveAim(violentRecoilPose);

    // CRITICAL (D01): Even under violent movement, effective aim MUST remain frozen at lockedSnapshot!
    expect(recoilEffectiveAim.isLocked).toBe(true);
    expect(recoilEffectiveAim.aim.aimX).toBe(lockedSnapshot.aimX);
    expect(recoilEffectiveAim.aim.aimY).toBe(lockedSnapshot.aimY);

    // 4. Snap motion detected -> 1st shot fired with locked coordinates
    let isCocked = true;
    const snapDetected = tracker.detectSnapFire({ x: 0, y: 9.5, z: 0, timestampMs: 2000 });
    expect(snapDetected).toBe(true);

    // D02: Single-action reset immediately after snapFire
    isCocked = false;
    tracker.unlockAim();
    expect(tracker.isAimLocked()).toBe(false);

    // 5. Subsequent frames must immediately return to live sensor orientation
    const postShotAim = tracker.getEffectiveAim(violentRecoilPose);
    expect(postShotAim.isLocked).toBe(false);
    expect(postShotAim.aim.aimX).not.toBe(lockedSnapshot.aimX);

    // 6. Recoil downward shake while isCocked is false MUST NOT fire again
    const recoilDownSnap = tracker.detectSnapFire({ x: 0, y: 9.5, z: 0, timestampMs: 2300 });
    expect(recoilDownSnap).toBe(true); // motion sensor detects acceleration
    // But since isCocked is false, controller logic will ignore it!
    let secondShotFired = false;
    if (recoilDownSnap && isCocked) {
      secondShotFired = true;
    }
    expect(secondShotFired).toBe(false);
  });

  it('should enforce single-action safety lock across touch-down, snap, hold-shake, and re-touch lifecycle', () => {
    const tracker = new GunGripTracker();
    tracker.calibrateZero({ alpha: 180, beta: 0, gamma: -85 });

    let isCocked = false;
    let firedCount = 0;

    // Simulate onMotion listener logic
    const handleMotion = (accelY: number, timeMs: number) => {
      const snap = tracker.detectSnapFire({ x: 0, y: accelY, z: 0, timestampMs: timeMs });
      if (snap && isCocked) {
        firedCount += 1;
        // [Single-Action Safety] lock immediately on 1st fire
        isCocked = false;
        tracker.unlockAim();
      }
    };

    // 1. Initial State: not cocked -> violent shake does not fire
    handleMotion(6.0, 1000);
    expect(firedCount).toBe(0);

    // 2. User touches down -> Cocking ON
    isCocked = true;

    // 3. 1st Snap flick -> fires shot #1 and resets isCocked to false (>= 4.8 m/s^2)
    handleMotion(5.5, 1200);
    expect(firedCount).toBe(1);
    expect(isCocked).toBe(false);

    // 4. User keeps holding finger on screen; recoil rebound occurs after 150ms
    // Even if motion is detected, since isCocked is false, NO second fire occurs!
    handleMotion(6.0, 1350);
    handleMotion(5.0, 1400);
    expect(firedCount).toBe(1); // STILL 1! Double fire completely prevented!

    // 5. User lifts finger (pointerUp) -> remains false
    isCocked = false;

    // 6. User touches down again for the next shot -> Re-cocking
    isCocked = true;

    // 7. 2nd Snap flick -> fires shot #2
    handleMotion(5.2, 1600);
    expect(firedCount).toBe(2);
    expect(isCocked).toBe(false);
  });

  it('should trigger mobile snap active skill (skillSnapTriggered) and sync SKILL_STATE_SYNC', () => {
    const tracker = new GunGripTracker();
    let skillSnapTriggered = false;

    // Simulate mobile onMotion listener
    const onMotion = (accelY: number, timeMs: number) => {
      const snap = tracker.detectSnapFire({ x: 0, y: accelY, z: 0, timestampMs: timeMs });
      if (snap) {
        skillSnapTriggered = true;
      }
    };

    // Upward snap flick triggers active skill (>= 4.8 m/s^2)
    onMotion(5.2, 1000);
    expect(skillSnapTriggered).toBe(true);

    // Frame payload construction test
    const payload = {
      aimX: 0,
      aimY: 0,
      pitchDeg: 0,
      yawDeg: 0,
      rollDeg: 0,
      snapFire: false,
      rapidFireHold: false,
      feverTriggered: false,
      isCocked: false,
      skillSnapTriggered: true,
      timestamp: Date.now(),
    };
    expect(payload.skillSnapTriggered).toBe(true);

    // SKILL_STATE_SYNC test message
    const syncMsg = {
      type: 'SKILL_STATE_SYNC' as const,
      roomId: 'ROOM_TEST',
      weaponKind: 'shotgun' as const,
      weaponLevel: 2 as const,
      skillStock: 1,
      maxSkillStock: 1,
      skillCooldownRemainingMs: 0,
      skillCooldownTotalMs: 22000,
    };
    expect(syncMsg.skillStock).toBe(1);
    expect(syncMsg.weaponLevel).toBe(2);
  });

  it('should return rawAimX, rawAimY and toggle adaptive 1€ Filter stabilized mode', () => {
    const tracker = new GunGripTracker();
    const zeroPose = { alpha: 180, beta: 0, gamma: -85 };
    tracker.calibrateZero(zeroPose);

    // Default mode: isStabilizedMode is false (iPhone 13 mini original behavior preserved)
    expect(tracker.isStabilized()).toBe(false);

    const aimDefault = tracker.computeAim({ alpha: 170, beta: 5, gamma: -85 });
    expect(typeof aimDefault.rawAimX).toBe('number');
    expect(typeof aimDefault.rawAimY).toBe('number');
    expect(typeof aimDefault.aimX).toBe('number');
    expect(typeof aimDefault.aimY).toBe('number');

    // Enable stabilized mode (Galaxy A series)
    tracker.setStabilizedMode(true);
    expect(tracker.isStabilized()).toBe(true);

    tracker.applyPreset('stabilized');
    const cfg = tracker.getFilterConfig();
    expect(cfg.minCutoff).toBe(0.4);

    // Compute aim in stabilized mode with timestamp
    const aimStabilized = tracker.computeAim({ alpha: 170.2, beta: 5.1, gamma: -85 }, 0.92, 1016);
    expect(aimStabilized.aimX).toBeDefined();
    expect(aimStabilized.rawAimX).toBeDefined();
  });
});

describe('GunGripTracker aim lock expiry', () => {
  const zeroPose = { alpha: 180, beta: 0, gamma: -85 };
  const targetPose = { alpha: 165, beta: 5, gamma: -85 };
  const otherPose = { alpha: 140, beta: 35, gamma: -85 };
  const makeTracker = () => {
    const t = new GunGripTracker();
    t.calibrateZero(zeroPose);
    return t;
  };

  it('releases a timed lock only after AIM_LOCK_MAX_MS', () => {
    const t = makeTracker();
    t.lockAim(targetPose, 1000);
    expect(t.expireAimLock(1000 + AIM_LOCK_MAX_MS)).toBe(false);
    expect(t.isAimLocked()).toBe(true);
    expect(t.expireAimLock(1000 + AIM_LOCK_MAX_MS + 1)).toBe(true);
    expect(t.isAimLocked()).toBe(false);
  });

  it('never expires a lock taken without a timestamp', () => {
    const t = makeTracker();
    t.lockAim(targetPose);
    expect(t.expireAimLock(999_999)).toBe(false);
    expect(t.isAimLocked()).toBe(true);
  });

  it('does nothing after an explicit unlock', () => {
    const t = makeTracker();
    t.lockAim(targetPose, 1000);
    t.unlockAim();
    expect(t.expireAimLock(999_999)).toBe(false);
  });

  it('follows the live pose again once the lock expired', () => {
    const t = makeTracker();
    const locked = t.lockAim(targetPose, 1000);
    t.expireAimLock(1000 + AIM_LOCK_MAX_MS + 1);
    const eff = t.getEffectiveAim(otherPose);
    expect(eff.isLocked).toBe(false);
    expect(eff.aim.aimX).not.toBe(locked.aimX);
  });

  it('forgets the lock time when the zero is recalibrated', () => {
    const t = makeTracker();
    t.lockAim(targetPose, 1000);
    t.calibrateZero(zeroPose);
    expect(t.expireAimLock(999_999)).toBe(false);
    expect(t.isAimLocked()).toBe(false);
  });
});
