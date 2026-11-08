import { describe, it, expect, afterEach, vi } from 'vitest';
import { requestSensorPermission } from '../src/controller/sensors/SensorPermission';

const g = globalThis as Record<string, unknown>;
const saved = { o: g.DeviceOrientationEvent, m: g.DeviceMotionEvent };

describe('requestSensorPermission', () => {
  afterEach(() => {
    g.DeviceOrientationEvent = saved.o;
    g.DeviceMotionEvent = saved.m;
    vi.restoreAllMocks();
  });

  it('grants when the browser has no permission prompt', async () => {
    g.DeviceOrientationEvent = {};
    g.DeviceMotionEvent = {};
    expect(await requestSensorPermission()).toBe('granted');
  });

  it('denies when the orientation prompt is refused', async () => {
    g.DeviceOrientationEvent = { requestPermission: async () => 'denied' };
    g.DeviceMotionEvent = {};
    expect(await requestSensorPermission()).toBe('denied');
  });

  it('grants when orientation is allowed even if the motion prompt fails', async () => {
    g.DeviceOrientationEvent = { requestPermission: async () => 'granted' };
    g.DeviceMotionEvent = { requestPermission: () => Promise.reject(new Error('nope')) };
    expect(await requestSensorPermission()).toBe('granted');
  });

  it('grants when the prompt throws (desktop browsers)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    g.DeviceOrientationEvent = {
      requestPermission: () => {
        throw new Error('not supported');
      },
    };
    expect(await requestSensorPermission()).toBe('granted');
  });
});
