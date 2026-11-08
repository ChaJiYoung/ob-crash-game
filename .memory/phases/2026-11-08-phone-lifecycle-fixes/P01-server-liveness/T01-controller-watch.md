# Task: T01 컨트롤러 센서 프레임 끊김 감지와 복귀 알림

## Status: done

## Goal
게임 중 폰이 소리 없이 사라져도(소켓이 닫히지 않아도) 센서 프레임이 3초 끊기면 서버가 PC에 `CONTROLLER_DISCONNECTED`를 한 번 보내고, 프레임이 다시 오면 복귀 알림(`CONTROLLER_PAIRED` + `ZERO_CALIBRATED` `resume: true`)을 보낸다.

## Decision Summary
- 폰 사라짐 감지 안전망(phone-background-pause D02, D06). 일시정지·유예 로직은 PC의 기존 `CONTROLLER_DISCONNECTED` 처리를 그대로 쓴다.
- 판정은 시간을 인자로 받는 순수 클래스(`ControllerWatch`)로 분리해 단위 테스트한다. 서버는 타이머와 메시지 전송만 담당한다.
- 시간 값(3초, 확인 주기 1초)은 `createBeerCrusherServer` 옵션으로 덮어쓸 수 있게 해서 통합 테스트가 오래 기다리지 않는다.

## Implementation

### I01. 공유 상수와 순수 클래스 `ControllerWatch`

- Related Files:
  - `src/shared/controllerLifecycle.ts` :: `CONTROLLER_LIFECYCLE` — 서버·폰이 같이 쓰는 시간 상수; new
  - `server/ControllerWatch.ts` :: `ControllerWatch`, `watchKey` — 프레임 끊김 판정; new

#### Details
- **Signatures & Types**:
  ```typescript
  // src/shared/controllerLifecycle.ts
  export const CONTROLLER_LIFECYCLE = {
    /** 센서 프레임이 이 시간(ms) 넘게 없으면 컨트롤러가 사라진 것으로 본다. */
    FRAME_TIMEOUT_MS: 3000,
    /** 서버가 프레임 끊김을 확인하는 주기(ms). */
    WATCH_INTERVAL_MS: 1000,
  } as const;
  // P01-T02에서 BACKGROUND_NOTIFY_DELAY_MS, P02에서 FOREGROUND_RESUME_MIN_MS, AUTO_ZERO_FALLBACK_MS를 이 객체에 추가한다.

  // server/ControllerWatch.ts
  import type { PlayerSlot } from '../src/shared/types';
  export const watchKey = (roomId: string, slot: PlayerSlot): string => `${roomId}:${slot}`;
  export function parseWatchKey(key: string): { roomId: string; slot: PlayerSlot };

  export class ControllerWatch {
    /** 프레임을 받았을 때. 사라진 것으로 표시돼 있었다면 'recovered'. */
    onFrame(key: string, nowMs: number): 'ok' | 'recovered';
    /** 사라진 것으로 표시한다(백그라운드 신호용). 새로 표시했으면 true, 이미 표시돼 있었으면 false. */
    markLost(key: string): boolean;
    /** timeoutMs를 넘겨 새로 사라진 키들(한 번만 반환). */
    check(nowMs: number, timeoutMs?: number): string[];
    /** 소켓이 닫히거나 자리가 지워진 컨트롤러를 더 이상 추적하지 않는다. */
    forget(key: string): void;
  }
  ```
- **Data & Schema Fields**: `private entries: Map<string, { lastMs: number; lost: boolean }>`
- **Execution Flow / Logic**:
  1. `onFrame`: 항목이 없으면 `{lastMs: nowMs, lost: false}`로 만들고 `'ok'`. 항목이 `lost`이면 `lost=false; lastMs=nowMs`로 바꾸고 `'recovered'`. 그 외 `lastMs=nowMs`, `'ok'`.
  2. `markLost`: 항목이 없으면 `{lastMs: 0, lost: true}`를 만들고 `true`. 이미 `lost`면 `false`. 아니면 `lost=true`, `true`. (`lastMs`는 건드리지 않는다.)
  3. `check`: 항목 중 `!lost && nowMs - lastMs > timeoutMs`(기본 `CONTROLLER_LIFECYCLE.FRAME_TIMEOUT_MS`)인 것을 `lost=true`로 바꾸고 키를 반환한다. 이미 `lost`인 항목은 다시 반환하지 않는다. 경계값(같을 때)은 사라진 것이 아니다.
  4. `forget`: 항목 삭제.
  5. `parseWatchKey`: `roomId`에 `:`가 없다는 전제(방 ID는 `[A-Z0-9]{3,8}`, `RoomManager`)로 마지막 `:` 기준으로 나눈다. 슬롯은 `Number(...) === 2 ? 2 : 1`.

