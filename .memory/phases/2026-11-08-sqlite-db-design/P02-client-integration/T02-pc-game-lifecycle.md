# Task: T02 PC 판 생명주기 연동

## Status: done

## Goal
PC가 판 시작 때 `GAME_BEGIN`을 보내 `gameId`를 받고, 무기 선택 때 `WEAPON_CHOSEN`, 일시정지 메뉴에서 나갈 때 `GAME_ABANDON`을 보내며, 종료 제출에 `gameId`를 붙인다. 이 Task가 끝나면 P01 이후 끊겨 있던 실제 게임의 점수 기록이 다시 동작하고, 한 판이 DB에 시작부터 끝까지 남는다.

## Decision Summary
- D02: `GAME_BEGIN`은 `PCGamePage.handleStartGame` 안, 무기 선택 화면이 뜨는 순간 보낸다. 결과 화면 "다시하기"(`sameRoster`)와 일시정지 메뉴 "다시시작"도 이 함수를 지나므로 판마다 새 `gameId`가 생긴다.
- D03: 무기는 고르는 순간 `WEAPON_CHOSEN`(엔진 `onWeaponChosen` 훅, P02-T01).
- D04 수정본: 일시정지 메뉴 "로비로"·"다시시작"은 `GAME_ABANDON`. 소켓이 끊겨 재접속해도 `gameId`는 유지한다(서버는 끊김으로 판을 정리하지 않는다).

## Implementation

### I01. 메시지 빌더 (순수 함수)
- Related Files:
  - `src/pc/scoreSubmission.ts` :: `buildScoreSubmissions`, `buildGameBegin`(new); modify
  - `src/shared/types.ts` :: `GAME_SCORE_SUBMIT`의 `gameId`; modify
#### Details
- **Signatures & Types**:
  ```typescript
  export type GameBeginMessage = Extract<ClientToServerMessage, { type: 'GAME_BEGIN' }>;

  /**
   * 판에 들어가는 슬롯(map에 있는 슬롯)으로 GAME_BEGIN을 만든다.
   * 참가 슬롯 중 하나라도 입력(input)이나 서버 확인 프로필(player.deviceId)이 없으면 null(보내지 않는다).
   */
  export function buildGameBegin(
    slots: SlotPair,
    map: Partial<Record<PlayerSlot, PlayerIndex>>,
    roomId: string,
    beginId: string
  ): GameBeginMessage | null;

  // 기존 함수에 gameId 인자 추가
  export function buildScoreSubmissions(
    engine: BeerCrusherEngine,
    slots: SlotPair,
    map: Partial<Record<PlayerSlot, PlayerIndex>>,
    roomId: string,
    gameId: number
  ): ScoreSubmitMessage[];
  ```
- `buildGameBegin` 로직:
  1. `entries = ([1, 2] as PlayerSlot[]).filter((s) => map[s] !== undefined)`.
  2. 각 슬롯의 `SlotState`에서 `input`과 `player?.deviceId`를 꺼낸다. 없으면 `null` 반환.
  3. `players = entries.map((slot) => ({ slot, deviceId, inputKind: input }))`, `mode = players.length === 2 ? 'coop' : 'solo'`.
  4. `{ type: 'GAME_BEGIN', roomId, beginId, mode, players }`.
- `buildScoreSubmissions`: 메시지에 `gameId` 필드를 넣는다. 나머지는 그대로.
- `types.ts`: `GAME_SCORE_SUBMIT`의 `gameId?: number`를 `gameId: number`(필수)로 바꾼다. P01-T02에서 PC 컴파일을 위해 optional로 두었던 것을 되돌리는 것이다. 서버 테스트의 제출 메시지 리터럴이 타입 오류가 나면 `gameId`를 넣는다(이미 넣었어야 정상).

### I02. PCGamePage 연결
- Related Files:
  - `src/pc/PCGamePage.tsx` :: `handleStartGame`(932행), `handleMessage` switch(521행~), `submitScores`(828행), `handleRestartFromPause`(1146행), `handleExitToLobbyFromPause`(1311행), 엔진 훅 연결 effect(new); modify
