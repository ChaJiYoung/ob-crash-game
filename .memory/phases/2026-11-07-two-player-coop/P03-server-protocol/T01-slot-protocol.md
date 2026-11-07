# Task: T01 슬롯 프로토콜과 RoomManager 슬롯 2개

## Status: done

## Goal
한 방에 폰 컨트롤러를 슬롯 1·2로 각각 붙일 수 있게 하고, 폰이 보내는 메시지와 PC가 보내는 동기화 메시지를 슬롯별로 중계한다. 슬롯 없이 오는 옛 메시지(옛 QR, 옛 빌드)는 슬롯 1로 처리해 지금 1인 흐름이 그대로 동작한다.

## Decision Summary
- D01/D06: 폰 최대 2대, 슬롯마다 전용 QR. 슬롯 번호는 컨트롤러가 메시지에 실어 보낸다(QR URL `?slot=2`, P04-T02).
- 같은 기기가 다른 슬롯으로 다시 붙으면 이전 슬롯을 비우고 PC에 그 슬롯 끊김을 알린다(한 폰이 두 QR을 다 찍는 실수 처리).
- 다른 기기가 이미 열린 소켓으로 차지한 슬롯에 붙으려 하면 `ERROR SLOT_OCCUPIED`로 거절한다. 같은 기기의 재접속은 기존처럼 소켓 교체.

## Implementation

### I01. 메시지 타입

- Related Files:
  - `src/shared/types.ts` :: `ClientToServerMessage`, `ServerToClientMessage`; modify

#### Details
- **Signatures & Types** (추가 필드만. `PlayerSlot`은 P01-T06에서 정의됨):
  ```typescript
  // ClientToServerMessage
  | { type: 'DEVICE_CHECK'; roomId: string; deviceId: string; slot?: PlayerSlot }
  | { type: 'REGISTER_NICKNAME'; roomId: string; deviceId: string; nickname: string; slot?: PlayerSlot }
  | { type: 'CALIBRATE_ZERO'; roomId: string; deviceId: string; resume?: boolean; slot?: PlayerSlot }
  | { type: 'START_GAME_REQUEST'; roomId: string; deviceId: string; slot?: PlayerSlot }
  | { type: 'SENSOR_FRAME'; roomId: string; deviceId: string; payload: SensorFramePayload; slot?: PlayerSlot }
  | { type: 'FEVER_STATUS_SYNC'; roomId: string; isFeverReady: boolean; slot?: PlayerSlot }
  | { type: 'SKILL_STATE_SYNC'; roomId: string; /* 기존 필드 */ slot?: PlayerSlot }

  // ServerToClientMessage (PC가 받는 것에 slot 필수)
  | { type: 'CONTROLLER_PAIRED'; roomId: string; player: PlayerProfile; slot: PlayerSlot }
  | { type: 'ZERO_CALIBRATED'; roomId: string; deviceId: string; resume?: boolean; slot: PlayerSlot }
  | { type: 'GAME_START_RELAY'; roomId: string; deviceId: string; slot: PlayerSlot }
  | { type: 'SENSOR_RELAY'; roomId: string; deviceId: string; payload: SensorFramePayload; slot: PlayerSlot }
  | { type: 'ERROR'; code: string; message: string; slot?: PlayerSlot }
  ```
- 서버 헬퍼: `function normalizeSlot(v: unknown): PlayerSlot { return v === 2 ? 2 : 1; }` (`server/RoomManager.ts`에 export).

### I02. RoomManager

- Related Files:
  - `server/RoomManager.ts` :: `RoomSession`, `ControllerSeat`, `attachControllerSocket`, `getControllerSlot`, `removeSocket`; modify

#### Details
- **Data & Schema Fields**:
  ```typescript
  export interface ControllerSeat { socket?: WebSocket; deviceId: string; }
  export interface RoomSession {
    roomId: string;
    pcSocket?: WebSocket;
    /** 슬롯별 폰. 비어 있으면 그 슬롯에 폰이 없다. */
    controllers: Partial<Record<PlayerSlot, ControllerSeat>>;
    createdAt: number;
    /** 호환용: 슬롯 1의 소켓·기기 ID(기존 테스트 `room-persistence.test.ts:102`가 읽는다). */
    readonly controllerSocket?: WebSocket;
    readonly deviceId?: string;
  }
  ```
  `controllerSocket`/`deviceId`는 세션 객체를 만들 때 `Object.defineProperty`로 `controllers[1]`을 읽는 getter로 정의한다(또는 RoomSession을 class로 바꿔 getter 제공).
- **Signatures & Types**:
  ```typescript
  public attachControllerSocket(roomId: string, socket: WebSocket, deviceId: string, slot: PlayerSlot = 1):
    { session: RoomSession; movedFromSlot?: PlayerSlot } | { error: 'ROOM_NOT_FOUND' | 'SLOT_OCCUPIED' };
  public getControllerSlot(session: RoomSession, socket: WebSocket): PlayerSlot | undefined;
  public getControllerSockets(session: RoomSession): WebSocket[];
  public removeSocket(socket: WebSocket): { roomId?: string; role?: 'PC' | 'CONTROLLER'; slot?: PlayerSlot };
  ```
  `socketToRoom`은 그대로(`Map<WebSocket, string>`).
