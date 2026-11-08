import { describe, it, expect } from 'vitest';
import { ControllerWatch, watchKey, parseWatchKey } from '../server/ControllerWatch';
import { CONTROLLER_LIFECYCLE } from '../src/shared/controllerLifecycle';

const T = CONTROLLER_LIFECYCLE.FRAME_TIMEOUT_MS;

describe('ControllerWatch', () => {
  it('keeps a controller alive until the timeout is exceeded, and reports it once', () => {
    const w = new ControllerWatch();
    w.onFrame('R:1', 1000);
    expect(w.check(1000 + T)).toEqual([]);
    expect(w.check(1000 + T + 1)).toEqual(['R:1']);
    expect(w.check(1000 + T + 2)).toEqual([]);
  });

  it('reports recovery on the first frame after a loss, then goes back to ok', () => {
    const w = new ControllerWatch();
    w.onFrame('R:1', 0);
    w.check(T + 1);
    expect(w.onFrame('R:1', T + 2)).toBe('recovered');
    expect(w.onFrame('R:1', T + 3)).toBe('ok');
    // and it can be lost again later
    expect(w.check(T + 3 + T + 1)).toEqual(['R:1']);
  });

  it('markLost flags once and stops the timeout from reporting the same loss', () => {
    const w = new ControllerWatch();
    w.onFrame('R:1', 0);
    expect(w.markLost('R:1')).toBe(true);
    expect(w.markLost('R:1')).toBe(false);
    expect(w.check(T * 10)).toEqual([]);
    expect(w.onFrame('R:1', T * 10)).toBe('recovered');
  });

  it('markLost works for a controller that never sent a frame', () => {
    const w = new ControllerWatch();
    expect(w.markLost('R:2')).toBe(true);
    expect(w.onFrame('R:2', 5)).toBe('recovered');
  });

  it('forget stops tracking', () => {
    const w = new ControllerWatch();
    w.onFrame('R:1', 0);
    w.forget('R:1');
    expect(w.check(T * 10)).toEqual([]);
    expect(w.onFrame('R:1', T * 10)).toBe('ok');
  });

  it('tracks controllers independently and honours an explicit timeout', () => {
    const w = new ControllerWatch();
    w.onFrame('R:1', 0);
    w.onFrame('R:2', 900);
    expect(w.check(1000, 500)).toEqual(['R:1']);
    expect(w.check(1500, 500)).toEqual(['R:2']);
  });

  it('round-trips watch keys', () => {
    expect(parseWatchKey(watchKey('ABCD', 2))).toEqual({ roomId: 'ABCD', slot: 2 });
    expect(parseWatchKey(watchKey('ABCD', 1))).toEqual({ roomId: 'ABCD', slot: 1 });
  });
});
