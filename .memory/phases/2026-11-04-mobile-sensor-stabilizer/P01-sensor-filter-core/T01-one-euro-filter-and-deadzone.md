# Task: T01 적응형 `OneEuroFilter` 및 `Deadzone` 모듈 구현과 단위 테스트

## Status: done


## Goal
가상 자이로 기기(Galaxy A15 등)의 고유한 지자기/가속도 센서 노이즈로 인한 조준선 지터(Jitter)를 물리적으로 제거하면서도 고속 조준 시의 반응 속도를 보존하기 위해, 정지 시 초저주파 필터링과 고속 이동 시 즉시 추적을 수행하는 적응형 `OneEuroFilter` 클래스 및 미세 떨림 완전 무시용 `applyDeadzone` 함수를 독립 모듈로 구현하고 단위 테스트로 검증한다.

## Decision Summary
- [D01] 저속/정지 시 `minCutoff`를 낮춰 떨림을 차단하고, 고속 시 `beta * |speed|`로 컷오프를 높여 0ms 지연 달성.
- [D04] `BALANCED_PRESET`(아이폰/플래그십)과 `STABILIZED_PRESET`(갤럭시 A시리즈 가상 자이로) 기본값 정의.

## Implementation

### I01. 적응형 1€ Filter 및 데드존 알고리즘 구현

- Related Files:
  - `src/controller/sensors/OneEuroFilter.ts` :: `OneEuroFilter`, `LowPassFilter`, `OneEuroFilterConfig`, `applyDeadzone`, `SENSOR_PRESETS` — 센서 적응형 노이즈 필터링 및 프리셋 모듈; new

#### Details
- **Signatures & Types**:
  ```typescript
  export interface OneEuroFilterConfig {
    minCutoff: number; // 저속/정지 시 최소 컷오프 주파수 (Hz, 낮을수록 떨림 억제 강함, 기본 1.0)
    beta: number;      // 속도 가중치 계수 (높을수록 빠른 움직임 시 지연 없음, 기본 0.005)
    dCutoff: number;   // 도함수(속도) 필터용 컷오프 주파수 (기본 1.0)
    deadzone: number;  // 정지 상태 미세 떨림 무시 임계값 (좌표 단위 -1~1 기준, 기본 0.005)
  }

  export interface SensorPresets {
    balanced: OneEuroFilterConfig;
    stabilized: OneEuroFilterConfig;
  }

  export class LowPassFilter {
    private y: number | null = null;
    private s: number | null = null;

    public filter(value: number, alpha: number): number;
    public filterWithAlpha(value: number, alpha: number): number;
    public hasLast(): boolean;
    public last(): number;
    public reset(): void;
  }

  export class OneEuroFilter {
    private config: OneEuroFilterConfig;
    private xFilt: LowPassFilter;
    private dxFilt: LowPassFilter;
    private lastTimeMs: number | null;

    constructor(config?: Partial<OneEuroFilterConfig>);
    public filter(value: number, timestampMs?: number): number;
    public reset(): void;
    public setConfig(partial: Partial<OneEuroFilterConfig>): void;
    public getConfig(): OneEuroFilterConfig;
  }

  export function applyDeadzone(current: number, target: number, deadzone: number): number;
  ```

- **Data & Schema Fields**:
  - `SENSOR_PRESETS`:
    - `balanced`: `{ minCutoff: 1.2, beta: 0.015, dCutoff: 1.0, deadzone: 0.003 }` (아이폰 13 미니 등 고정밀 하드웨어 자이로 기기용, 극상의 반응성)
    - `stabilized`: `{ minCutoff: 0.35, beta: 0.005, dCutoff: 1.0, deadzone: 0.012 }` (갤럭시 A15 등 가상 자이로 기기용, 정지 시 부들부들 떨림 완전 차단)

