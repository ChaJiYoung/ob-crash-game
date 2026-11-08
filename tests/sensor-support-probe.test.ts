import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  decideSensorSupport,
  hasUsableRotationRate,
  probeSensorSupport,
} from '../src/controller/sensors/SensorSupportProbe';
import { CONTROLLER_LIFECYCLE } from '../src/shared/controllerLifecycle';

type Handler = (e: Event) => void;

/** 가짜 target: 등록된 devicemotion 핸들러를 모아 두고 테스트가 직접 호출한다. */
const makeTarget = () => {
  const handlers = new Set<Handler>();
  const target = {
    addEventListener: vi.fn((type: string, h: Handler) => {
      if (type === 'devicemotion') handlers.add(h);
    }),
    removeEventListener: vi.fn((type: string, h: Handler) => {
      if (type === 'devicemotion') handlers.delete(h);
    }),
  } as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>;
  const emit = (rotationRate: unknown) => {
    for (const h of [...handlers]) h({ rotationRate } as unknown as Event);
  };
  return { target, handlers, emit };
};

describe('hasUsableRotationRate', () => {
  it('null/undefined/전부 null이면 자이로 값이 아니다', () => {
    expect(hasUsableRotationRate(null)).toBe(false);
    expect(hasUsableRotationRate(undefined)).toBe(false);
    expect(hasUsableRotationRate({ alpha: null, beta: null, gamma: null })).toBe(false);
  });

  it('0은 정상 값이다(가만히 든 폰)', () => {
    expect(hasUsableRotationRate({ alpha: 0, beta: 0, gamma: 0 })).toBe(true);
  });

  it('유한하지 않은 숫자는 값으로 치지 않는다', () => {
    expect(hasUsableRotationRate({ alpha: NaN, beta: null, gamma: null })).toBe(false);
    expect(hasUsableRotationRate({ alpha: Infinity, beta: null, gamma: null })).toBe(false);
    expect(hasUsableRotationRate({ alpha: NaN, beta: 0.01, gamma: null })).toBe(true);
  });
});

describe('decideSensorSupport', () => {
  it('이벤트가 하나도 없으면 NO_EVENTS', () => {
    expect(decideSensorSupport(0, 0)).toEqual({ supported: false, reason: 'NO_EVENTS' });
  });

  it('이벤트는 오는데 자이로 값이 없으면 NO_GYRO', () => {
    expect(decideSensorSupport(5, 0)).toEqual({ supported: false, reason: 'NO_GYRO' });
  });

  it('자이로 값이 하나라도 있으면 통과(검사 순서)', () => {
    expect(decideSensorSupport(5, 1)).toEqual({ supported: true });
    expect(decideSensorSupport(0, 1)).toEqual({ supported: true });
  });
});

describe('probeSensorSupport', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('기본 관찰 시간은 SENSOR_PROBE_MS(1초)다', () => {
    expect(CONTROLLER_LIFECYCLE.SENSOR_PROBE_MS).toBe(1000);
  });

  it('자이로 값이 담긴 이벤트가 오면 기다리지 않고 즉시 통과하고 리스너를 뗀다', async () => {
    vi.useFakeTimers();
    const { target, handlers, emit } = makeTarget();
    const p = probeSensorSupport({ target, durationMs: 1000 });
    expect(handlers.size).toBe(1);
    emit({ alpha: 0, beta: 0, gamma: 0 });
    await expect(p).resolves.toEqual({ supported: true });
    expect(handlers.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rotationRate가 null인 이벤트만 오면 시간이 지난 뒤 NO_GYRO', async () => {
    vi.useFakeTimers();
    const { target, handlers, emit } = makeTarget();
    const p = probeSensorSupport({ target, durationMs: 1000 });
    emit(null);
    emit(null);
    emit(null);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toEqual({ supported: false, reason: 'NO_GYRO' });
    expect(handlers.size).toBe(0);
  });

  it('이벤트가 없으면 시간이 지난 뒤 NO_EVENTS', async () => {
    vi.useFakeTimers();
    const { target } = makeTarget();
    const p = probeSensorSupport({ target, durationMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toEqual({ supported: false, reason: 'NO_EVENTS' });
  });

  it('관찰 시간이 끝나기 전에는 결과를 내지 않는다', async () => {
    vi.useFakeTimers();
    const { target } = makeTarget();
    let done = false;
    const p = probeSensorSupport({ target, durationMs: 1000 }).then((v) => {
      done = true;
      return v;
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
  });

  it('addEventListener가 던져도 reject하지 않고 NO_EVENTS로 끝난다', async () => {
    const target = {
      addEventListener: () => {
        throw new Error('no window');
      },
      removeEventListener: () => {},
    } as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>;
    await expect(probeSensorSupport({ target })).resolves.toEqual({ supported: false, reason: 'NO_EVENTS' });
  });

  it('즉시 통과한 뒤 타이머가 지나가도 결과가 바뀌지 않는다', async () => {
    vi.useFakeTimers();
    const { target, emit } = makeTarget();
    const p = probeSensorSupport({ target, durationMs: 1000 });
    emit({ alpha: 0.1, beta: null, gamma: null });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(p).resolves.toEqual({ supported: true });
  });

  it('window도 target도 없으면(비브라우저) NO_EVENTS', async () => {
    await expect(probeSensorSupport()).resolves.toEqual({ supported: false, reason: 'NO_EVENTS' });
  });
});
