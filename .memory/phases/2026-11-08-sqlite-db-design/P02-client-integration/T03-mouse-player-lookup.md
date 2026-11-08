# Task: T03 닉네임 고정과 변경 (마우스·폰), 마우스 슬롯 신원 기록

## Status: pending

## Goal
마우스 슬롯을 고르면 PC 브라우저의 `deviceId`로 서버에 조회해, 이미 등록된 플레이어는 닉네임 입력 없이 바로 슬롯에 앉힌다. 서버는 마우스 슬롯의 `deviceId`를 세션(`localPlayers`)에 기록하고, `GAME_BEGIN`의 마우스 참가자를 이 값과 대조한다. 마우스와 폰 모두 "닉네임 변경" 버튼으로 닉네임을 바꿀 수 있다. 브라우저에 따로 저장하던 마우스 닉네임(`beer_crusher_mouse_nickname`)은 없앤다.

마우스와 폰 변경 UI를 한 Task로 묶은 이유: 둘 다 "등록된 사람은 입력을 건너뛰고, 바꾸고 싶을 때만 폼을 연다"는 같은 규칙이고, 서버는 같은 upsert(`registerOrUpdateNickname`)를 쓴다. 폰 쪽은 수 줄짜리 UI 변경이라 단독 Task로 두면 과분할이다.

## Decision Summary
- D12: 식별 단위는 당분간 브라우저 `deviceId`. 닉네임 원본은 DB `players.nickname` 하나. 사람 단위 식별은 Entra 연동 때(범위 밖).
- D12: `GAME_BEGIN` 마우스 슬롯 대조는 `session.localPlayers[slot]`. P01-T02는 폰 슬롯만 대조했고, 이 Task가 마우스를 추가한다.
- D12 추가분: 폰도 등록된 상태의 환영 화면에서 "닉네임 변경"을 할 수 있다. 서버 변경 없이 기존 `REGISTER_NICKNAME`을 다시 보낸다.

## Implementation

### I01. 프로토콜과 세션
- Related Files:
  - `src/shared/types.ts` :: `ClientToServerMessage`, `ServerToClientMessage`; modify
  - `server/RoomManager.ts` :: `RoomSession`, `createRoomSession`, `RoomManager.setLocalPlayer`(new), `attachControllerSocket`; modify
#### Details
- **Signatures & Types**:
  ```typescript
  // ClientToServerMessage
  /** 마우스 슬롯 선택 시 PC가 자기 deviceId로 기존 플레이어를 조회한다. */
  | { type: 'LOOKUP_LOCAL_PLAYER'; roomId: string; deviceId: string; slot: PlayerSlot }
  // ServerToClientMessage
  /** 조회한 deviceId가 등록되지 않았다. PC는 닉네임 입력 폼을 보여준다. */
  | { type: 'LOCAL_PLAYER_UNKNOWN'; roomId: string; slot: PlayerSlot }

  // RoomSession
  /** 마우스(PC 로컬) 플레이어의 슬롯별 deviceId. 서버 재시작 시 비므로 PC가 재접속 때 다시 조회한다. */
  localPlayers: Partial<Record<PlayerSlot, string>>;

  // RoomManager
  /** 마우스 플레이어를 슬롯에 기록한다. 같은 deviceId가 다른 슬롯에 있으면 지운다. */
  public setLocalPlayer(session: RoomSession, slot: PlayerSlot, deviceId: string): void;
  ```
- `createRoomSession`: `localPlayers: {}` 초기화.
- `attachControllerSocket`: 폰이 어떤 슬롯에 앉으면 `delete session.localPlayers[slot]`(그 슬롯은 이제 폰 자리).
- `setLocalPlayer`: `const other = slot === 1 ? 2 : 1; if (session.localPlayers[other] === deviceId) delete session.localPlayers[other]; session.localPlayers[slot] = deviceId;`

