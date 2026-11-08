import { describe, it, expect, vi } from 'vitest';
import { attachContextLossGuard } from '../src/pc/three/webglContextGuard';

/** webgl-context-loss D02: 가짜 EventTarget과 수동 타이머 큐로 WebGL 없이 검증한다. */
function setup(disposed = { v: false }) {
  const canvas = new EventTarget();
  const timers: { fn: () => void; ms: number; id: number }[] = [];
  let nextId = 1;
  const onLost = vi.fn();
  const onRestored = vi.fn();
  const onGiveUp = vi.fn();
  const guard = attachContextLossGuard(canvas, {
    isDisposed: () => disposed.v,
    onLost,
    onRestored,
    onGiveUp,
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.push({ fn, ms, id });
      return id;
    },
    clearTimer: (id) => {
      const i = timers.findIndex((t) => t.id === id);
      if (i >= 0) timers.splice(i, 1);
    },
  });
  const lose = () => {
    const e = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(e);
    return e;
  };
  const restore = () => canvas.dispatchEvent(new Event('webglcontextrestored'));
  const fireTimers = () => timers.splice(0).forEach((t) => t.fn());
  return { guard, timers, onLost, onRestored, onGiveUp, lose, restore, fireTimers, disposed };
}

describe('attachContextLossGuard', () => {
  it('requests a restore, pauses once and reports lost', () => {
    const s = setup();
    const e = s.lose();
    expect(e.defaultPrevented).toBe(true);
    expect(s.onLost).toHaveBeenCalledTimes(1);
    expect(s.guard.isLost()).toBe(true);
    expect(s.timers).toHaveLength(1);
    expect(s.timers[0].ms).toBe(3000);
  });

  it('calls onRestored when the context comes back in time', () => {
    const s = setup();
    s.lose();
    s.restore();
    expect(s.onRestored).toHaveBeenCalledTimes(1);
    expect(s.onGiveUp).not.toHaveBeenCalled();
    expect(s.timers).toHaveLength(0);
    expect(s.guard.isLost()).toBe(false);
  });

  it('gives up after the wait and ignores a late restore', () => {
    const s = setup();
    s.lose();
    s.fireTimers();
    expect(s.onGiveUp).toHaveBeenCalledTimes(1);
    s.restore();
    expect(s.onRestored).not.toHaveBeenCalled();
  });

  it('ignores the loss caused by our own cleanup (disposed)', () => {
    const s = setup({ v: true });
    const e = s.lose();
    expect(e.defaultPrevented).toBe(false);
    expect(s.onLost).not.toHaveBeenCalled();
    expect(s.timers).toHaveLength(0);
  });

  it('handles repeated loss events with one pause and one timer', () => {
    const s = setup();
    s.lose();
    s.lose();
    expect(s.onLost).toHaveBeenCalledTimes(1);
    expect(s.timers).toHaveLength(1);
  });

  it('stops listening and clears the timer on detach', () => {
    const s = setup();
    s.lose();
    s.guard.detach();
    expect(s.timers).toHaveLength(0);
    s.restore();
    s.lose();
    expect(s.onRestored).not.toHaveBeenCalled();
    expect(s.onLost).toHaveBeenCalledTimes(1);
  });
});
