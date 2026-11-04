export interface OneEuroFilterConfig {
  minCutoff: number; // 저속/정지 시 최소 컷오프 주파수 (Hz, 낮을수록 떨림 억제 강함, 기본 1.0)
  beta: number;      // 속도 가중치 계수 (높을수록 빠른 움직임 시 지연 없음, 정규화 도메인 기본 2.5)
  dCutoff: number;   // 도함수(속도) 필터용 컷오프 주파수 (기본 1.0)
  deadzone: number;  // 정지 상태 미세 떨림 무시 임계값 (좌표 단위 -1~1 기준, 기본 0.005)
}

export interface SensorPresets {
  balanced: OneEuroFilterConfig;
  stabilized: OneEuroFilterConfig;
}

export const SENSOR_PRESETS: SensorPresets = {
  balanced: {
    minCutoff: 1.2,
    beta: 3.0,
    dCutoff: 1.0,
    deadzone: 0.003,
  },
  stabilized: {
    minCutoff: 0.4,
    beta: 2.0,
    dCutoff: 1.0,
    deadzone: 0.010,
  },
};


export class LowPassFilter {
  private s: number | null = null;

  public filter(value: number, alpha: number): number {
    if (this.s === null) {
      this.s = value;
      return value;
    }
    this.s = alpha * value + (1 - alpha) * this.s;
    return this.s;
  }

  public filterWithAlpha(value: number, alpha: number): number {
    return this.filter(value, alpha);
  }

  public hasLast(): boolean {
    return this.s !== null;
  }

  public last(): number {
    return this.s ?? 0;
  }

  public reset(): void {
    this.s = null;
  }
}

export function applyDeadzone(current: number, target: number, deadzone: number): number {
  if (deadzone <= 0) {
    return target;
  }
  const diff = target - current;
  if (Math.abs(diff) <= deadzone) {
    return current;
  }
  const sign = diff > 0 ? 1 : -1;
  const excess = Math.abs(diff) - deadzone;
  return current + sign * excess;
}

export class OneEuroFilter {
  private config: OneEuroFilterConfig;
  private xFilt: LowPassFilter = new LowPassFilter();
  private dxFilt: LowPassFilter = new LowPassFilter();
  private lastTimeMs: number | null = null;
  private lastOutput: number | null = null;

  constructor(config?: Partial<OneEuroFilterConfig>) {
    this.config = {
      minCutoff: 1.0,
      beta: 2.5,
      dCutoff: 1.0,
      deadzone: 0.005,
      ...config,
    };
  }

  public reset(): void {
    this.xFilt.reset();
    this.dxFilt.reset();
    this.lastTimeMs = null;
    this.lastOutput = null;
  }

  public setConfig(partial: Partial<OneEuroFilterConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  public getConfig(): OneEuroFilterConfig {
    return { ...this.config };
  }

  private computeAlpha(dt: number, cutoff: number): number {
    const safeCutoff = Math.max(1e-4, cutoff);
    const tau = 1.0 / (2.0 * Math.PI * safeCutoff);
    const alpha = 1.0 / (1.0 + tau / dt);
    return Math.max(0, Math.min(1, alpha));
  }

  public filter(value: number, timestampMs?: number): number {
    const now = timestampMs ?? performance.now();
    if (this.lastTimeMs === null || this.lastOutput === null) {
      this.lastTimeMs = now;
      this.lastOutput = value;
      this.xFilt.filter(value, 1.0);
      this.dxFilt.filter(0, 1.0);
      return value;
    }

    const dt = (now - this.lastTimeMs) / 1000.0;
    this.lastTimeMs = now;

    if (dt <= 0 || dt > 1.0) {
      // 시간 간격이 비정상이거나 1초 이상 중단된 후 재개 시 즉시 리셋 수렴
      this.lastOutput = value;
      this.xFilt.reset();
      this.dxFilt.reset();
      this.xFilt.filter(value, 1.0);
      this.dxFilt.filter(0, 1.0);
      return value;
    }

    // 도함수(속도) 필터링
    const prevX = this.xFilt.last();
    const dx = (value - prevX) / dt;
    const alphaD = this.computeAlpha(dt, this.config.dCutoff);
    const edx = this.dxFilt.filter(dx, alphaD);

    // 적응형 컷오프 주파수 계산
    const cutoff = this.config.minCutoff + this.config.beta * Math.abs(edx);
    const alpha = this.computeAlpha(dt, cutoff);
    const filteredValue = this.xFilt.filter(value, alpha);

    // 데드존 적용
    const finalValue = applyDeadzone(this.lastOutput, filteredValue, this.config.deadzone);
    this.lastOutput = finalValue;
    return finalValue;
  }
}