### I02. 서버 핸들러
- Related Files:
  - `server/wsServer.ts` :: `case 'REGISTER_LOCAL_PLAYER'`, `case 'LOOKUP_LOCAL_PLAYER'`(new), `case 'GAME_BEGIN'`; modify
#### Details
- **`REGISTER_LOCAL_PLAYER`**: 등록 성공(`registerOrUpdateNickname`) 뒤 `roomManager.setLocalPlayer(session, slot, deviceId)`. 나머지 그대로.
- **`LOOKUP_LOCAL_PLAYER`**:
  1. P01-T02의 `requireHost(ws, msg.roomId)`로 PC 소켓 확인(아니면 `NOT_ROOM_HOST`).
  2. `deviceId`가 1~64자 문자열이 아니면 `INVALID_REQUEST`. `slot = normalizeSlot(msg.slot)`.
  3. `player = playerStore.findByDeviceId(deviceId)`.
     - 있으면: `setLocalPlayer`, `touchLastSeen`, `sendJson(ws, { type: 'LOCAL_PLAYER_REGISTERED', roomId: session.roomId, slot, player })`(기존 응답 재사용 → PC의 슬롯 채우기 코드가 그대로 동작).
     - 없으면: `sendJson(ws, { type: 'LOCAL_PLAYER_UNKNOWN', roomId: session.roomId, slot })`.
- **`GAME_BEGIN`** 신원 대조에 추가: `inputKind === 'mouse'`인 항목은 `session.localPlayers[slot] === deviceId`여야 한다. 아니면 `GAME_BEGIN_REJECTED`.

### I03. PC 로비 흐름
- Related Files:
  - `src/pc/PCGamePage.tsx` :: `savedMouseNickname` state(116행), `handleChooseInput`(1268행), `handleMessage`의 `ROOM_CREATED`(525행)·`LOCAL_PLAYER_REGISTERED`(578행)·`LOCAL_PLAYER_UNKNOWN`(new), `handleEditMouseNickname`(new), `QRPairingModal` props 전달(1688행 근처); modify
#### Details
- `savedMouseNickname` state와 `setSavedMouseNickname`, `localStorage`의 `beer_crusher_mouse_nickname` 읽기·쓰기를 모두 제거한다.
- **조회 전송 헬퍼**:
  ```typescript
  const sendLookupLocalPlayer = useCallback((slot: PlayerSlot) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && roomIdRef.current) {
      ws.send(JSON.stringify({ type: 'LOOKUP_LOCAL_PLAYER', roomId: roomIdRef.current, deviceId: getOrCreateDeviceId(), slot }));
    }
  }, []);
  ```
- **`handleChooseInput`**: 현재는 `setSlots`의 함수형 업데이트 안에서만 판정한다. 조회 전송은 업데이트 함수 밖에서 해야 하므로(React가 업데이트 함수를 두 번 실행할 수 있음) 다음처럼 바꾼다:
  ```typescript
  const res = chooseSlotInput(slotsRef.current, slot, input);
  if (res.rejected) return;
  setSlots(res.slots);
  const changedToMouse = input === 'mouse' && slotsRef.current.find((s) => s.slot === slot)?.input !== 'mouse';
  if (changedToMouse) sendLookupLocalPlayer(slot);
  ```
  (`slotsRef.current`는 렌더마다 갱신되는 기존 ref다. `useCallback` 의존성에 `sendLookupLocalPlayer`를 넣는다.)
