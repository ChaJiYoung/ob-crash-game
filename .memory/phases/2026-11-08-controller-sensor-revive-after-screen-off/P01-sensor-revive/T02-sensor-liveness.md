# Task: T02 센서 이벤트 정지 판정 헬퍼

## Status: done

## Goal
"센서 이벤트가 마지막으로 온 뒤 일정 시간이 지났는가"를 판단하는 순수 클래스 `SensorLiveness`를 만든다. T03의 워치독이 이 클래스를 쓰고, 시간을 인자로 받으므로 테스트가 쉽다.

## Decision Summary
- D06 ③: 워치독 판정 로직을 페이지 컴포넌트 밖으로 빼서 단위 테스트한다. 컴포넌트 안에 넣으면 테스트할 수 없다.
- 임계값은 임시 2000ms. P02에서 실기기 로그를 보고 확정한다.

## Implementation

### I01. SensorLiveness 클래스

- Related Files:
  - `src/controller/sensors/SensorLiveness.ts` :: `SensorLiveness`, `SENSOR_STALE_MS` — 이벤트 정지 판정; new

#### Details
- **Signatures & Types**:
  ```typescript
  /** 센서 이벤트가 이 시간(ms) 넘게 없으면 멈춘 것으로 본다. P02 실기기 로그로 확정. */
  export const SENSOR_STALE_MS = 2000;

  export class SensorLiveness {
    constructor(nowMs?: number);            // 기본값 0
    /** 센서 이벤트를 받았을 때 호출. */
    markEvent(nowMs: number): void;
    /** 리스너를 (재)등록한 직후 호출: 유예 시간을 새로 시작한다. */
    reset(nowMs: number): void;
    /** 마지막 이벤트(또는 reset) 이후 thresholdMs를 초과했으면 true. */
    isStale(nowMs: number, thresholdMs?: number): boolean;
    /** 마지막 이벤트(또는 reset) 이후 경과 시간(ms). 디버그 로그용. */
    elapsedMs(nowMs: number): number;
  }
  ```
- **Data & Schema Fields**: `private lastEventMs: number` 하나.
- **Execution Flow / Logic**:
  1. `markEvent`와 `reset`은 `lastEventMs = nowMs`.
  2. `isStale`은 `nowMs - lastEventMs > thresholdMs` (기본 `SENSOR_STALE_MS`). 경계값(같을 때)은 stale 아님.
  3. `elapsedMs`는 `Math.max(0, nowMs - lastEventMs)`.
  4. 시계가 뒤로 가는 경우(음수)도 `elapsedMs`가 0으로 처리되므로 `isStale`은 false.

### I02. 단위 테스트

- Related Files:
  - `tests/sensor-liveness.test.ts` :: `describe('SensorLiveness')` — 테스트; new

#### Details
- 이벤트 직후 `isStale(now)` false.
- 임계값 정확히 같을 때 false, 1ms 초과 시 true.
- `markEvent` 후 다시 false로 돌아옴.
- `reset(now)` 후 유예가 새로 시작됨 (오래 stale이었다가 reset하면 false).
- `nowMs`가 `lastEventMs`보다 작아도(시계 역행) `isStale` false, `elapsedMs` 0.
- `thresholdMs`를 직접 넘기면 기본값 대신 적용됨.

## Acceptance Criteria
- [ ] `SensorLiveness`와 `SENSOR_STALE_MS`가 export된다.
- [ ] 경계값·reset·시계 역행 테스트가 통과한다.

## Validation
- `npx vitest run tests/sensor-liveness.test.ts` — 전체 통과
- `npx tsc --noEmit` — 타입 오류 없음

## Commit Message
```text
feat(controller): 센서 이벤트 정지 판정 헬퍼 SensorLiveness 추가

Plan: 2026-11-08-controller-sensor-revive-after-screen-off
Phase: P01-sensor-revive
Task: T02-sensor-liveness

- markEvent/reset/isStale/elapsedMs를 가진 순수 클래스
- 임시 임계값 SENSOR_STALE_MS=2000 (실기기 로그로 확정 예정)
- 경계값·reset·시계 역행 단위 테스트
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
