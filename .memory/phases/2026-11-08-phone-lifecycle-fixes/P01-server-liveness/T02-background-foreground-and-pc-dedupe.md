# Task: T02 백그라운드/포그라운드 신호와 PC 중복 알림 방어

## Status: done

## Goal
폰이 `CONTROLLER_BACKGROUND`를 보내면 서버가 1초를 기다린 뒤(그 사이 `CONTROLLER_FOREGROUND`가 오지 않으면) PC에 `CONTROLLER_DISCONNECTED`를 보낸다. 같은 슬롯의 `CONTROLLER_DISCONNECTED`가 여러 번 와도 PC가 유예 카운트다운을 다시 시작하지 않는다.

## Decision Summary
- phone-background-pause D04, D08, D11. 1초 대기는 폰이 얼 수 있어서 서버 타이머로 처리한다.
- 소켓은 지우지 않는다(살아 있는 소켓이다). 알림만 보낸다.
- 알림은 `ControllerWatch.markLost`를 거쳐 한 번만 간다(프레임 끊김 감지와 겹쳐도 중복 없음).

## Implementation

### I01. 메시지 타입과 상수

- Related Files:
  - `src/shared/types.ts` :: `ClientToServerMessage` — 두 메시지 추가; modify
  - `src/shared/controllerLifecycle.ts` :: `CONTROLLER_LIFECYCLE` — `BACKGROUND_NOTIFY_DELAY_MS` 추가; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // ClientToServerMessage에 추가
  | { type: 'CONTROLLER_BACKGROUND'; roomId: string; deviceId: string; slot?: PlayerSlot }
  | { type: 'CONTROLLER_FOREGROUND'; roomId: string; deviceId: string; slot?: PlayerSlot }

  // CONTROLLER_LIFECYCLE에 추가
  /** 폰이 화면이 꺼졌다고 알린 뒤, 서버가 PC에 알리기 전에 기다리는 시간(ms). 이보다 짧은 꺼짐은 무시한다. */
  BACKGROUND_NOTIFY_DELAY_MS: 1000,
  ```
- 서버→클라이언트 메시지는 새로 만들지 않는다(PC는 기존 `ERROR` / `CONTROLLER_DISCONNECTED`를 받는다).

### I02. 서버 핸들러

- Related Files:
  - `server/wsServer.ts` :: `createBeerCrusherServer`의 `options`, 새 `case 'CONTROLLER_BACKGROUND'`, `case 'CONTROLLER_FOREGROUND'`, `ws.on('close')`, `close()` — 대기 타이머 처리; modify
  - `server/ControllerWatch.ts` :: `ControllerWatch.markLost` — T01 산출물; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  // options에 추가
  /** 테스트용: 백그라운드 알림 대기(ms). 기본 CONTROLLER_LIFECYCLE.BACKGROUND_NOTIFY_DELAY_MS */
  backgroundNotifyDelayMs?: number;

  const pendingBackground = new Map<string, ReturnType<typeof setTimeout>>(); // key = watchKey(roomId, slot)
  ```
- **Execution Flow / Logic**:
  1. 공통 검증(두 케이스 모두): `session = roomManager.getRoom(msg.roomId)`; `slot = session ? roomManager.getControllerSlot(session, ws) : undefined`; 둘 중 하나라도 없거나 `session.controllers[slot]?.deviceId !== msg.deviceId`이면 아무것도 하지 않고 `break`한다. 슬롯은 `msg.slot`이 아니라 소켓 기준이다(다른 슬롯 흉내 방지). 검증 실패에 에러 응답을 보내지 않는다(진단성 신호이므로 조용히 무시).
  2. `CONTROLLER_BACKGROUND`: `key = watchKey(session.roomId, slot)`. `pendingBackground.has(key)`면 `break`. 아니면 `setTimeout`을 걸어 `pendingBackground.set(key, timer)`. 지연은 `options?.backgroundNotifyDelayMs ?? CONTROLLER_LIFECYCLE.BACKGROUND_NOTIFY_DELAY_MS`.
  3. 타이머 콜백: `pendingBackground.delete(key)`. 현재 `s = roomManager.getRoom(roomId)`; `s?.pcSocket`이 없거나 `s.controllers[slot]?.socket !== ws`이면 반환. `watch.markLost(key)`가 `true`일 때만 `sendJson(s.pcSocket, {type:'ERROR', code:'CONTROLLER_DISCONNECTED', message:'Controller went to background', slot})`.
  4. `CONTROLLER_FOREGROUND`: `pendingBackground`의 `key` 타이머를 `clearTimeout` 후 삭제. 이미 알림이 나간 뒤라면 아무것도 되돌리지 않는다(복귀는 폰의 `DEVICE_CHECK` 재전송 또는 T01의 프레임 재개 알림이 처리).
  5. `ws.on('close')`: 닫힌 컨트롤러의 `pendingBackground` 타이머도 정리한다(`clearTimeout` + delete, 키는 T01의 `watchKey(roomId, slot)`).
  6. `close()`: 남은 `pendingBackground` 타이머를 모두 `clearTimeout`.
  7. 타이머 콜백은 `try/catch`로 감싼다.
