import { describe, it, expect, beforeEach } from 'vitest';
import { GunGripTracker } from '../src/controller/sensors/GunGripTracker';
import {
  DEFAULT_TUNING_CONFIG,
  loadSavedTuningConfig,
  saveTuningConfig,
  SensorTuningConfig,
} from '../src/pc/components/MobileSensorLabModal';

describe('Mobile Sensor Stabilizer E2E Suite (Galaxy A15 vs iPhone 13 mini)', () => {
  let tracker: GunGripTracker;
  const zeroPose = { alpha: 180, beta: 0, gamma: -85 };

  beforeEach(() => {
    tracker = new GunGripTracker();
    tracker.calibrateZero(zeroPose);
  });

  it('Scenario 1: iPhone 13 mini default mode must 100% preserve original raw responsiveness without 1€ Filter', () => {
    // Default mode is false
    expect(tracker.isStabilized()).toBe(false);

    // Provide a sample turn
    const aimResult = tracker.computeAim({ alpha: 165, beta: 0, gamma: -85 });
    expect(aimResult.aimX).toBeGreaterThan(0.2);
    expect(aimResult.rawAimX).toBeGreaterThan(0.2);

    // Delta between rawAimX and aimX should follow legacy exponential smoothing
    // In legacy logic with delta > 0.15, effectiveAlpha is 1.0 (instant snap)
    expect(aimResult.aimX).toBeCloseTo(aimResult.rawAimX, 2);
  });

  it('Scenario 2: Galaxy A15 virtual gyro jitter simulation must be suppressed by > 85% in stabilized mode', () => {
    tracker.setStabilizedMode(true);
    tracker.applyPreset('stabilized');
    expect(tracker.isStabilized()).toBe(true);

    const frameCount = 100;
    const dtMs = 16.6; // 60Hz
    const rawXList: number[] = [];
    const aimXList: number[] = [];

    // Simulate resting gun-grip pointing at monitor with noisy geomagnetic sensor oscillation
    for (let i = 0; i < frameCount; i++) {
      // High-frequency jitter ±0.6 degrees on alpha (~ ±0.024 on rawAimX)
      const jitterAlpha = (i % 2 === 0 ? 1 : -1) * 0.6 + Math.sin(i * 1.8) * 0.2;
      const sample = { alpha: 180 + jitterAlpha, beta: 0, gamma: -85 };
      const timeMs = 1000 + i * dtMs;

      const result = tracker.computeAim(sample, 0.92, timeMs);
      rawXList.push(result.rawAimX);
      aimXList.push(result.aimX);
    }

    // Evaluate jitter variance (frame-to-frame delta RMS) over the last 50 frames
    const rawDeltas: number[] = [];
    const aimDeltas: number[] = [];
    for (let i = 51; i < frameCount; i++) {
      rawDeltas.push(rawXList[i] - rawXList[i - 1]);
      aimDeltas.push(aimXList[i] - aimXList[i - 1]);
    }

    const rawJitterRms = Math.hypot(...rawDeltas) / Math.sqrt(rawDeltas.length);
    const aimJitterRms = Math.hypot(...aimDeltas) / Math.sqrt(aimDeltas.length);

    expect(rawJitterRms).toBeGreaterThan(0.015);
    // Aim jitter must be suppressed by more than 85% (less than 15% of raw noise)
    expect(aimJitterRms).toBeLessThan(rawJitterRms * 0.15);
  });

  it('Scenario 3: Stationary deadzone must completely lock crosshair to 0 movement during micro-drifts', () => {
    tracker.setStabilizedMode(true);
    tracker.applyPreset('stabilized');

    // Initial steady position at (0, 0)
    tracker.computeAim({ alpha: 180, beta: 0, gamma: -85 }, 0.92, 1000);
    const lockedResult1 = tracker.computeAim({ alpha: 180, beta: 0, gamma: -85 }, 0.92, 1016);
    const initialAimX = lockedResult1.aimX;

    // Subtle drift well within deadzone (0.1 degree ≈ 0.004 in rawAimX < 0.010 deadzone)
    const driftResult1 = tracker.computeAim({ alpha: 180.1, beta: 0, gamma: -85 }, 0.92, 1032);
    expect(driftResult1.aimX).toBe(initialAimX);

    const driftResult2 = tracker.computeAim({ alpha: 179.92, beta: 0, gamma: -85 }, 0.92, 1048);
    expect(driftResult2.aimX).toBe(initialAimX);
  });

  it('Scenario 4: High-speed snap flick must reach target rapidly without lagging or overshooting', () => {
    tracker.setStabilizedMode(true);
    tracker.applyPreset('stabilized');

    // Resting at center
    tracker.computeAim({ alpha: 180, beta: 0, gamma: -85 }, 0.92, 1000);
    tracker.computeAim({ alpha: 180, beta: 0, gamma: -85 }, 0.92, 1016);

    // Rapid wrist flick to right (alpha 180 -> 160 over 4 frames: ~20 degrees yaw)
    tracker.computeAim({ alpha: 175, beta: 0, gamma: -85 }, 0.92, 1032);
    tracker.computeAim({ alpha: 168, beta: 0, gamma: -85 }, 0.92, 1048);
    tracker.computeAim({ alpha: 162, beta: 0, gamma: -85 }, 0.92, 1064);
    const finalSnap = tracker.computeAim({ alpha: 160, beta: 0, gamma: -85 }, 0.92, 1080);

    // Should closely track raw aim with high fidelity during fast motion
    expect(finalSnap.aimX).toBeGreaterThan(0.65);
    expect(finalSnap.rawAimX).toBeGreaterThan(0.75);
  });

  it('Scenario 5: MobileSensorLabModal configuration storage and preset roundtrip', () => {
    const memoryStore: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => memoryStore[key] || null,
      setItem: (key: string, val: string) => {
        memoryStore[key] = val;
      },
    };

    // Default configuration: iPhone mode
    const initialConfig = loadSavedTuningConfig(mockStorage);
    expect(initialConfig.isStabilizedMode).toBe(false);
    expect(initialConfig.preset).toBe('default_iphone');

    // Switch to Galaxy A series stabilized preset
    const galaxyPreset: SensorTuningConfig = {
      ...initialConfig,
      isStabilizedMode: true,
      minCutoff: 0.4,
      beta: 2.0,
      deadzone: 0.01,
      preset: 'stabilized_galaxy',
    };
    saveTuningConfig(galaxyPreset, mockStorage);

    // Reload from storage
    const reloaded = loadSavedTuningConfig(mockStorage);
    expect(reloaded.isStabilizedMode).toBe(true);
    expect(reloaded.preset).toBe('stabilized_galaxy');
    expect(reloaded.minCutoff).toBe(0.4);
    expect(reloaded.deadzone).toBe(0.01);
  });
});
