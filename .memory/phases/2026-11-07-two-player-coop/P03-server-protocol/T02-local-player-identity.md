# Task: T02 마우스 플레이어 등록(REGISTER_LOCAL_PLAYER)

## Status: done

## Goal
PC 화면의 마우스 플레이어가 닉네임과 브라우저 기기 ID로 서버 프로필을 갖게 한다(D15). PC 소켓이 `REGISTER_LOCAL_PLAYER`를 보내면 서버가 `PlayerStore`에 등록·갱신하고 `LOCAL_PLAYER_REGISTERED`로 프로필을 돌려준다. 이후 이 기기 ID로 점수를 제출하므로 고정 ID `pc-device-host`/`pc-host`는 쓰지 않게 된다(제거는 P04-T05).

## Decision Summary
- D15: 기기 ID는 폰과 같은 `getOrCreateDeviceId`(localStorage `beer_crusher_device_id`). 서버·엔진은 이 값을 "플레이어 식별자" 하나로만 다룬다.
- 기존 `REGISTER_NICKNAME`은 컨트롤러 소켓을 붙이는 부작용이 있어 PC에서 재사용하면 PC 소켓이 컨트롤러 자리를 차지한다. 그래서 새 메시지를 만든다.
- PC 브라우저와 폰 브라우저가 같은 기기(같은 origin의 localStorage)를 쓰지 않으므로 ID 충돌은 없다. 같은 PC 브라우저에서 마우스 슬롯은 항상 같은 ID다.

## Implementation

### I01. 메시지

- Related Files:
  - `src/shared/types.ts` :: `ClientToServerMessage`, `ServerToClientMessage`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // ClientToServerMessage
  | { type: 'REGISTER_LOCAL_PLAYER'; roomId: string; deviceId: string; nickname: string; slot: PlayerSlot }
  // ServerToClientMessage
  | { type: 'LOCAL_PLAYER_REGISTERED'; roomId: string; slot: PlayerSlot; player: PlayerProfile }
  ```

### I02. 서버 처리

- Related Files:
  - `server/wsServer.ts` :: `case 'REGISTER_LOCAL_PLAYER'`; modify
  - `server/PlayerStore.ts` :: `registerOrUpdateNickname` — 그대로 사용(2~10자 검증, 실패 시 throw); read-only

#### Details
- **Execution Flow / Logic**:
  1. `roomId`, `deviceId`, `nickname`(string) 없으면 `ERROR INVALID_REQUEST`.
  2. 방이 없거나 `session.pcSocket !== ws`이면 `ERROR NOT_ROOM_HOST`(다른 소켓이 남의 방에 마우스 플레이어를 끼워 넣지 못하게).
  3. `playerStore.registerOrUpdateNickname(deviceId, nickname)`; 예외면 `ERROR INVALID_NICKNAME`(기존 메시지 그대로).
  4. 성공: `sendJson(ws, { type: 'LOCAL_PLAYER_REGISTERED', roomId, slot: normalizeSlot(msg.slot), player })`. 컨트롤러 슬롯은 건드리지 않는다.

### I03. PC 쪽 기기 ID 모듈 위치

- Related Files:
  - `src/shared/deviceIdentity.ts` :: `getOrCreateDeviceId`, `DEVICE_ID_STORAGE_KEY` — 공용 위치로 이동; new
  - `src/controller/sensors/DeviceIdentity.ts` — `export * from '../../shared/deviceIdentity';` 한 줄로 바꿔 기존 import 유지; modify

#### Details
- 코드 내용은 그대로 옮긴다. PC 코드(`src/pc/**`)가 `src/controller/**`를 import하지 않게 하려는 이동이다.

### I04. 테스트

- Related Files:
  - `tests/server-local-player.test.ts`; new

#### Details
- PC 소켓 CREATE_ROOM → `REGISTER_LOCAL_PLAYER { nickname: '마우스왕', slot: 1 }` → `LOCAL_PLAYER_REGISTERED.player.nickname === '마우스왕'`, `playerStore.findByDeviceId(id)` 존재.
- 1자 닉네임 → `ERROR INVALID_NICKNAME`.
- 컨트롤러 소켓이 보내면 `ERROR NOT_ROOM_HOST`.
- 등록 후 `session.controllers`가 비어 있음(PC가 컨트롤러 자리를 차지하지 않음).

## Acceptance Criteria
- [x] 마우스 플레이어가 기기 ID별 프로필을 가진다.
- [x] 컨트롤러 슬롯에 영향이 없다.

## Validation
- `npx vitest run tests/server-local-player.test.ts tests/controller-sensors.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
feat(server): register the PC mouse player by device id

Plan: 2026-11-07-two-player-coop
Phase: P03-server-protocol
Task: T02-local-player-identity

- REGISTER_LOCAL_PLAYER from the room's PC socket upserts the nickname and replies LOCAL_PLAYER_REGISTERED
- Device id helper moves to src/shared so the PC can use it; controller import kept

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