- **`case 'LOCAL_PLAYER_REGISTERED'`**: `setSlots(updateSlot(... { player }))`와 `setMouseNicknameError(null)`만 남기고 localStorage 저장을 지운다.
- **`case 'LOCAL_PLAYER_UNKNOWN'`**: `setMouseNicknameError(null)`. 슬롯은 `player`가 없으므로 입력 폼이 그대로 보인다.
- **`case 'ROOM_CREATED'`**(재접속 포함)에 추가: `slotsRef.current`에서 `input === 'mouse' && player`인 슬롯마다 `sendLookupLocalPlayer(slot)`.
  - 함정: 서버가 재시작되면(개발 중 `tsx watch`, 장애) 방과 `localPlayers`가 메모리에서 사라진다. PC는 같은 방 코드로 다시 만들지만, 마우스 슬롯은 PC 화면에서는 "준비 완료"인데 서버는 그 `deviceId`를 모른다. 이대로 판을 시작하면 `GAME_BEGIN`이 `GAME_BEGIN_REJECTED`로 거절되어 판이 기록되지 않는다. 재접속 때 다시 조회해 서버 기록을 복구해야 한다. 소켓 effect의 클로저에서 부르므로 `sendLookupLocalPlayer`가 아니라 `wsRef`·`roomIdRef`를 직접 쓰거나 ref로 감싼 헬퍼를 쓴다(`handleStartGameRef` 같은 기존 ref 패턴).
- **`handleEditMouseNickname(slot)`**(new): `setSlots((prev) => updateSlot(prev, slot, { player: undefined }))`, `setMouseNicknameError(null)`. 서버의 `localPlayers`는 그대로 둔다(같은 `deviceId`이므로 다시 등록해도 같은 값).
- `QRPairingModal`에 `savedMouseNickname` 대신 `onEditMouseNickname={handleEditMouseNickname}`를 넘긴다.

### I04. 로비 슬롯 카드 UI
- Related Files:
  - `src/pc/components/QRPairingModal.tsx` :: `QRPairingModalProps`, `SlotCardProps`, `SlotCard`, `QRPairingModal`; modify
#### Details
- props: `savedMouseNickname: string` 제거, `onEditMouseNickname: (slot: PlayerSlot) => void` 추가(두 인터페이스 모두, 그리고 494·504행의 SlotCard 전달부).
- `SlotCard`: `useState<string>(savedMouseNickname || '')` → `useState<string>('')`. `savedMouseNickname` 동기화 `useEffect`(72~75행) 제거.
- `input === 'mouse' && player` 블록(355행 근처, "`{player.nickname} · 마우스로 플레이`")에 버튼 추가:
  ```tsx
  <button
    type="button"
    data-testid={`mouse-nickname-edit-${slot}`}
    onClick={() => { setMouseNameInput(player.nickname); onEditMouseNickname(slot); }}
    style={{ marginTop: '10px', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: '#cbd5e1', fontSize: '12px', cursor: 'pointer' }}
  >
    닉네임 변경
  </button>
  ```
  누르면 폼이 현재 닉네임으로 미리 채워져 다시 나타나고, 제출하면 기존 `REGISTER_LOCAL_PLAYER`가 닉네임을 바꾼다.
- 함정: 이 로비는 마우스 클릭이 발사로도 처리되는 화면이다. 입력칸은 이미 `onKeyDown={(e) => e.stopPropagation()}`을 쓴다. 새 버튼도 기존 "확인" 버튼처럼 일반 `<button>`이면 된다(로비에서는 게임 사격 처리가 꺼져 있음). 브라우저 확인은 P03 체크리스트로 남긴다.

### I05. 폰 닉네임 변경
- Related Files:
  - `src/controller/components/LoginAndPermissionGate.tsx` :: `LoginAndPermissionGate`; modify
  - `src/controller/MobileControllerPage.tsx` :: `handleRegisterNickname`(333행), `AUTH_RESULT` 처리(202행); read-only (변경 불필요 확인용)
