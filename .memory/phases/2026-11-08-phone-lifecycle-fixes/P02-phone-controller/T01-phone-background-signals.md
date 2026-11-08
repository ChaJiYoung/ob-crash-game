# Task: T01 폰 화면 꺼짐/복귀 신호와 복귀 재연결 절차

## Status: done

## Goal
폰 화면이 꺼지면 즉시 `CONTROLLER_BACKGROUND`를, 켜지면 즉시 `CONTROLLER_FOREGROUND`를 서버에 보낸다. 0.5초 이상 꺼져 있다 돌아오면 소켓이 열려 있어도 재연결할 때와 같은 절차(`DEVICE_CHECK` → `AUTH_RESULT` → `CALIBRATE_ZERO` `resume: true`)를 실행해 PC가 다시 연결 상태로 돌아온다.

## Decision Summary
- phone-background-pause D05, D11. 폰은 타이머를 쓰지 않고 이벤트 시점에 바로 보낸다(화면이 꺼지면 폰 타이머가 얼 수 있다).
- 시간 측정은 `Date.now()`(기기가 잠들면 멈출 수 있는 `performance.now()`를 쓰지 않는다).
- 영점은 건드리지 않는다(`resume: true`).

## Implementation

### I01. 상수와 화면 상태 핸들러

- Related Files:
  - `src/shared/controllerLifecycle.ts` :: `CONTROLLER_LIFECYCLE` — `FOREGROUND_RESUME_MIN_MS` 추가; modify
  - `src/controller/MobileControllerPage.tsx` :: `MobileControllerPage`의 WebSocket effect(`useEffect(..., [roomId, deviceId])`, 약 100~280행의 `connect()` / `reviveIfDead` 근처) — 핸들러 추가; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // CONTROLLER_LIFECYCLE에 추가
  /** 화면이 이만큼(ms) 이상 꺼져 있다 돌아오면 복귀 절차(DEVICE_CHECK 재전송)를 실행한다. 서버 알림 지연(1000ms)보다 짧아야 한다. */
  FOREGROUND_RESUME_MIN_MS: 500,

  import { CONTROLLER_LIFECYCLE } from '../shared/controllerLifecycle';
  ```
- **Execution Flow / Logic** (WebSocket effect 안, `connect();` 호출 아래 `reviveIfDead` 선언 근처에 추가):
  1. `let hiddenAtMs: number | null = null;`
  2. 핸들러:
     ```typescript
     const onBackgroundSignals = () => {
       const cur = wsRef.current;
       const open = !!cur && cur.readyState === WebSocket.OPEN;
       if (document.visibilityState === 'hidden') {
         hiddenAtMs = Date.now();
         if (open) cur!.send(JSON.stringify({ type: 'CONTROLLER_BACKGROUND', roomId, deviceId, slot: slotRef.current }));
         return;
       }
       const hiddenForMs = hiddenAtMs === null ? 0 : Date.now() - hiddenAtMs;
       hiddenAtMs = null;
       if (!open) return; // 소켓이 닫혔으면 기존 reviveIfDead 재연결 경로가 처리한다
       cur!.send(JSON.stringify({ type: 'CONTROLLER_FOREGROUND', roomId, deviceId, slot: slotRef.current }));
       if (hiddenForMs >= CONTROLLER_LIFECYCLE.FOREGROUND_RESUME_MIN_MS && stepRef.current === 'PAD') {
         isReconnectOpenRef.current = true; // AUTH_RESULT 처리부가 CALIBRATE_ZERO(resume: true)를 보내게 한다
         cur!.send(JSON.stringify({ type: 'DEVICE_CHECK', roomId, deviceId, slot: slotRef.current }));
       }
     };
     ```
  3. `document.addEventListener('visibilitychange', onBackgroundSignals)`를 기존 `reviveIfDead` 리스너 옆에 등록하고, effect cleanup에서 `removeEventListener`한다.
  4. 기존 `reviveIfDead`(소켓이 닫혔을 때만 재연결)와 `onBackgroundSignals`(소켓이 열려 있을 때)가 서로를 보완한다. 둘은 서로의 조건이 배타적이므로 합치지 않는다.
- **주의(회귀 방지)**:
  - `AUTH_RESULT` 처리부는 `isReconnectOpenRef.current && stepRef.current === 'PAD'`일 때만 `CALIBRATE_ZERO` `resume: true`를 보내고, 그 뒤 `isReconnectOpenRef.current = false`로 되돌린다(기존 코드). `isReconnectOpenRef`를 `true`로 만들고 `DEVICE_CHECK`를 보내지 않으면 다음 정상 `AUTH_RESULT`가 의도치 않게 영점 재개를 보낼 수 있으니 항상 한 쌍으로 쓴다.
  - 센서 복구 effect(`sensorEpoch`, 기존 코드)와 이 핸들러는 같은 `visibilitychange` 이벤트에 각자 반응하며 서로 독립이다. 합치지 않는다.
  - `hidden` 상태에서 소켓이 이미 죽어 있으면 `send`가 사라질 수 있다. 그 경우는 서버의 프레임 끊김 감지(P01-T01)가 안전망이다.

### I02. 소스 가드 테스트

- Related Files:
  - `tests/controller-reconnect.test.ts` :: `describe('MobileControllerPage reconnect wiring (source guard)')` — 케이스 추가; modify

#### Details
- 소스에 `CONTROLLER_BACKGROUND`, `CONTROLLER_FOREGROUND`, `FOREGROUND_RESUME_MIN_MS`, `hiddenAtMs`가 있다.
- `onBackgroundSignals` 블록 안에 `setTimeout`이 없다(타이머를 쓰지 않는 결정 D11 가드). 블록은 `const onBackgroundSignals`부터 `visibilitychange'` 등록 직전까지 슬라이스한다.
- 같은 블록에서 `Date.now()`를 쓰고 `performance.now()`는 쓰지 않는다.
- 같은 블록에 `calibrateZero`·`CALIBRATE_ZERO`가 없다(영점 유지 결정 가드; 영점 재개는 `AUTH_RESULT` 경로가 한다).
- 같은 블록에 `isReconnectOpenRef.current = true`와 `DEVICE_CHECK`가 함께 있다.

