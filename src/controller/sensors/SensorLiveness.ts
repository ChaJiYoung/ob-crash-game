/** 센서 이벤트가 이 시간(ms) 넘게 없으면 멈춘 것으로 본다. P02 실기기 로그로 확정. */
export const SENSOR_STALE_MS = 2000;

/**
 * 센서 이벤트가 마지막으로 온 시각을 기억하고, 일정 시간 넘게 끊겼는지 판단한다.
 * 시간은 항상 인자로 받는다(테스트가 쉽고, 실행 환경의 시계에 묶이지 않는다).
 */
export class SensorLiveness {
  private lastEventMs: number;

  constructor(nowMs = 0) {
    this.lastEventMs = nowMs;
  }

  /** 센서 이벤트를 받았을 때 호출. */
  public markEvent(nowMs: number): void {
    this.lastEventMs = nowMs;
  }

  /** 리스너를 (재)등록한 직후 호출: 유예 시간을 새로 시작한다. */
  public reset(nowMs: number): void {
    this.lastEventMs = nowMs;
  }

  /** 마지막 이벤트(또는 reset) 이후 thresholdMs를 초과했으면 true. 같은 값은 stale이 아니다. */
  public isStale(nowMs: number, thresholdMs: number = SENSOR_STALE_MS): boolean {
    return nowMs - this.lastEventMs > thresholdMs;
  }

  /** 마지막 이벤트(또는 reset) 이후 경과 시간(ms). 시계가 거꾸로 가도 0 이상. */
  public elapsedMs(nowMs: number): number {
    return Math.max(0, nowMs - this.lastEventMs);
  }
}
