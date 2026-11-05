# Task: T01 PC 방 코드 기억

## Status: done

## Goal
PC 페이지를 새로고침하거나 다시 열어도 같은 방 코드(같은 QR)가 유지되고, 서버는 같은 코드로 `CREATE_ROOM`이 와도 이미 연결된 폰 소켓을 잃지 않는다. 사용자는 'QR 새로 발급' 버튼으로 코드를 바꿀 수 있다.

## Decision Summary
- D02: 방 코드는 localStorage 저장. D01: 폰 쪽은 T02/T03에서 처리.
- 현재 `server/RoomManager.ts` `createRoom()`은 `this.rooms.set(id, session)`으로 **기존 방을 덮어쓴다**. PC가 같은 코드로 재생성하면 살아 있는 `controllerSocket` 참조가 날아간다. 반드시 기존 방을 재사용한다.

## Implementation

### I01. 방 코드 저장 헬퍼
- Related Files:
  - `src/pc/roomMemory.ts` :: `loadSavedRoomId`, `saveRoomId`, `clearSavedRoomId`, `PC_ROOM_STORAGE_KEY`; new

#### Details
- **Signatures & Types**:
  ```ts
  export const PC_ROOM_STORAGE_KEY = 'beer_crusher_pc_room_id';
  type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  export function loadSavedRoomId(storage?: StorageLike): string | undefined;
  export function saveRoomId(roomId: string, storage?: StorageLike): void;
  export function clearSavedRoomId(storage?: StorageLike): void;
  ```
- **Execution Flow / Logic**:
  1. `storage` 미지정 시 `window.localStorage`(없으면 undefined). `src/controller/sensors/DeviceIdentity.ts`의 방식을 따른다.
  2. 모든 storage 접근은 try/catch로 감싸 실패해도 throw하지 않는다.
  3. `loadSavedRoomId`는 값을 `trim().toUpperCase()`한 뒤 `/^[A-Z0-9]{3,8}$/`에 맞을 때만 반환, 아니면 `undefined`.
  4. `saveRoomId`는 같은 정규식을 통과한 값만 저장.

### I02. 서버: 기존 방 재사용
- Related Files:
  - `server/wsServer.ts` :: `case 'CREATE_ROOM'`; modify
  - `server/RoomManager.ts` :: `createRoom`, 신규 `getOrCreateRoom`; modify

#### Details
- **Signatures & Types**:
  ```ts
  // RoomManager
  public getOrCreateRoom(requestedRoomId?: string): RoomSession;
  ```
- **Execution Flow / Logic**:
  1. `requestedRoomId`가 있고 `getRoom()`이 방을 돌려주면 그 세션을 그대로 반환(덮어쓰지 않음).
  2. 없으면 `createRoom(requestedRoomId)`.
  3. `CREATE_ROOM` 핸들러에서 `createRoom` 대신 `getOrCreateRoom(msg.roomId)` 호출. 응답 `ROOM_CREATED`는 기존과 동일.
  4. `createRoom` 자체의 동작은 바꾸지 않는다(기존 테스트 유지).
  5. 요청 코드가 `/^[A-Z0-9]{3,8}$/`(대문자화 후)에 맞지 않으면 `requestedRoomId`를 무시하고 새로 생성한다.

### I03. PC 페이지 연결 + 새 QR 버튼
- Related Files:
  - `src/pc/PCGamePage.tsx` :: WebSocket `useEffect`의 `socket.onopen`, `case 'ROOM_CREATED'`, 신규 `handleRenewRoom`; modify
  - `src/pc/components/QRPairingModal.tsx` :: `QRPairingModalProps`에 `onRenewRoom?: () => void` 추가, 버튼; modify

#### Details
- **Execution Flow / Logic**:
  1. `socket.onopen`: `socket.send(JSON.stringify({ type: 'CREATE_ROOM', roomId: loadSavedRoomId() }))`. `undefined`면 JSON에서 생략된다.
  2. `case 'ROOM_CREATED'`: 기존 `setRoomId(msg.roomId)` 뒤에 `saveRoomId(msg.roomId)`.
  3. `handleRenewRoom = useCallback(() => { clearSavedRoomId(); window.location.reload(); }, [])`. 새로고침으로 소켓이 닫히면 서버가 옛 방을 정리한다.
  4. `QRPairingModal`에서 `onOpenGuide` 버튼 아래에 `onRenewRoom`이 있을 때만 `🔄 새 QR 발급 (다른 폰으로 연결)` 버튼을 같은 스타일 계열로 추가하고 `PCGamePage`의 `<QRPairingModal>`에 `onRenewRoom={handleRenewRoom}`를 넘긴다(약 1150행 부근 `roomId={roomId}` 사용처).
  5. 주의: `SANDBOX`/`initialPhase` 데모 경로에서도 `loadSavedRoomId`는 안전해야 한다(try/catch로 보장).

### I04. 테스트
- Related Files:
  - `tests/room-persistence.test.ts` :: new

#### Details
- `loadSavedRoomId`/`saveRoomId`/`clearSavedRoomId`: 메모리 스토리지 목(`Map` 기반)으로 저장·소문자 입력 대문자화·잘못된 값(`'a b'`, `''`, 9자) 거부·`getItem`이 throw해도 `undefined`.
- 서버 통합: `createBeerCrusherServer({ port: 0, storePath: <tmp> })`, PC 소켓 A가 `CREATE_ROOM`(roomId 없음) → `ROOM_CREATED.roomId` 획득. 폰 소켓 `DEVICE_CHECK`로 부착. PC 소켓 A를 닫는다. PC 소켓 B가 같은 `roomId`로 `CREATE_ROOM` → `ROOM_CREATED.roomId`가 같고, `serverInstance.roomManager.getRoom(id)?.controllerSocket`이 여전히 폰 소켓이다.
- 잘못된 코드로 `CREATE_ROOM` → 다른 유효 코드가 발급된다.
- 소켓 헬퍼는 `tests/server-session.test.ts`의 `ws` 사용 방식을 참고한다.

## Acceptance Criteria
- [ ] PC 새로고침 뒤 QR의 `room` 값이 같다.
- [ ] 같은 코드로 재생성해도 `controllerSocket`이 유지된다.
- [ ] `새 QR 발급`을 누르면 저장된 코드가 지워지고 새 코드가 발급된다.
- [ ] 기존 서버·모달 테스트가 모두 통과한다.

## Validation
- `npx vitest run tests/room-persistence.test.ts tests/server-session.test.ts tests/pc-modals-and-pairing.test.ts` — 전부 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(pairing): keep the PC room code across reloads

Plan: 2026-11-06-controller-persistence-and-pause
Phase: P01-connection-persistence
Task: T01-pc-room-code-memory

- store the room code in localStorage and request it on CREATE_ROOM
- reuse an existing room instead of overwriting it so the live controller socket survives
- add a renew-QR button to the pairing modal
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: (this commit)