## Acceptance Criteria
- [ ] 화면이 꺼지면 즉시 `CONTROLLER_BACKGROUND`가, 켜지면 즉시 `CONTROLLER_FOREGROUND`가 전송된다.
- [ ] 0.5초 이상 꺼졌다 켜지면 `isReconnectOpenRef`가 `true`가 되고 `DEVICE_CHECK`가 재전송된다.
- [ ] 폰 쪽에 타이머가 없고 시간 측정에 `Date.now()`를 쓴다.
- [ ] 영점이 바뀌지 않는다.
- [ ] 기존 컨트롤러 테스트가 모두 통과한다.

## Validation
- `npx vitest run tests/controller-reconnect.test.ts tests/controller-sensors.test.ts tests/controller-ui-and-routing.test.ts` — 전체 통과
- `npx tsc --noEmit` — 타입 오류 없음
- `npx vitest run` — 전체 통과

## Commit Message
```text
feat(controller): 화면 꺼짐/복귀 신호와 복귀 재연결 절차

Plan: 2026-11-08-phone-lifecycle-fixes
Phase: P02-phone-controller
Task: T01-phone-background-signals

- hidden/visible 때 CONTROLLER_BACKGROUND/FOREGROUND 즉시 전송 (폰 타이머 없음)
- 0.5초 이상 꺼졌다 돌아오면 소켓이 열려 있어도 DEVICE_CHECK를 재전송해 PC를 복귀시킴 (영점 유지)
- 소스 가드 테스트 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
