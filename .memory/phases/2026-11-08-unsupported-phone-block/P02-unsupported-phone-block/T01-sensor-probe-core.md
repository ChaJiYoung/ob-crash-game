# Task: T01 센서 판별 코어

## Status: done

## Goal
폰이 센서 권한을 허용한 직후 "이 기기에 쓸 만한 자이로가 있는지"를 1초 안에 판정하는 모듈을 만든다. 화면 연결은 T04에서 한다. 이 Task는 판정 규칙(순수 함수)과 실측 함수, 상수, 단위 테스트까지다.

## Decision Summary
- D01: `devicemotion` 이벤트를 관찰해, 이벤트가 하나도 안 오면 미지원(`NO_EVENTS`), 이벤트는 오는데 `rotationRate`가 계속 `null`이면 미지원(`NO_GYRO`). 값이 0에 가깝다는 이유로는 막지 않는다(가만히 든 정상 폰도 작은 숫자로 들어온다).
- D12: `SensorPermission.ts`는 수정하지 않는다. 이 모듈은 권한 허용 뒤에 따로 실행된다.
- 함정: 테스트 환경(vitest)에서는 `import.meta.env.DEV === true`다. 개발 모드 우회는 호출부(T04)에 두고, 이 모듈은 환경값을 읽지 않는다. 그래야 단위 테스트가 환경에 영향받지 않는다.

## Implementation

### I01. 상수와 타입
- Related Files:
  - `src/shared/controllerLifecycle.ts` :: `CONTROLLER_LIFECYCLE` — `SENSOR_PROBE_MS` 추가; modify
  - `src/shared/types.ts` :: `UnsupportedReason` — 서버·폰 공용 타입 추가; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // controllerLifecycle.ts, AUTO_ZERO_FALLBACK_MS 아래
  /** 센서 권한 허용 뒤 기기가 쓸 만한 자이로를 가졌는지 지켜보는 시간. 이 시간 안에 자이로 값이 한 번도 안 오면 미지원. */
  SENSOR_PROBE_MS: 1000,

  // types.ts (ClientToServerMessage 위)
  export type UnsupportedReason = 'NO_EVENTS' | 'NO_GYRO';
  ```

### I02. 판정 함수와 실측 함수
- Related Files:
  - `src/controller/sensors/SensorSupportProbe.ts` :: `decideSensorSupport`, `hasUsableRotationRate`, `probeSensorSupport`, `SensorSupportVerdict` — new

#### Details
- **Signatures & Types**:
  ```typescript
  import { CONTROLLER_LIFECYCLE } from '../../shared/controllerLifecycle';
  import type { UnsupportedReason } from '../../shared/types';

  export type SensorSupportVerdict = { supported: true } | { supported: false; reason: UnsupportedReason };

  /** rotationRate에 숫자(alpha/beta/gamma 중 하나라도 유한한 숫자)가 있으면 자이로 값이 온 것이다. null/undefined/전부 null이면 아니다. */
  export function hasUsableRotationRate(rate: { alpha: number | null; beta: number | null; gamma: number | null } | null | undefined): boolean;

  /** motionEvents: 지켜보는 동안 받은 devicemotion 수, gyroEvents: 그중 rotationRate가 쓸 만했던 수. */
  export function decideSensorSupport(motionEvents: number, gyroEvents: number): SensorSupportVerdict;

  export interface ProbeOptions {
    durationMs?: number; // 기본 CONTROLLER_LIFECYCLE.SENSOR_PROBE_MS
    target?: Pick<Window, 'addEventListener' | 'removeEventListener'>; // 기본 window
  }
  export function probeSensorSupport(options?: ProbeOptions): Promise<SensorSupportVerdict>;
  ```
- **Execution Flow / Logic**:
  1. `decideSensorSupport`: `gyroEvents > 0` → `{ supported: true }`; 그다음 `motionEvents === 0` → `{ supported: false, reason: 'NO_EVENTS' }`; 그 외(이벤트는 왔지만 자이로 값 없음) → `{ supported: false, reason: 'NO_GYRO' }`. 순서가 중요하다(자이로 값이 하나라도 오면 무조건 통과).
  2. `probeSensorSupport`: `target.addEventListener('devicemotion', onMotion)`을 달고 `setTimeout(durationMs)`을 건다. `onMotion`에서 `motionEvents++`, `hasUsableRotationRate(e.rotationRate)`이면 `gyroEvents++` 후 **즉시** 리스너를 떼고 타이머를 지운 뒤 `{ supported: true }`로 resolve(정상 폰은 1초를 다 기다리지 않는다). 타이머가 끝나면 리스너를 떼고 `decideSensorSupport(motionEvents, gyroEvents)`로 resolve한다.
  3. 에러 처리: `addEventListener`가 던지면(`target`이 없는 비브라우저 환경) `decideSensorSupport(0, 0)` 결과(`NO_EVENTS`)로 resolve한다. Promise는 reject하지 않는다.
  4. 함정: 리스너와 타이머는 어느 경로로 끝나도 한 번만 정리해야 한다(이중 resolve 방지용 `settled` 플래그). `deviceorientation`은 보지 않는다: 가상 자이로 기기도 방위 이벤트는 오기 때문에 판별에 쓸 수 없다.
  5. 함정: `hasUsableRotationRate`는 `Number.isFinite`로 검사한다. `0`은 정상 값이다(`0 || ...` 같은 falsy 검사를 쓰면 가만히 든 폰이 `NO_GYRO`로 오판된다).

### I03. 단위 테스트
- Related Files:
  - `tests/sensor-support-probe.test.ts` :: new

#### Details
- `hasUsableRotationRate`: `null`/`undefined`/`{alpha:null,beta:null,gamma:null}` → false; `{alpha:0,beta:0,gamma:0}` → true(0은 정상 값); `{alpha:NaN,beta:null,gamma:null}` → false.
- `decideSensorSupport`: `(0,0)` → `NO_EVENTS`; `(5,0)` → `NO_GYRO`; `(5,1)` → supported; `(0,1)`도 supported(순서 규칙).
- `probeSensorSupport`(가짜 `target`: `addEventListener`로 핸들러를 모아 두고 테스트가 직접 호출, `vi.useFakeTimers()` 사용): (1) 자이로 값이 담긴 이벤트를 보내면 타이머를 진행시키지 않아도 즉시 supported, 리스너가 제거된다 (2) `rotationRate: null` 이벤트만 3번 보내고 `durationMs` 경과 → `{supported:false, reason:'NO_GYRO'}` (3) 이벤트 없이 경과 → `NO_EVENTS` (4) `addEventListener`가 throw → `NO_EVENTS`로 resolve, reject 없음 (5) 즉시 resolve 뒤 타이머가 지나가도 결과가 바뀌지 않는다.

## Acceptance Criteria
- [ ] `decideSensorSupport`와 `probeSensorSupport`가 위 규칙대로 동작한다.
- [ ] 자이로 값 `0`을 가진 이벤트는 supported로 판정된다.
- [ ] 모듈이 `import.meta.env`와 `window` 전역을 모듈 로드 시점에 읽지 않는다(`target` 기본값은 호출 시점에 계산).

## Validation
- `npx vitest run tests/sensor-support-probe.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(controller): 센서 실측으로 자이로 없는 기기를 판별하는 모듈

Plan: 2026-11-08-unsupported-phone-block
Phase: P02-unsupported-phone-block
Task: T01-sensor-probe-core

- I01: SENSOR_PROBE_MS 상수와 UnsupportedReason 타입 추가
- I02: decideSensorSupport·probeSensorSupport 구현
- I03: 판정 규칙·실측 함수 단위 테스트
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
