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

  it('frames do not undo a reported loss; only release does, and watching starts again', () => {
    const w = new ControllerWatch();
    w.onFrame('R:1', 0);
    w.check(T + 1);
    w.onFrame('R:1', T + 2); // a hidden phone trickling frames
    expect(w.isLost('R:1')).toBe(true);
    expect(w.check(T * 5)).toEqual([]); // not reported again either

    expect(w.release('R:1', T * 5)).toBe(true);
    expect(w.isLost('R:1')).toBe(false);
    expect(w.check(T * 6)).toEqual([]);
    expect(w.check(T * 6 + 1)).toEqual(['R:1']);
  });

  it('release on a live or untracked controller reports false and starts watching', () => {
    const w = new ControllerWatch();
    w.onFrame('R:1', 0);
    expect(w.release('R:1', 10)).toBe(false);
    expect(w.release('R:2', 10)).toBe(false);
    expect(w.check(10 + T + 1).sort()).toEqual(['R:1', 'R:2']);
  });

  it('markLost flags a tracked controller once and stops the timeout from reporting it', () => {
    const w = new ControllerWatch();
    w.onFrame('R:1', 0);
    expect(w.markLost('R:1')).toBe(true);
    expect(w.markLost('R:1')).toBe(false);
    expect(w.check(T * 10)).toEqual([]);
  });

  it('does not track a controller that never sent a frame', () => {
    const w = new ControllerWatch();
    expect(w.markLost('R:2')).toBe(false);
    expect(w.isLost('R:2')).toBe(false);
  });

  it('forget stops tracking', () => {
    const w = new ControllerWatch();
    w.onFrame('R:1', 0);
    w.forget('R:1');
    expect(w.check(T * 10)).toEqual([]);
    expect(w.isLost('R:1')).toBe(false);
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
