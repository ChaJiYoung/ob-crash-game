# Task: T03 폰 컨트롤러 센서 리스너 재등록과 워치독

## Status: pending

## Goal
폰 화면이 다시 보이거나, 화면이 보이는데 센서 이벤트가 `SENSOR_STALE_MS` 넘게 끊기면 `deviceorientation`/`devicemotion` 리스너를 해제 후 재등록한다. 영점은 건드리지 않는다.

## Decision Summary
- D01~D04, D06 ③. 재등록은 기존 센서 `useEffect`를 "epoch 카운터"로 다시 돌리는 방식이다. 새 리스너 코드를 따로 만들지 않는다.
- 영점 유지: `tracker.calibrateZero`·`CALIBRATE_ZERO` 전송은 하지 않는다.
- WebSocket 재연결 effect(`reviveIfDead`)는 건드리지 않는다.

## Implementation

### I01. epoch와 liveness 연결, 센서 effect 보강

- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: `MobileControllerPage`의 센서 리스너 effect(약 326~384행, `window.addEventListener('deviceorientation', ...)`가 있는 effect) — 재등록 가능하게 수정; modify
  - `src/controller/sensors/SensorLiveness.ts` :: `SensorLiveness`, `SENSOR_STALE_MS` — T02 산출물; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  import { SensorLiveness, SENSOR_STALE_MS } from './sensors/SensorLiveness';

  const [sensorEpoch, setSensorEpoch] = useState<number>(0);
  const sensorLivenessRef = useRef<SensorLiveness>(new SensorLiveness());
  ```
- **Execution Flow / Logic**:
  1. 센서 리스너 effect의 deps를 `[sensorsActive, sensorEpoch, tracker, flushSensorFrame]`로 바꾼다.
  2. effect 시작 시(`if (!sensorsActive) return;` 다음) `sensorLivenessRef.current.reset(performance.now())`를 호출해 유예 시간을 새로 시작한다.
  3. `onOrientation` 첫 줄에서 `sensorLivenessRef.current.markEvent(performance.now())`를 호출한다. `latestOrientationRef` 갱신 로직은 그대로.
  4. cleanup에서 기존 `clearTimeout(snapFreezeTimerRef.current)` 뒤에 `snapFreezeTimerRef.current = null;`과 `tracker.unlockAim();`을 추가한다. 이유: 화면이 꺼진 동안 `snapFreezeTimerRef`(350ms)가 멈춘 채 cleanup으로 취소되면 `lockAim`이 영원히 남아 조준이 고정된다(D04).
  5. 기존 `removeEventListener` 두 줄은 유지한다.
- **주의(회귀 방지)**: `flushSensorFrame`의 identity가 바뀔 때도 이 cleanup이 돈다(deps 때문). 그때 `unlockAim`을 호출해도 350ms 동결이 일찍 풀릴 뿐 문제는 없다. 반대로 `unlockAim`을 `calibrateZero`와 혼동해 영점을 지우면 안 된다.

### I02. 화면 복귀·워치독 effect 추가

- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: I01 effect 바로 아래에 새 `useEffect` 추가; modify

#### Details
- **Execution Flow / Logic**:
  1. `useEffect(() => { if (!sensorsActive) return; ... }, [sensorsActive])`.
  2. `const bump = () => setSensorEpoch((e) => e + 1);`
  3. `const onVisibility = () => { if (document.visibilityState === 'visible') bump(); };` → `document.addEventListener('visibilitychange', onVisibility)`.
  4. 워치독: `const timer = setInterval(() => { if (document.visibilityState !== 'visible') return; if (sensorLivenessRef.current.isStale(performance.now())) bump(); }, 500);`
  5. 무한 재등록 방지: `bump()`로 I01 effect가 다시 돌면 `reset`이 호출되어 다음 `SENSOR_STALE_MS` 동안은 stale 판정이 나지 않는다. 즉 센서가 아예 안 오는 기기에서도 최대 `SENSOR_STALE_MS`마다 한 번만 재등록한다.
  6. cleanup: `removeEventListener('visibilitychange', onVisibility)`, `clearInterval(timer)`.
  7. `step === 'LOGIN_GATE'`일 때는 `sensorsActive`가 false라서 자동으로 동작하지 않는다(권한 허용 전 재등록 방지).

### I03. 소스 가드 테스트

- Related Files:
  - `tests/controller-reconnect.test.ts` :: `describe('MobileControllerPage reconnect wiring (source guard)')` 안에 케이스 추가 — 테스트; modify

#### Details
- 기존 `source` 변수를 재사용한다.
- 케이스 1: 소스에 `sensorEpoch`, `SensorLiveness`, `SENSOR_STALE_MS`가 있다.
- 케이스 2: 센서 리스너 effect의 deps에 `sensorEpoch`가 있고(`/\[sensorsActive,\s*sensorEpoch,/`), cleanup 영역에 `tracker.unlockAim()`이 있다. (정규식은 구현 형태에 맞춰 작성하되, "재등록 조건"과 "unlock 호출"을 검증해야 한다.)
- 케이스 3: 화면 복귀 처리에서 `calibrateZero`를 호출하지 않는다 — `onVisibility`가 정의된 블록에 `calibrateZero`가 없는지 확인(영점 유지 결정 D03 가드).

## Acceptance Criteria
- [ ] 센서 effect가 `sensorEpoch`로 재실행되고, cleanup에서 `unlockAim`이 호출된다.
- [ ] 화면이 보이게 되거나 센서가 `SENSOR_STALE_MS` 이상 멈추면 `setSensorEpoch`가 호출된다.
- [ ] 재등록 시 영점이 바뀌지 않는다 (`calibrateZero`·`CALIBRATE_ZERO` 전송 없음).
- [ ] 기존 컨트롤러 관련 테스트가 모두 통과한다.

## Validation
- `npx vitest run tests/controller-reconnect.test.ts tests/controller-sensors.test.ts tests/controller-ui-and-routing.test.ts` — 전체 통과
- `npx tsc --noEmit` — 타입 오류 없음
- `npx vitest run` — 전체 통과

## Commit Message
```text
fix(controller): 화면 복귀·센서 정지 시 센서 리스너 재등록

Plan: 2026-11-08-controller-sensor-revive-after-screen-off
Phase: P01-sensor-revive
Task: T03-controller-revive

- sensorEpoch로 센서 리스너 effect를 재실행 (화면 복귀, 워치독)
- 리스너 cleanup에서 조준 잠금과 스냅 동결 타이머 정리
- 영점은 유지 (calibrateZero 호출 없음)
- 소스 가드 테스트 추가
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