- **Execution Flow / Logic**:
  1. `LowPassFilter`:
     - 가중치 $\alpha \in (0, 1]$
     - 첫 샘플 시: $y_0 = x_0$ 초기화 후 즉시 반환.
     - 이후 샘플: $\hat{x}_t = \alpha x_t + (1 - \alpha) \hat{x}_{t-1}$
  2. `OneEuroFilter.filter(value, timestampMs)`:
     - `timestampMs` 미제공 시 `performance.now()` 사용.
     - 첫 샘플 또는 이전 타임스탬프와 차이 $dt \le 0$인 경우 초기화 및 날것의 $value$ 반환.
     - 속도(도함수) 계산: $dx = (value - xFilt.last()) / dt$ (단, $dt$는 초 단위 = $ms / 1000$).
     - 도함수 컷오프 계산: $\alpha_{d} = \text{computeAlpha}(dt, dCutoff)$
     - 필터링된 속도 $edx = dxFilt.filter(dx, \alpha_{d})$.
     - 적응형 컷오프 주파수 계산: $cutoff = minCutoff + beta \times |edx|$.
     - 위치 필터 가중치: $\alpha = \text{computeAlpha}(dt, cutoff)$.
     - 1차 필터링 값: $filteredValue = xFilt.filter(value, \alpha)$.
     - 마지막으로 `applyDeadzone(lastReturned, filteredValue, deadzone)` 적용 후 반환.
  3. `applyDeadzone(current, target, deadzone)`:
     - 만약 $|target - current| \le deadzone$ 이면 $current$ 유지 (미세 노이즈 무시).
     - 범위를 벗어나면 변화 방향으로 초과분만큼 점진 반영:
       $diff = target - current$;
       $\text{sign} = diff > 0 ? 1 : -1$;
       $\text{excess} = |diff| - deadzone$;
       반환: $current + \text{sign} \times \text{excess}$.

### I02. `OneEuroFilter` 및 `Deadzone` 단위 테스트 작성

- Related Files:
  - `tests/one-euro-filter.test.ts` :: `OneEuroFilter Suite` — 1€ Filter 수렴, 노이즈 감쇄, 고속 추적, 데드존 필터링 검증; new

#### Details
- **Test Scenarios**:
  1. **정지 상태 미세 지터 제거 검증**:
     - 기준값 `0.5`에 진폭 `±0.01`의 고주파 지터(가상 자이로 노이즈)를 60프레임 주입했을 때, `stabilized` 프리셋 적용 시 출력값의 변화 폭이 `0.001` 이하로 극단적으로 안정화되는지 확인.
  2. **고속 스냅 이동 시 반응성 검증**:
     - `0.0`에서 `0.8`로 급격히 이동하는 스냅 조준 발생 시, 50ms 이내에 80% 이상 수렴하는지 확인 (지연 최소화).
  3. **Deadzone 동작 검증**:
     - `deadzone = 0.01` 설정 시 `0.005`의 미세 변화는 무시되고, `0.05`의 큰 변화는 즉시 감지되어 이동하는지 확인.
  4. **프리셋 전환 및 설정 갱신 검증**:
     - `setConfig`로 프리셋 파라미터가 실시간 변경되고 즉시 반영되는지 확인.

## Acceptance Criteria
- [ ] `OneEuroFilter.ts` 파일이 생성되고 `OneEuroFilter`, `LowPassFilter`, `applyDeadzone`, `SENSOR_PRESETS`가 export 됨.
- [ ] 정지 상태의 가상 자이로 노이즈(지터)가 필터를 통과하면 RMS 오차가 80% 이상 감쇄됨.
- [ ] 데드존 범위 이내의 미세 흔들림은 이전 위치를 유지하여 조준선이 가만히 멈춰 있음.
- [ ] `tests/one-euro-filter.test.ts` 테스트가 100% 통과함.

## Validation
- `npx vitest run tests/one-euro-filter.test.ts` — 테스트 4개 이상 전부 통과 (PASS)

## Commit Message
```text
feat(sensor): implement OneEuroFilter and deadzone noise suppression module

Plan: 2026-11-04-mobile-sensor-stabilizer
Phase: P01-sensor-filter-core
Task: T01-one-euro-filter-and-deadzone

- Add adaptive OneEuroFilter for low-speed jitter elimination and high-speed responsiveness
- Add applyDeadzone function to eliminate stationary sensor drift
- Export balanced and stabilized presets for iOS and Galaxy A series
- Add comprehensive unit tests in tests/one-euro-filter.test.ts
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done

