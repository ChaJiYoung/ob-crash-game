# Task: T02 미지원 기기 메시지와 서버 핸들러

## Status: done

## Goal
폰이 `DEVICE_UNSUPPORTED`를 보내면 서버가 그 폰의 소켓을 닫아 슬롯을 비우고, PC에 `CONTROLLER_UNSUPPORTED`를 보낸다. 같은 QR로 다른 폰이 그 슬롯에 들어올 수 있어야 한다.

## Decision Summary
- D03: 폰이 서버에 알리고, 서버가 슬롯을 비우며 PC에 안내하게 한다. `deviceId`를 서버에 기억하지 않는다.
- 설계: 서버는 `CONTROLLER_UNSUPPORTED`를 먼저 보낸 뒤 `ws.close()`만 한다. 소켓이 닫히면 기존 `close` 핸들러(`server/wsServer.ts` 약 650행)가 `roomManager.removeSocket`으로 좌석을 비우고 PC에 `CONTROLLER_DISCONNECTED`를 보낸다. 판 도중의 끊김 처리(유예·일시정지)는 이 기존 경로를 재사용한다.
- 보안: 메시지의 `slot`을 믿지 않는다. 소켓이 실제로 붙어 있는 좌석(`roomManager.getControllerSlot(session, ws)`)만 쓴다. 안 붙은 소켓이 보낸 메시지는 아무도 쫓아내지 못한다.

## Implementation

### I01. 프로토콜 타입
- Related Files:
  - `src/shared/types.ts` :: `ClientToServerMessage`, `ServerToClientMessage` — 각각 한 줄 추가; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // ClientToServerMessage (CONTROLLER_FOREGROUND 아래)
  /** 권한을 허용했지만 센서 실측에서 자이로가 확인되지 않았다. 서버가 이 폰을 슬롯에서 내보낸다. */
  | { type: 'DEVICE_UNSUPPORTED'; roomId: string; deviceId: string; reason: UnsupportedReason; slot?: PlayerSlot }

  // ServerToClientMessage (CONTROLLER_PAIRED 아래)
  /** 슬롯의 폰이 미지원 기기라서 내보냈다. 곧 CONTROLLER_DISCONNECTED가 이어진다. */
  | { type: 'CONTROLLER_UNSUPPORTED'; roomId: string; slot: PlayerSlot; reason: UnsupportedReason }
  ```
  (`UnsupportedReason`은 P02-T01에서 `types.ts`에 이미 추가됨.)

### I02. 서버 핸들러
- Related Files:
  - `server/wsServer.ts` :: `createBeerCrusherServer` 내부 `switch (msg.type)` — `case 'DEVICE_UNSUPPORTED'` 추가; modify
  - `server/RoomManager.ts` :: `getControllerSlot(session, socket)` — read-only(이미 public)

#### Details
- **Execution Flow / Logic**:
  1. Precondition: `roomId`/`deviceId`가 없으면 `ERROR INVALID_REQUEST`(다른 케이스와 같은 형식)를 보내고 return.
  2. `session = roomManager.getRoom(roomId)`; 없으면 `ws.close()` 후 break(이미 방이 없는 폰이므로 더 알릴 것이 없다).
  3. `slot = roomManager.getControllerSlot(session, ws)`; `undefined`면(이 소켓이 어느 좌석에도 안 붙어 있음) PC에 아무것도 보내지 말고 `ws.close()` 후 break.
  4. `sendJson(session.pcSocket, { type: 'CONTROLLER_UNSUPPORTED', roomId, slot, reason: msg.reason })`. `sendJson`은 `undefined` 소켓을 받아도 안전하다(다른 케이스가 `session.pcSocket`을 그대로 넘긴다).
  5. `console.warn`으로 `deviceId`, `slot`, `reason`을 한 줄 로그. `ws.close()`로 마무리. `watch`/`clearBackground`는 직접 부르지 않는다: 소켓 `close` 핸들러가 `watch.forget`과 `clearBackground`를 이미 수행한다.
  6. 함정: 여기서 `roomManager.removeSocket(ws)`를 직접 부르면 `close` 핸들러의 `removeSocket`이 빈 결과를 돌려줘 PC가 `CONTROLLER_DISCONNECTED`를 못 받는다. 직접 부르지 말고 `ws.close()`만 한다.
  7. 함정: `reason`이 `'NO_EVENTS' | 'NO_GYRO'` 이외의 값이어도 서버는 그대로 중계하지 않고 `'NO_GYRO'`로 보정한다(클라이언트 입력을 신뢰하지 않음).

### I03. 서버 테스트
- Related Files:
  - `tests/server-unsupported-device.test.ts` :: new — `tests/helpers/wsHarness.ts`의 `startHarness`, `Inbox`, `open`, `sleep` 사용

#### Details
- 시나리오 1: `h.phone('phone-A', 1)`이 `DEVICE_UNSUPPORTED`(`reason: 'NO_GYRO'`)를 보낸다 → `h.pc`가 `CONTROLLER_UNSUPPORTED`(`slot: 1`, `reason: 'NO_GYRO'`)를 받고, 이어서 `CONTROLLER_DISCONNECTED`(slot 1)를 정확히 1번 받는다.
- 시나리오 2: 위 직후 다른 폰 `phone-B`가 같은 슬롯 1로 `DEVICE_CHECK`를 보내면 `SLOT_OCCUPIED` 에러가 아니라 `AUTH_RESULT`를 받는다(슬롯이 비워졌다).
- 시나리오 3: 방에 붙어 있지 않은 소켓(`open(h.url)`로 새로 열고 `DEVICE_CHECK`는 안 보냄)이 `DEVICE_UNSUPPORTED`를 보내도 `h.pc`는 `CONTROLLER_UNSUPPORTED`를 받지 않고, 기존 `phone-A`의 연결은 유지된다.
- 시나리오 4: 정의되지 않은 `reason: 'WHATEVER'`를 보내면 PC가 받은 메시지의 `reason`은 `'NO_GYRO'`다.
- 실행 전 `tests/helpers/wsHarness.ts`의 `Harness`가 `url`/`roomId`/`pc`/`phone()`/`cleanup()`을 어떻게 노출하는지 읽고 맞춘다.

## Acceptance Criteria
- [ ] 좌석에 붙은 폰이 `DEVICE_UNSUPPORTED`를 보내면 PC가 `CONTROLLER_UNSUPPORTED`와 `CONTROLLER_DISCONNECTED`를 이 순서로 받는다.
- [ ] 비워진 슬롯에 다른 폰이 들어올 수 있다.
- [ ] 좌석에 안 붙은 소켓은 다른 폰을 쫓아낼 수 없다.

## Validation
- `npx vitest run tests/server-unsupported-device.test.ts` — 통과
- `npx vitest run tests/server-controller-background.test.ts tests/server-controller-watch.test.ts tests/server-session.test.ts tests/server-coop-slots.test.ts` — 기존 서버 테스트 회귀 없음
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(server): 미지원 폰 통지를 받아 슬롯을 비우고 PC에 알림

Plan: 2026-11-08-unsupported-phone-block
Phase: P02-unsupported-phone-block
Task: T02-server-unsupported-message

- I01: DEVICE_UNSUPPORTED / CONTROLLER_UNSUPPORTED 메시지 타입 추가
- I02: 서버 핸들러(소켓이 붙은 좌석만 인정, PC 통지 후 소켓 닫기)
- I03: 슬롯 비움·오용 방지 서버 테스트
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