#### Details
- **새 ref** (컴포넌트 상단, 다른 ref 근처):
  ```typescript
  /** 서버가 발급한 현재 판 ID. GAME_STARTED를 받기 전이나 판이 없으면 null. */
  const gameIdRef = useRef<number | null>(null);
  /** 응답을 기다리는 GAME_BEGIN의 beginId. 늦게 온 옛 응답을 걸러낸다. */
  const pendingBeginIdRef = useRef<string | null>(null);
  /** gameId를 받기 전에 고른 무기. GAME_STARTED를 받으면 보낸다. */
  const pendingWeaponsRef = useRef<{ slot: PlayerSlot; weaponKind: WeaponKind }[]>([]);
  ```
- **전송 헬퍼**: `const sendToServer = (msg: ClientToServerMessage) => { const ws = wsRef.current; if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); };` (`useCallback` 없이 ref만 읽으므로 컴포넌트 본문 함수로 충분. 소켓 effect 클로저 안에서도 쓰려면 `useRef`로 감싸거나 effect 안에서 `wsRef`를 직접 쓴다.)
- **`handleStartGame`** — `engine.startGame(...)`과 이탈 표시 루프 뒤, `setPhase('PLAYING')` 앞에:
  ```typescript
  gameIdRef.current = null;
  pendingWeaponsRef.current = [];
  const beginId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const roomIdNow = roomIdRef.current;
  const beginMsg = roomIdNow ? buildGameBegin(slotsRef.current, slotIndexMapRef.current, roomIdNow, beginId) : null;
  pendingBeginIdRef.current = beginMsg ? beginId : null;
  if (beginMsg) sendToServer(beginMsg);
  else console.warn('GAME_BEGIN not sent: missing room or player identity; this run will not be recorded');
  ```
  - 함정: `handleStartGame`의 `useCallback` 의존성은 `[engine, syncProcessors]`다. `roomId` state를 쓰면 클로저가 옛 값을 잡으니 반드시 `roomIdRef.current`를 쓴다(`handleSubmitMouseNickname`이 이미 이렇게 한다).
  - `crypto.randomUUID`는 보안 컨텍스트(HTTPS/localhost)에서만 있다. 개발 서버는 basic-ssl이지만 LAN IP 접속 등을 고려해 폴백을 둔다.
- **`handleMessage`에 `case 'GAME_STARTED'`** 추가:
  ```typescript
  case 'GAME_STARTED':
    if (msg.beginId !== pendingBeginIdRef.current) break; // 이전 판의 늦은 응답
    pendingBeginIdRef.current = null;
    gameIdRef.current = msg.gameId;
    for (const w of pendingWeaponsRef.current) {
      wsRef.current?.send(JSON.stringify({ type: 'WEAPON_CHOSEN', roomId: roomIdRef.current, gameId: msg.gameId, slot: w.slot, weaponKind: w.weaponKind }));
    }
    pendingWeaponsRef.current = [];
    break;
  ```
  `case 'ERROR'`에서 `msg.code === 'GAME_BEGIN_REJECTED'`면 `pendingBeginIdRef.current = null`, `console.warn` 후 break(게임은 계속, 기록만 안 됨).
- **엔진 훅 연결** (새 `useEffect`, 의존성 `[engine]`):
  ```typescript
  useEffect(() => {
    engine.onWeaponChosen = (playerIndex, weaponKind) => {
      const slot = indexToSlot(slotIndexMapRef.current, playerIndex);
      if (slot === undefined) return;
      const gameId = gameIdRef.current;
      if (gameId === null) { pendingWeaponsRef.current.push({ slot, weaponKind }); return; }
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && roomIdRef.current) {
        ws.send(JSON.stringify({ type: 'WEAPON_CHOSEN', roomId: roomIdRef.current, gameId, slot, weaponKind }));
      }
    };
    return () => { engine.onWeaponChosen = null; };
  }, [engine]);
  ```
  - 함정: 무기 선택 라운드는 열린 뒤 800ms 동안 사격을 받지 않지만(`shootCardSelect`), 서버 응답이 그보다 늦을 수 있다. 그래서 `gameId`가 없을 때 버리지 말고 `pendingWeaponsRef`에 쌓는다.