#### Details
- 현재 구조: `isNewUser`가 true면 닉네임 폼(93행~), false면 "반갑습니다, {nickname}님!" 환영 카드와 센서 권한 버튼이다. 기존 사용자가 닉네임을 바꿀 길이 없다.
- 변경:
  1. state 추가: `const [isEditingNickname, setIsEditingNickname] = useState(false);`
  2. 폼 표시 조건을 `isNewUser ? (...)`에서 `isNewUser || isEditingNickname ? (...)`로 바꾼다. 폼 제출 핸들러(`handleRegisterSubmit`)는 그대로 쓴다.
  3. 편집 모드의 폼 안내 문구는 "첫 접속입니다! …" 대신 "새 닉네임을 입력해주세요."로, 제출 버튼 아래에 "취소" 버튼(`type="button"`, `onClick={() => { setIsEditingNickname(false); setErrorMessage(''); }}`)을 둔다. 신규 사용자 폼에는 취소 버튼이 없다.
  4. 환영 카드("반갑습니다, …님!" 블록) 아래, 센서 권한 버튼 위에 버튼 추가:
     ```tsx
     <button
       type="button"
       data-testid="phone-nickname-edit"
       onClick={() => { setNicknameInput(player?.nickname ?? ''); setErrorMessage(''); setIsEditingNickname(true); }}
       style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: '#cbd5e1', fontSize: '13px', marginBottom: '12px', cursor: 'pointer' }}
     >
       닉네임 변경
     </button>
     ```
  5. 저장 완료 시 편집 모드 닫기: `useEffect(() => { setIsEditingNickname(false); }, [player?.nickname]);`. 서버가 `REGISTER_NICKNAME`에 `AUTH_RESULT { isNewUser: false, player }`로 응답하면 `MobileControllerPage`가 `setPlayer(msg.player)`를 하므로 닉네임이 바뀌는 순간 폼이 닫힌다.
- 서버와 `MobileControllerPage`는 바꾸지 않는다. `REGISTER_NICKNAME`은 `registerOrUpdateNickname`(upsert) 후 `AUTH_RESULT`와 PC 쪽 `CONTROLLER_PAIRED`를 다시 보내므로, PC 로비 슬롯의 닉네임도 함께 갱신된다(`applyControllerPaired`).
- 함정: 같은 닉네임으로 다시 제출하면 `player.nickname`이 그대로라 4번의 effect가 안 돌아 폼이 닫히지 않는다. `handleRegisterSubmit`에서 `result.trimmed === player?.nickname`이면 서버에 보내지 않고 `setIsEditingNickname(false)`만 한다.
- 이 화면은 센서 권한 허용 전(`step === 'LOGIN_GATE'`)에만 보인다. 게임 중(`PAD`)에는 닉네임을 바꿀 수 없다. 의도된 범위다.

### I06. 테스트
- Related Files:
  - `tests/phone-nickname-edit.test.tsx`; new
  - `tests/server-local-player.test.ts`; modify
  - `tests/lobby-slot-cards.test.tsx`, `tests/sensor-lab-url-only.test.tsx`; modify
  - `tests/game-lifecycle-server.test.ts`; modify
  - `tests/pc-game-lifecycle.test.ts`; modify
#### Details
- `server-local-player.test.ts`:
  1. 등록된 `deviceId`로 `LOOKUP_LOCAL_PLAYER` → `LOCAL_PLAYER_REGISTERED { slot, player.nickname }`, 그리고 `server.roomManager.getRoom(roomId)!.localPlayers[slot] === deviceId`.
  2. 미등록 → `LOCAL_PLAYER_UNKNOWN { slot }`.
  3. 폰 소켓이 보내면 → `ERROR NOT_ROOM_HOST`.
  4. `REGISTER_LOCAL_PLAYER` 성공 후 `localPlayers[slot]`이 기록된다. 같은 `deviceId`로 다른 슬롯 등록 → 이전 슬롯 항목이 지워진다.
  5. 폰이 그 슬롯에 `DEVICE_CHECK`로 앉으면 `localPlayers[slot]`이 지워진다.
