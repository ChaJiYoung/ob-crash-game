import { CONTROLLER_LIFECYCLE } from '../../shared/controllerLifecycle';
import type { UnsupportedReason } from '../../shared/types';

export type SensorSupportVerdict = { supported: true } | { supported: false; reason: UnsupportedReason };

type RotationRateLike = { alpha: number | null; beta: number | null; gamma: number | null };

/**
 * rotationRate에 숫자(alpha/beta/gamma 중 하나라도 유한한 숫자)가 있으면 자이로 값이 온 것이다.
 * 0도 정상 값이다(가만히 든 폰도 0 근처의 숫자가 들어온다). null/undefined/전부 null이면 아니다.
 */
export function hasUsableRotationRate(rate: RotationRateLike | null | undefined): boolean {
  if (!rate) return false;
  return [rate.alpha, rate.beta, rate.gamma].some((v) => typeof v === 'number' && Number.isFinite(v));
}

/**
 * motionEvents: 지켜보는 동안 받은 devicemotion 수, gyroEvents: 그중 rotationRate가 쓸 만했던 수.
 * 자이로 값이 하나라도 오면 무조건 통과하므로 검사 순서가 중요하다.
 */
export function decideSensorSupport(motionEvents: number, gyroEvents: number): SensorSupportVerdict {
  if (gyroEvents > 0) return { supported: true };
  if (motionEvents === 0) return { supported: false, reason: 'NO_EVENTS' };
  return { supported: false, reason: 'NO_GYRO' };
}

export interface ProbeOptions {
  /** 기본 CONTROLLER_LIFECYCLE.SENSOR_PROBE_MS */
  durationMs?: number;
  /** 기본 window. 테스트에서 가짜를 넣는다. */
  target?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}

/**
 * 권한 허용 직후 durationMs 동안 devicemotion을 지켜보고 쓸 만한 자이로가 있는지 판정한다.
 * 자이로 값이 오면 기다리지 않고 바로 통과시킨다. 이 함수는 reject하지 않는다.
 * 환경값(import.meta.env)을 읽지 않는다: 개발 모드 우회는 호출하는 쪽에서 한다.
 */
export function probeSensorSupport(options: ProbeOptions = {}): Promise<SensorSupportVerdict> {
  const durationMs = options.durationMs ?? CONTROLLER_LIFECYCLE.SENSOR_PROBE_MS;

  return new Promise<SensorSupportVerdict>((resolve) => {
    let motionEvents = 0;
    let gyroEvents = 0;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let target: ProbeOptions['target'];

    const onMotion = (e: Event) => {
      motionEvents += 1;
      if (hasUsableRotationRate((e as DeviceMotionEvent).rotationRate)) {
        gyroEvents += 1;
        finish({ supported: true });
      }
    };

    const finish = (verdict: SensorSupportVerdict) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      try {
        target?.removeEventListener('devicemotion', onMotion);
      } catch {
        // 비브라우저 환경: 정리할 것이 없다.
      }
      resolve(verdict);
    };

    try {
      target = options.target ?? window;
      target.addEventListener('devicemotion', onMotion);
    } catch {
      // window가 없거나 리스너를 못 붙이면 센서 이벤트를 받을 수 없는 환경이다.
      finish(decideSensorSupport(0, 0));
      return;
    }

    timer = setTimeout(() => finish(decideSensorSupport(motionEvents, gyroEvents)), durationMs);
  });
}