### I02. 서버 연결: 프레임 기록, 주기 확인, 복귀 알림

- Related Files:
  - `server/wsServer.ts` :: `createBeerCrusherServer`의 `options`, `SENSOR_FRAME` 케이스, `ws.on('close')`, `close()` — 감시 연결; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export async function createBeerCrusherServer(options?: {
    port?: number;
    storePath?: string;
    recordPath?: string;
    /** 테스트용: 프레임 끊김 판정 시간(ms). 기본 CONTROLLER_LIFECYCLE.FRAME_TIMEOUT_MS */
    controllerFrameTimeoutMs?: number;
    /** 테스트용: 확인 주기(ms). 기본 CONTROLLER_LIFECYCLE.WATCH_INTERVAL_MS */
    watchIntervalMs?: number;
  }): Promise<BeerCrusherServerInstance>;
  ```
- **Execution Flow / Logic**:
  1. `const watch = new ControllerWatch();` (`roomManager` 선언 근처).
  2. `SENSOR_FRAME` 케이스: 기존 `TEMP(sensor-debug)` 블록은 그대로 두고, `const session = roomManager.getRoom(msg.roomId);` 다음에 추가한다.
     ```typescript
     if (session) {
       const frameSlot = roomManager.getControllerSlot(session, ws);
       if (frameSlot !== undefined) {
         const result = watch.onFrame(watchKey(session.roomId, frameSlot), Date.now());
         if (result === 'recovered') notifyControllerBack(session, frameSlot);
       }
     }
     ```
     기존 `SENSOR_RELAY` 전송 로직은 그대로 둔다(순서: 감시 갱신 → 복귀 알림 → 릴레이).
  3. `notifyControllerBack(session, slot)`(`createBeerCrusherServer` 안의 헬퍼): PC 소켓이 없으면 반환. `seat = session.controllers[slot]`. `player = playerStore.findByDeviceId(seat.deviceId)`가 있으면 `sendJson(pc, {type:'CONTROLLER_PAIRED', roomId: session.roomId, player, slot})`. 이어서 `sendJson(pc, {type:'ZERO_CALIBRATED', roomId: session.roomId, deviceId: seat.deviceId, slot, resume: true})`.
  4. 주기 확인: `const watchTimer = setInterval(() => {...}, options?.watchIntervalMs ?? CONTROLLER_LIFECYCLE.WATCH_INTERVAL_MS); watchTimer.unref?.();` 콜백에서 `watch.check(Date.now(), options?.controllerFrameTimeoutMs)`의 각 키를 `parseWatchKey`로 풀어 `session = roomManager.getRoom(roomId)`를 구한다. `session?.controllers[slot]?.socket?.readyState !== WebSocket.OPEN`이면 이미 지워진 자리이므로 `watch.forget(key)`만 하고 넘어간다. 아니면 `session.pcSocket`이 있을 때 `sendJson(session.pcSocket, {type:'ERROR', code:'CONTROLLER_DISCONNECTED', message:'Controller stopped sending sensor frames', slot})`.
  5. `ws.on('close')`: `removeSocket`이 `role === 'CONTROLLER'`이고 `roomId`와 `slot`이 있으면 `watch.forget(watchKey(roomId, slot))`. (기존 `CONTROLLER_DISCONNECTED` 전송은 그대로.)
  6. 반환 객체의 `close()`에서 `clearInterval(watchTimer)`를 먼저 호출한다.
  7. 에러 처리: 타이머 콜백 전체를 `try/catch`로 감싸 예외가 서버를 죽이지 않게 한다.
- **리뷰 반영(opus 코드 리뷰, 청사진 변경)**:
  - `markLost(key)`는 프레임을 한 번이라도 받은(추적 중인) 키만 표시하고, 추적 중이 아니면 `false`를 돌려준다(센서가 시작되지 않은 폰이 나중에 첫 프레임으로 '복귀' 처리되어 영점 신호보다 먼저 `ZERO_CALIBRATED`가 가는 것을 막는다). `isLost(key): boolean`을 추가했다.
  - `DEVICE_CHECK`가 성공하면 해당 슬롯의 `watch`를 `forget`한다. 복귀 경로는 폰의 `CALIBRATE_ZERO(resume)` 하나로 두고, 다음 프레임이 복귀 알림을 중복으로 보내지 않게 한다.
  - `ws.on('close')`는 그 슬롯이 이미 `lost`로 PC에 알려진 상태면 `CONTROLLER_DISCONNECTED`를 다시 보내지 않는다(PC가 두 번째 이탈 뒤의 중복 알림을 새 유예로 받아 1P 없이 재개하던 문제).
- **주의(회귀 방지)**:
  - `watch.onFrame`은 `getControllerSlot(session, ws)`(소켓 기준)을 쓴다. 메시지의 `msg.slot`을 믿지 않는다(다른 슬롯 흉내 방지).
  - `DEVICE_CHECK`로 슬롯이 이동(`movedFromSlot`)하면 지워진 슬롯의 추적이 남을 수 있다. 4번의 소켓 상태 확인이 이를 걸러낸다.
  - 로비 등 게임 단계는 서버가 모른다. 단계별 처리는 PC의 기존 `CONTROLLER_DISCONNECTED` 핸들러가 이미 한다(D07).

### I03. 테스트

- Related Files:
  - `tests/controller-watch.test.ts` :: `describe('ControllerWatch')` — 순수 클래스 테스트; new
  - `tests/server-controller-watch.test.ts` :: `describe('server frame-loss detection')` — 서버 통합 테스트; new

#### Details
- **순수 테스트**: 프레임 후 3000ms 경과는 `check` 결과 비어 있음, 3001ms는 키 반환(한 번만, 두 번째 호출은 비어 있음). 사라진 뒤 `onFrame`은 `'recovered'`, 그다음 `onFrame`은 `'ok'`. `markLost`는 새로 표시하면 true, 이미 표시돼 있으면 false이고, `markLost` 뒤 `check`는 그 키를 반환하지 않으며 `onFrame`은 `'recovered'`. `forget` 뒤에는 `check`가 반환하지 않는다. `parseWatchKey(watchKey('ABCD', 2))`가 `{roomId:'ABCD', slot:2}`.
- **통합 테스트**(`tests/server-coop-slots.test.ts`의 `waitForMessage`/임시 `storePath` 패턴 복사): `createBeerCrusherServer({ port: 0, storePath, controllerFrameTimeoutMs: 300, watchIntervalMs: 50 })`. PC가 `CREATE_ROOM`, 폰이 미리 `playerStore.registerOrUpdateNickname('phone-A','A')` 후 `DEVICE_CHECK`(slot 1)로 붙는다.
  1. 폰이 `SENSOR_FRAME`을 보낸 뒤 멈추면 PC가 약 300~600ms 안에 `ERROR`(`code: 'CONTROLLER_DISCONNECTED'`, `slot: 1`)를 받는다.
  2. 이후 500ms 동안 같은 알림이 다시 오지 않는다(PC 쪽 수신 메시지를 모아 개수 확인).
  3. 폰이 `SENSOR_FRAME`을 다시 보내면 PC가 `CONTROLLER_PAIRED`(slot 1)와 `ZERO_CALIBRATED`(`resume: true`, slot 1)를 받는다.
  4. 폰 소켓을 닫으면 기존 `close` 경로의 `CONTROLLER_DISCONNECTED`가 오고, 이후 500ms 동안 프레임 끊김 알림이 중복으로 오지 않는다(`forget` 확인).
- 사용하는 페이로드는 `tests/input-adapters.test.ts`의 `makePayload` 필드 구성(`aimX, aimY, yawDeg, pitchDeg, rollDeg, snapFire, rapidFireHold, feverTriggered, isCocked, timestamp`)을 쓴다.

## Acceptance Criteria
- [ ] 프레임이 `FRAME_TIMEOUT_MS`(기본 3초) 넘게 끊기면 PC가 `CONTROLLER_DISCONNECTED`를 정확히 한 번 받는다.
- [ ] 프레임이 다시 오면 PC가 `CONTROLLER_PAIRED`와 `ZERO_CALIBRATED`(`resume: true`)를 받는다.
- [ ] 소켓이 닫힌 컨트롤러는 프레임 끊김 알림을 추가로 보내지 않는다.
- [ ] 서버 `close()` 뒤에 타이머가 남지 않는다(테스트가 정상 종료).
- [ ] 기존 서버 테스트가 모두 통과한다.

## Validation
- `npx vitest run tests/controller-watch.test.ts tests/server-controller-watch.test.ts` — 전체 통과
- `npx vitest run tests/server-coop-slots.test.ts tests/coop-slots.test.ts tests/controller-slot.test.ts` — 기존 서버·슬롯 테스트 통과
- `npx tsc --noEmit` — 타입 오류 없음
- `npx vitest run` — 전체 통과

## Commit Message
```text
feat(server): 컨트롤러 센서 프레임 끊김 감지와 복귀 알림

Plan: 2026-11-08-phone-lifecycle-fixes
Phase: P01-server-liveness
Task: T01-controller-watch

- ControllerWatch(순수 클래스)와 공유 상수 CONTROLLER_LIFECYCLE 추가
- 서버가 프레임 3초 끊김 시 CONTROLLER_DISCONNECTED를 한 번 보내고, 재개 시 PAIRED + ZERO_CALIBRATED(resume)로 복귀 알림
- 소켓 종료 시 추적 제거, 서버 close 시 타이머 정리
- 순수 단위 테스트와 서버 통합 테스트 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: f894283