- `game-lifecycle-server.test.ts`에 추가: 마우스 참가자의 `deviceId`가 `localPlayers`와 다르면 `GAME_BEGIN_REJECTED`, 같으면 `GAME_STARTED`. (P01-T02에서 마우스 참가자를 쓰던 케이스는 먼저 `REGISTER_LOCAL_PLAYER`나 `LOOKUP_LOCAL_PLAYER`를 보내도록 고친다.)
- `lobby-slot-cards.test.tsx`, `sensor-lab-url-only.test.tsx`: `savedMouseNickname=...` prop을 지우고 `onEditMouseNickname={() => {}}`를 넣는다. 마우스 플레이어가 있는 렌더 결과에 `닉네임 변경`과 `data-testid="mouse-nickname-edit-1"`이 있는지 확인한다.
- `tests/phone-nickname-edit.test.tsx` (`renderToStaticMarkup`, `tests/unsupported-device-screen.test.tsx`의 렌더 방식 참고):
  1. `isNewUser={false}`, `player={{ nickname: '두둥', ... }}` → "반갑습니다, 두둥님!"과 `data-testid="phone-nickname-edit"`가 있다.
  2. `isNewUser={true}` → 닉네임 폼과 "첫 접속입니다!"가 있고 `phone-nickname-edit`과 "취소"가 없다.
  - 클릭 상호작용(편집 모드 전환·취소·같은 닉네임 재제출)은 저장소에 DOM 테스트 환경이 없다면 소스 가드로 대신한다: 컴포넌트 소스에 `isNewUser || isEditingNickname`, `[player?.nickname]` effect, `result.trimmed === player?.nickname`이 있는지. (`grep -rn "jsdom\|happy-dom" package.json vite.config.ts`로 환경을 먼저 확인하고, 있으면 실제 클릭 테스트로 작성한다.)
- `pc-game-lifecycle.test.ts` 소스 가드 추가: `PCGamePage.tsx`에 `beer_crusher_mouse_nickname`이 없다. `case 'ROOM_CREATED'` 블록에 `LOOKUP_LOCAL_PLAYER`가 있다.

## Acceptance Criteria
- [ ] 등록된 PC 브라우저에서 마우스 슬롯을 고르면 입력 없이 "준비 완료"가 된다.
- [ ] 마우스 슬롯 카드의 "닉네임 변경"으로 닉네임을 바꾸면 DB `players.nickname`이 바뀐다.
- [ ] 등록된 폰의 환영 화면에 "닉네임 변경"이 있고, 바꾸면 폰 화면과 PC 로비 슬롯 모두 새 닉네임으로 바뀐다.
- [ ] 서버의 `localPlayers`와 다른 마우스 `deviceId`로는 `GAME_BEGIN`이 거절된다.
- [ ] 서버 재시작 뒤 PC가 재접속하면 마우스 슬롯이 서버에 다시 기록된다.
- [ ] 코드에 `beer_crusher_mouse_nickname`이 남지 않는다.

## Validation
- `npx tsc --noEmit` — 오류 0
- `npx vitest run tests/server-local-player.test.ts tests/game-lifecycle-server.test.ts tests/lobby-slot-cards.test.tsx tests/sensor-lab-url-only.test.tsx tests/pc-game-lifecycle.test.ts tests/phone-nickname-edit.test.tsx tests/controller-ui-and-routing.test.ts` — 전부 통과
- `npm test` — 전부 통과
- `grep -rn "beer_crusher_mouse_nickname\|savedMouseNickname" src tests` — 0건

## Commit Message
```text
feat(lobby): 마우스 닉네임 재입력 없애고 마우스·폰 닉네임 변경 추가

Plan: 2026-11-08-sqlite-db-design
Phase: P02-client-integration
Task: T03-mouse-player-lookup

- LOOKUP_LOCAL_PLAYER·LOCAL_PLAYER_UNKNOWN 메시지, RoomSession.localPlayers와 setLocalPlayer
- 서버: 마우스 등록·조회 시 슬롯 기록, GAME_BEGIN 마우스 참가자 대조
- PC: 마우스 선택·재접속 시 조회, 브라우저 저장 닉네임 제거, 닉네임 변경 처리
- 로비 슬롯 카드에 닉네임 변경 버튼
- 폰 환영 화면에 닉네임 변경(기존 REGISTER_NICKNAME 재사용)
- 조회·슬롯 기록·GAME_BEGIN 대조·로비·폰 화면 테스트
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
