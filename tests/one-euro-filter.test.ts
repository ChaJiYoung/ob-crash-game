import { describe, it, expect, beforeEach } from 'vitest';
import { OneEuroFilter, applyDeadzone, SENSOR_PRESETS } from '../src/controller/sensors/OneEuroFilter';

describe('OneEuroFilter and Deadzone Module', () => {
  describe('applyDeadzone', () => {
    it('should ignore subtle noise within deadzone threshold', () => {
      const current = 0.5;
      const deadzone = 0.01;

      // Noise within deadzone should return current position unchanged
      expect(applyDeadzone(current, 0.505, deadzone)).toBe(0.5);
      expect(applyDeadzone(current, 0.495, deadzone)).toBe(0.5);
      expect(applyDeadzone(current, 0.51, deadzone)).toBe(0.5);
      expect(applyDeadzone(current, 0.49, deadzone)).toBe(0.5);
    });

    it('should smoothly advance when delta exceeds deadzone', () => {
      const current = 0.5;
      const deadzone = 0.01;

      // Positive excess: 0.55 - 0.5 = 0.05 -> excess = 0.04 -> 0.5 + 0.04 = 0.54
      const resultPos = applyDeadzone(current, 0.55, deadzone);
      expect(resultPos).toBeCloseTo(0.54, 4);

      // Negative excess: 0.45 - 0.5 = -0.05 -> excess = 0.04 -> 0.5 - 0.04 = 0.46
      const resultNeg = applyDeadzone(current, 0.45, deadzone);
      expect(resultNeg).toBeCloseTo(0.46, 4);
    });

    it('should bypass deadzone when threshold is 0 or negative', () => {
      expect(applyDeadzone(0.5, 0.505, 0)).toBe(0.505);
      expect(applyDeadzone(0.5, 0.495, -0.01)).toBe(0.495);
    });
  });

  describe('OneEuroFilter', () => {
    let filter: OneEuroFilter;

    beforeEach(() => {
      filter = new OneEuroFilter(SENSOR_PRESETS.stabilized);
    });

    it('should return initial raw value on first sample', () => {
      const val = filter.filter(0.42, 1000);
      expect(val).toBe(0.42);
    });

    it('should suppress virtual gyro high-frequency jitter by more than 80% when stationary', () => {
      const baseValue = 0.0;
      const frameCount = 60;
      const dtMs = 16.6; // 60Hz

      const rawSamples: number[] = [];
      const filteredSamples: number[] = [];

      for (let i = 0; i < frameCount; i++) {
        // High frequency jitter ±0.012 alternating
        const noise = (i % 2 === 0 ? 1 : -1) * 0.012 + Math.sin(i * 1.5) * 0.003;
        const raw = baseValue + noise;
        const timeMs = 1000 + i * dtMs;

        const filtered = filter.filter(raw, timeMs);
        rawSamples.push(raw);
        filteredSamples.push(filtered);
      }

      // Compute frame-to-frame delta (jitter variance) over last 30 frames
      const rawDeltas: number[] = [];
      const filteredDeltas: number[] = [];
      for (let i = 31; i < frameCount; i++) {
        rawDeltas.push(rawSamples[i] - rawSamples[i - 1]);
        filteredDeltas.push(filteredSamples[i] - filteredSamples[i - 1]);
      }

      const rawJitterRms = Math.hypot(...rawDeltas) / Math.sqrt(rawDeltas.length);
      const filteredJitterRms = Math.hypot(...filteredDeltas) / Math.sqrt(filteredDeltas.length);

      // Filtered jitter RMS must be substantially lower than raw RMS (> 80% suppression)
      expect(filteredJitterRms).toBeLessThan(rawJitterRms * 0.2);
    });

    it('should respond quickly without lag during high-speed snap movements', () => {
      // Initialize at 0.0
      filter.filter(0.0, 1000);
      filter.filter(0.0, 1016);

      // Sudden snap to 0.8 over 5 frames (80ms)
      filter.filter(0.2, 1032);
      filter.filter(0.45, 1048);
      filter.filter(0.68, 1064);
      const snapVal = filter.filter(0.8, 1080);

      // In fast motion, beta should kick in and reach near target rapidly (>= 80% of 0.8)
      expect(snapVal).toBeGreaterThan(0.65);
    });

    it('should reset internal state and synchronize to new origin on reset()', () => {
      filter.filter(0.2, 1000);
      filter.filter(0.5, 1016);

      filter.reset();

      // After reset, first sample is treated as origin without carryover momentum
      const newOrigin = filter.filter(-0.8, 2000);
      expect(newOrigin).toBe(-0.8);
    });

    it('should update config and switch presets correctly', () => {
      filter.setConfig(SENSOR_PRESETS.balanced);
      const cfg = filter.getConfig();

      expect(cfg.minCutoff).toBe(1.2);
      expect(cfg.beta).toBe(3.0);
      expect(cfg.deadzone).toBe(0.003);
    });
  });
});