- **`submitScores`**: `buildScoreSubmissions(engine, slotsRef.current, slotIndexMapRef.current, roomId, gameId)`로 바꾸고, 앞에서 `const gameId = gameIdRef.current;`가 `null`이면 `console.warn('Score not submitted: no gameId')` 후 메시지 전송만 건너뛴다(아래 협동 결과 화면 구성 코드는 그대로 실행되어야 한다). 전송 뒤 `gameIdRef.current = null`(같은 판 재제출 방지. 기존 한 번만 제출 가드와 별개로 안전장치).
- **`handleRestartFromPause`**, **`handleExitToLobbyFromPause`**: 함수 맨 앞에
  ```typescript
  const abandonId = gameIdRef.current;
  if (abandonId !== null && roomIdRef.current) {
    wsRef.current?.readyState === WebSocket.OPEN &&
      wsRef.current.send(JSON.stringify({ type: 'GAME_ABANDON', roomId: roomIdRef.current, gameId: abandonId }));
  }
  gameIdRef.current = null;
  pendingBeginIdRef.current = null;
  ```
  "다시시작"은 이어서 `handleStartGame`이 새 `GAME_BEGIN`을 보낸다(서버도 같은 방의 `playing` 판을 정리하므로 메시지가 유실돼도 결과는 같다).
  - 결과 화면의 "다시하기"/"로비로"(`pressScreenButton`)에는 넣지 않는다. 이미 제출되어 `gameIdRef`가 null이다.
- 소켓 재접속(`socket.onopen` → `CREATE_ROOM`)에서 `gameIdRef`를 지우지 **않는다**(D04 수정본).

### I03. 테스트
- Related Files:
  - `tests/coop-start-flow.test.ts` :: `describe('buildScoreSubmissions')`; modify
  - `tests/pc-game-lifecycle.test.ts`; new
#### Details
- `coop-start-flow.test.ts` 133·174행 호출에 `gameId`(예: 42) 인자를 추가하고, 각 메시지의 `gameId === 42`를 확인한다.
- `tests/pc-game-lifecycle.test.ts`:
  1. `buildGameBegin`: 마우스 1P 솔로 → `mode 'solo'`, `players [{ slot: 1, deviceId, inputKind: 'mouse' }]`. 폰 2P만 있는 솔로(map `{2: 0}`) → `slot 2`. 2인 → `mode 'coop'`, slot 1·2 순서. 참가 슬롯에 `player`가 없으면 `null`.
  2. 소스 가드(저장소 관례, `tests/pc-reconnect.test.ts` 방식으로 `fs.readFileSync('src/pc/PCGamePage.tsx')`):
     - `handleStartGame` 본문에 `buildGameBegin(`이 있다.
     - `case 'GAME_STARTED'`에서 `msg.beginId !== pendingBeginIdRef.current`를 검사한다.
     - `engine.onWeaponChosen =`이 있다.
     - `handleRestartFromPause`와 `handleExitToLobbyFromPause` 각각에 `'GAME_ABANDON'`이 있다(정규식으로 함수 본문 범위 안에서 확인).
     - `socket.onopen` 블록에 `gameIdRef.current = null`이 없다.

## Acceptance Criteria
- [ ] 판을 시작하면 PC가 `GAME_BEGIN`을 1번 보내고, `GAME_STARTED`의 `gameId`를 기억한다.
- [ ] 무기를 고르면 `WEAPON_CHOSEN`이 가고, 응답 전에 고른 무기도 응답 후 전송된다.
- [ ] 종료 제출 메시지 모두에 같은 `gameId`가 들어 있다.
- [ ] 일시정지 메뉴 "로비로"/"다시시작"이 `GAME_ABANDON`을 보낸다.
- [ ] `GAME_SCORE_SUBMIT.gameId`가 필수 타입이고 tsc가 통과한다.

## Validation
- `npx tsc --noEmit` — 오류 0
- `npx vitest run tests/coop-start-flow.test.ts tests/pc-game-lifecycle.test.ts tests/score-submit-once.test.ts tests/pause-menu.test.ts` — 전부 통과
- `npm test` — 전부 통과

## Commit Message
```text
feat(pc): 판 시작·무기 선택·중도 종료를 서버 판 기록과 연결

Plan: 2026-11-08-sqlite-db-design
Phase: P02-client-integration
Task: T02-pc-game-lifecycle

- buildGameBegin 추가, buildScoreSubmissions에 gameId 인자, 제출 메시지 gameId 필수화
- handleStartGame에서 GAME_BEGIN 전송, GAME_STARTED의 beginId 대조 후 gameId 보관
- 엔진 onWeaponChosen으로 WEAPON_CHOSEN 전송(gameId 전 선택은 보관 후 전송)
- 일시정지 메뉴 로비로·다시시작에서 GAME_ABANDON 전송
- 메시지 빌더 단위 테스트와 PCGamePage 소스 가드
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `0832b03`