- **구현 중 보강(청사진 추가)**: `backgrounded: Set<string>`을 두어, `CONTROLLER_BACKGROUND`를 받은 자리는 `CONTROLLER_FOREGROUND`(또는 같은 소켓의 `DEVICE_CHECK`)가 오기 전까지 프레임이 다시 와도 복귀로 처리하지 않는다(`watch.onFrame`이 `'recovered'`를 돌려주면 `watch.markLost`로 되돌리고 복귀 알림을 보내지 않는다). 백그라운드 탭이 느리게나마 프레임을 계속 보내는 기기에서, 알림 직후 다음 프레임이 PC를 곧바로 재개시키는 것을 막는다.
- **주의(회귀 방지)**: 소켓을 `removeSocket`하거나 `session.controllers`를 건드리지 않는다. 지우면 폰이 돌아와도 `SENSOR_FRAME`이 PC로 전달되지 않는다.

### I03. PC 중복 알림 방어

- Related Files:
  - `src/pc/coopDisconnect.ts` :: `decideDisconnectAction` — 판정 순수 함수; modify
  - `src/pc/PCGamePage.tsx` :: WebSocket `onmessage`의 `case 'ERROR'` → `CONTROLLER_DISCONNECTED` 분기(약 721~750행) — 중복 방어 적용; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export type DisconnectAction = 'start' | 'ignore' | 'second_loss';
  /**
   * 같은 슬롯의 CONTROLLER_DISCONNECTED가 거듭 와도 유예 기한을 다시 시작하지 않는다.
   * grace가 없으면 'start', 같은 슬롯이면 'ignore', 다른 슬롯이면(두 번째 사람도 끊김) 'second_loss'.
   */
  export function decideDisconnectAction(grace: GraceState | null, droppedSlot: PlayerSlot): DisconnectAction;
  ```
- **Execution Flow / Logic**:
  1. `PCGamePage.tsx`의 현재 안쪽 분기
     ```typescript
     if (graceRef.current !== null && graceRef.current.slot !== droppedSlot) { setGrace(null); setPauseMenu({open:true, reason:'CONTROLLER_LOST'}); }
     else { const newGrace = startGrace(...); setGrace(newGrace); ...; engine.setPaused(true, performance.now()); ... }
     ```
     을 `decideDisconnectAction(graceRef.current, droppedSlot)` 결과로 나눈다: `'second_loss'`는 기존 첫 분기 그대로, `'ignore'`는 아무것도 하지 않음, `'start'`는 기존 `else` 본문 그대로.
  2. `'start'` 본문에서 `setGrace(newGrace)` 직후 `graceRef.current = newGrace;`를 즉시 대입한다. 리액트 렌더 전에 같은 슬롯의 두 번째 알림이 오면 `graceRef.current`가 아직 `null`이라 중복으로 시작되는 것을 막는다(`graceRef.current = grace`는 렌더 때만 갱신된다).
  3. 바깥 `else`(유예 없는 솔로/`CONTROLLER_LOST`) 분기는 이미 `pauseMenuOpenRef.current`로 멱등이므로 변경하지 않는다.
  4. `setSlots(... isConnected: false)`와 `processorsRef.current.forEach((p) => p.stopAll())`도 멱등이라 그대로 둔다.
- **주의**: `engine.setPaused(true, ...)`를 중복 호출하면 일시정지 시각이 다시 갱신될 수 있다. 그래서 `'ignore'`일 때는 `setPaused`까지 모두 건너뛴다.

### I04. 테스트

- Related Files:
  - `tests/server-controller-background.test.ts` :: `describe('server background signal')` — 서버 통합; new
  - `tests/coop-disconnect.test.ts` :: `describe('decideDisconnectAction')` — 순수 함수와 소스 가드 추가; modify

#### Details
- **서버 통합**(T01 테스트와 같은 패턴, 옵션 `backgroundNotifyDelayMs: 200`, `controllerFrameTimeoutMs: 60_000`으로 프레임 끊김이 개입하지 않게):
  1. 폰이 `DEVICE_CHECK` 후 `CONTROLLER_BACKGROUND`를 보내고 아무것도 안 하면 약 200~500ms 뒤 PC가 `ERROR`(`CONTROLLER_DISCONNECTED`, `slot: 1`)를 받고, 이후 400ms 동안 중복이 없다.
  2. 폰이 `CONTROLLER_BACKGROUND` 직후(50ms 뒤) `CONTROLLER_FOREGROUND`를 보내면 500ms를 기다려도 PC에 알림이 오지 않는다.
  3. 알림이 간 뒤에도 폰 소켓은 살아 있고, 폰이 `SENSOR_FRAME`을 보내면 PC가 `SENSOR_RELAY`를 받는다.
  4. 소켓이 컨트롤러가 아닌 연결(`CREATE_ROOM`만 한 별도 소켓 또는 방에 붙지 않은 소켓)이 `CONTROLLER_BACKGROUND`를 보내도 PC는 아무것도 받지 않는다. `deviceId`가 다른 값이어도 마찬가지.
  5. 알림이 나간 뒤 같은 폰이 프레임을 보내면(T01) 복귀 알림(`CONTROLLER_PAIRED`, `ZERO_CALIBRATED` `resume: true`)이 온다.
- **PC 순수 함수**: `decideDisconnectAction(null, 1)`은 `'start'`, `(startGrace(1, 0, 0, 30000), 1)`은 `'ignore'`, `(그 grace, 2)`는 `'second_loss'`.
- **소스 가드**: `PCGamePage.tsx` 소스에 `decideDisconnectAction`이 있고, `setGrace(newGrace);` 다음에 `graceRef.current = newGrace`가 있다.

## Acceptance Criteria
- [ ] BACKGROUND 후 FOREGROUND가 없으면 지연 시간 뒤 PC가 `CONTROLLER_DISCONNECTED`를 한 번 받는다.
- [ ] 지연 안에 FOREGROUND가 오면 PC에 아무 알림도 가지 않는다.
- [ ] 알림 후에도 컨트롤러 소켓과 `SENSOR_RELAY`가 유지된다.
- [ ] 컨트롤러가 아닌 소켓·다른 `deviceId`의 신호는 무시된다.
- [ ] PC가 같은 슬롯의 중복 `CONTROLLER_DISCONNECTED`로 유예 기한을 다시 시작하지 않는다.
- [ ] 기존 서버·PC 테스트가 모두 통과한다.

## Validation
- `npx vitest run tests/server-controller-background.test.ts tests/coop-disconnect.test.ts tests/server-controller-watch.test.ts` — 전체 통과
- `npx tsc --noEmit` — 타입 오류 없음
- `npx vitest run` — 전체 통과

## Commit Message
```text
feat(server): 폰 백그라운드/포그라운드 신호로 PC 일시정지 연결

Plan: 2026-11-08-phone-lifecycle-fixes
Phase: P01-server-liveness
Task: T02-background-foreground-and-pc-dedupe

- CONTROLLER_BACKGROUND/FOREGROUND 메시지와 BACKGROUND_NOTIFY_DELAY_MS 추가
- 서버가 1초 대기 후 PC에 CONTROLLER_DISCONNECTED 전달 (소켓은 유지, 프레임 끊김 감지와 중복 없음)
- PC가 같은 슬롯의 중복 CONTROLLER_DISCONNECTED로 유예 카운트다운을 재시작하지 않도록 방어
- 서버 통합 테스트와 PC 판정 함수 테스트 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