- **Execution Flow / Logic** (`attachControllerSocket`):
  1. 방 없으면 `{ error: 'ROOM_NOT_FOUND' }`.
  2. 대상 슬롯 seat가 있고 `seat.deviceId !== deviceId`이고 `seat.socket?.readyState === WebSocket.OPEN`이면 `{ error: 'SLOT_OCCUPIED' }`.
  3. 다른 슬롯에 같은 `deviceId`가 있으면 그 슬롯 삭제, `movedFromSlot` 기록(그 소켓은 `socketToRoom`에서 지우지 않는다 — 같은 소켓일 수 있음).
  4. `controllers[slot] = { socket, deviceId }`, `socketToRoom.set(socket, roomId)`.
  - **호출부 변경 주의**: 반환 타입이 바뀌므로 `wsServer.ts`의 두 호출부(DEVICE_CHECK, REGISTER_NICKNAME)를 모두 고친다.
- `removeSocket`: PC면 기존. 컨트롤러면 그 소켓을 가진 슬롯을 찾아 `seat.socket = undefined`(seat 자체와 deviceId는 남겨 재접속 시 같은 슬롯 판단에 쓴다), `{ role: 'CONTROLLER', slot }`. 방 삭제 조건: PC 소켓 없고 모든 seat의 socket 없음.

### I03. wsServer 중계

- Related Files:
  - `server/wsServer.ts` :: `createBeerCrusherServer` 메시지 switch, `close` 핸들러; modify

#### Details
- **Execution Flow / Logic**:
  1. `DEVICE_CHECK` / `REGISTER_NICKNAME`: `const slot = normalizeSlot(msg.slot)`. attach 결과가 error면 `sendJson(ws, { type: 'ERROR', code: result.error, message: …, slot })` 후 return. `movedFromSlot`이 있으면 PC에 `ERROR CONTROLLER_DISCONNECTED slot: movedFromSlot`. `CONTROLLER_PAIRED`에 `slot`.
  2. `CALIBRATE_ZERO`, `START_GAME_REQUEST`, `SENSOR_FRAME`: 슬롯은 **메시지 값보다 소켓 기준**을 우선한다: `const slot = roomManager.getControllerSlot(session, ws) ?? normalizeSlot(msg.slot)`. PC로 가는 메시지에 `slot`.
  3. `START_GAME_REQUEST`의 `GAME_COUNTDOWN_START`는 `getControllerSockets(session)` 전부에 보낸다. PC가 보낸 START_GAME_REQUEST(소켓이 PC)도 같은 처리(PC는 `slot` 없이 보냄 → `GAME_START_RELAY`는 PC 자신에게만, slot 1).
  4. `FEVER_STATUS_SYNC`, `SKILL_STATE_SYNC`(PC→폰): `session.controllers[normalizeSlot(msg.slot)]?.socket`으로만 보낸다.
  5. `SENSOR_CONFIG_UPDATE`: 보낸 쪽이 PC면 모든 컨트롤러, 컨트롤러면 PC.
  6. `GAME_SCORE_SUBMIT`의 `RANKING_UPDATED` 브로드캐스트: PC + 모든 컨트롤러(보낸 소켓 제외).
  7. `close`: 컨트롤러면 PC에 `ERROR CONTROLLER_DISCONNECTED` + `slot`. PC면 모든 컨트롤러에 `PC_DISCONNECTED`.

### I04. 테스트

- Related Files:
  - `tests/server-coop-slots.test.ts`; new (기존 `tests/server-session.test.ts` 243행의 소켓 테스트 헬퍼 방식을 복사해 쓴다)

#### Details
- 폰 A(slot 1), 폰 B(slot 2) DEVICE_CHECK(등록된 기기) → PC가 `CONTROLLER_PAIRED` 두 번, `slot` 1/2.
- B의 `SENSOR_FRAME`(slot 필드 없이 보내도) → PC `SENSOR_RELAY.slot === 2`(소켓 기준).
- PC `SKILL_STATE_SYNC slot 2` → B만 받고 A는 안 받음.
- C 기기가 slot 2로 DEVICE_CHECK → `ERROR SLOT_OCCUPIED`.
- A가 slot 2로 다시 DEVICE_CHECK(B 끊긴 뒤) → PC가 `CONTROLLER_DISCONNECTED slot 1` 받고 A는 slot 2.
- B 소켓 close → PC `CONTROLLER_DISCONNECTED slot 2`.
- 슬롯 없는 옛 DEVICE_CHECK → slot 1(기존 `server-session.test.ts`, `room-persistence.test.ts` 통과로 확인).

## Acceptance Criteria
- [x] 폰 두 대가 한 방에서 서로의 메시지를 받지 않는다.
- [x] 기존 서버 테스트 수정 없이 통과.

## Validation
- `npx vitest run tests/server-coop-slots.test.ts tests/server-session.test.ts tests/room-persistence.test.ts tests/controller-reconnect.test.ts tests/shared-protocol.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
feat(server): two controller slots per room with slot-aware relays

Plan: 2026-11-07-two-player-coop
Phase: P03-server-protocol
Task: T01-slot-protocol

- Messages carry slot (missing slot = 1); RoomManager seats controllers in slots 1 and 2
- Sensor, zeroing and start relays tell the PC which slot sent them; fever/skill sync go to one slot
- SLOT_OCCUPIED for a second device; a device moving slots frees its old one

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
