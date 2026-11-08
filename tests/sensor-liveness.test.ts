import { describe, it, expect } from 'vitest';
import { SensorLiveness, SENSOR_STALE_MS } from '../src/controller/sensors/SensorLiveness';

describe('SensorLiveness', () => {
  it('is not stale right after an event', () => {
    const l = new SensorLiveness(1000);
    l.markEvent(1000);
    expect(l.isStale(1000)).toBe(false);
  });

  it('treats the exact threshold as alive and 1ms past it as stale', () => {
    const l = new SensorLiveness(0);
    l.markEvent(1000);
    expect(l.isStale(1000 + SENSOR_STALE_MS)).toBe(false);
    expect(l.isStale(1000 + SENSOR_STALE_MS + 1)).toBe(true);
  });

  it('recovers after a new event', () => {
    const l = new SensorLiveness(0);
    expect(l.isStale(SENSOR_STALE_MS + 500)).toBe(true);
    l.markEvent(SENSOR_STALE_MS + 500);
    expect(l.isStale(SENSOR_STALE_MS + 600)).toBe(false);
  });

  it('reset starts a fresh grace period', () => {
    const l = new SensorLiveness(0);
    expect(l.isStale(10_000)).toBe(true);
    l.reset(10_000);
    expect(l.isStale(10_000)).toBe(false);
    expect(l.isStale(10_000 + SENSOR_STALE_MS + 1)).toBe(true);
  });

  it('never reports stale when the clock goes backwards', () => {
    const l = new SensorLiveness(0);
    l.markEvent(5000);
    expect(l.isStale(4000)).toBe(false);
    expect(l.elapsedMs(4000)).toBe(0);
  });

  it('uses an explicit threshold over the default', () => {
    const l = new SensorLiveness(0);
    l.markEvent(0);
    expect(l.isStale(500, 400)).toBe(true);
    expect(l.isStale(500, 600)).toBe(false);
    expect(l.elapsedMs(500)).toBe(500);
  });
});
