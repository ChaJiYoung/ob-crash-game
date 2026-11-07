# Task: T05 시작 게이트·다시 시작·로비 복귀·점수 제출

## Status: pending

## Goal
2인 판을 실제로 시작하고 끝낸다. 시작 동작(로비 버튼, 폰의 가운데 사격, 폰의 시작 요청)은 `getStartGate`가 허용할 때만 먹고, 막히면 "2P 준비 중" 같은 안내를 잠깐 띄운다(D07). 카운트다운이 끝나면 참여 인원수로 `engine.startGame({ withWeaponSelect: true, playerCount })`를 부른다. 결과 화면에서는 어느 플레이어의 십자선으로든 "다시 시작"/"로비로"를 쏠 수 있고 먼저 쏜 쪽이 적용된다(D11). 다시 시작은 같은 1P/2P 구성, 로비는 슬롯 선택부터 다시. 판이 끝나면 플레이어마다 점수를 제출한다(2인은 `mode: 'coop'` 두 번, D05/D18). 고정 ID `pc-device-host`/`pc-host`를 없앤다(D15). 튜토리얼·센서 랩은 1인 전용으로 둔다(D12).

## Decision Summary
- 시작 인원은 카운트다운 **시작 시점**의 `startGate.playerCount`로 정하고, 카운트다운 중 누가 끊겨도 바꾸지 않는다(끊김은 T07이 이탈 상태로 처리).
- 판 도중 같은 구성 재시작(결과 화면·일시정지 메뉴 "다시 시작")은 `slotIndexMapRef`와 `engine.players.length`를 그대로 쓴다. 그 시점에 연결이 끊긴 폰 슬롯은 시작 직후 `engine.setPlayerAway(i, true)`.
- 튜토리얼·센서 랩: 첫 번째 참여 슬롯(없으면 1)의 입력만 쓴다. 다른 슬롯 입력은 무시(대기).

## Implementation

### I01. 시작 게이트

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `startCountdownAndGame`, `handleStartGame`, `case 'GAME_COUNTDOWN_START' | 'GAME_START_RELAY'`, `SENSOR_RELAY`의 로비 사격 분기, `startNotice` 상태(new); modify

#### Details
- **Signatures & Types**:
  ```typescript
  const [startNotice, setStartNotice] = useState<string | null>(null); // 2초 뒤 자동 해제
  const pendingPlayerCountRef = useRef<1 | 2>(1);
  const tryStartFromLobby = () => void; // 게이트 확인 후 startCountdownAndGame
  const handleStartGame = (opts?: { sameRoster?: boolean }) => void;
  ```
- **Execution Flow / Logic**:
  1. `tryStartFromLobby()`: `const gate = getStartGate(slotsRef.current)`. `!gate.canStart`면 `setStartNotice(gate.message)`, `soundSynth.playHit('MISS')` 후 return. 아니면 `pendingPlayerCountRef.current = gate.playerCount === 2 ? 2 : 1; slotIndexMapRef.current = buildSlotIndexMap(slotsRef.current); startCountdownAndGame()`.
  2. 로비 시작 경로를 모두 `tryStartFromLobby`로: `pressScreenButton('start')`(P01-T05 — 마우스 HTML 클릭, 폰의 버튼 사격이나 가운데 사격으로 옴, D26·D33), `GAME_COUNTDOWN_START`/`GAME_START_RELAY` 수신(폰이 시작 요청한 경우). 단 `GAME_COUNTDOWN_START`가 PC 자신이 보낸 `START_GAME_REQUEST`의 메아리일 수 있으므로 기존처럼 `countdownTimerRef.current`가 있으면 무시.
  3. `startCountdownAndGame` 끝(카운트 0): 슬롯별 자동 영점(P04-T04) 후 `handleStartGame()`.
  4. `handleStartGame(opts)`: 기존 정리 + `engine.startGame({ withWeaponSelect: true, playerCount: opts?.sameRoster ? (engine.players.length as 1 | 2) : pendingPlayerCountRef.current })`. 이어서 맵의 각 폰 슬롯이 `isConnected === false`면 `engine.setPlayerAway(index, true, performance.now())`.
  5. `START_GAME_REQUEST`를 PC가 보낼 때 `deviceId`: `getJoinedSlots(slotsRef.current)[0]?.player?.deviceId ?? getOrCreateDeviceId()`. `'pc-host'` 문자열을 코드에서 제거.
  6. 로비 렌더에 `startNotice` 칩(모달 하단 안내 칩 자리, 2초).

### I02. 결과 화면 입력

- Related Files:
  - `src/pc/PCGamePage.tsx` :: 처리부 `onButton`, `hitTestButton`(P01-T05), `hoveredResultAction`, 결과 렌더(현재 1372행 부근 `ResultRankingModal`과 1391행 `CrosshairOverlay`); modify

#### Details
- `hoveredResultAction`을 플레이어별 `[action0, action1]`로. 버튼 강조는 둘 중 하나라도 올라가 있으면.
- 결과 화면 버튼은 P01-T05의 `pressScreenButton`이 이미 받는다(마우스 HTML 클릭, 폰 조준 사격). 이 Task는 `pressScreenButton('restart')`를 `handleStartGame({ sameRoster: true })`로 바꾸기만 한다. 두 사람이 거의 동시에 쏘면 먼저 처리된 쪽이 단계를 바꾸므로, 뒤의 신호는 단계가 이미 PLAYING/PAIRING이라 버튼 판정을 하지 않는다. hover 강조는 각 처리부 조준으로 `hitTestButton`을 돌려 하나라도 올라가 있으면.
- 결과 화면 십자선: 참여 플레이어 수만큼(P04-T04 `crosshairRefs`) 그린다(D11 "두 십자선 모두 보인다").
- 일시정지 메뉴 "다시 시작"(`handleRestartFromPause`)도 `handleStartGame({ sameRoster: true })`.

### I03. 점수 제출

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `submitScore` → `submitScores`; modify

#### Details
- **Execution Flow / Logic**:
  1. HUD tick의 GAMEOVER/VICTORY 감지부에서 `submitScores()` 한 번.
  2. 1인·2인 같은 루프(D24): `engine.players.forEach((_, i) => …)`. `me = 슬롯(i).player`, `stats = engine.getPlayRunStats(i)!`. `stats.coop`이 있으면(파트너가 있는 판) `partner = 슬롯(stats.coop.slot === 1 ? 2 : 1).player`로 `partnerDeviceId`/`partnerNickname`을 채운다. 메시지: `{ type: 'GAME_SCORE_SUBMIT', roomId, deviceId: me?.deviceId ?? getOrCreateDeviceId(), score: stats.totalScore, waveReached: stats.waveReached, maxCombo: stats.maxCombo, rulesetVersion: RANKING_RULESET_VERSION, mode: stats.mode, stats }`. 1인 판은 이 루프가 한 번 돌고 `mode: 'solo'`가 된다.
  3. `'pc-device-host'` 문자열은 코드에서 제거.
  4. `isNewRecord`는 1인 판에서만 계산(`RANKING_UPDATED.updatedPlayer`가 플레이어 0의 deviceId일 때). 2인 판은 false.

### I04. 튜토리얼·센서 랩 1인 고정

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `handleStartTutorial`, `handleStartSandbox`, `handleOpenSensorLab`; modify

#### Details
- 시작 시 `const soloSlot = getJoinedSlots(slotsRef.current)[0]?.slot ?? 1; slotIndexMapRef.current = { [soloSlot]: 0 };`. 다른 슬롯 폰의 `SENSOR_RELAY`는 P04-T04 규칙(맵에 없음)으로 사격·스킬이 무시되고 조준만 갱신된다. 다른 슬롯 십자선은 그리지 않는다.

### I05. 테스트

- Related Files:
  - `tests/coop-start-flow.test.ts`; new

#### Details
- 순수 로직만: I01의 게이트 판단을 `decideLobbyStart(slots): { start: false; notice: string } | { start: true; playerCount: 1 | 2; map }` 순수 함수로 `src/pc/coopSlots.ts`에 추가하고 테스트(2P 준비 중 → notice, 둘 다 준비 → 2).
- 점수 제출 메시지 생성을 `buildScoreSubmissions(engine, slots, map, roomId): ClientToServerMessage[]` 순수 함수로 `src/pc/scoreSubmission.ts`에 두고 같은 테스트를 인원수 1·2로 돌린다: 1인 → 1개(`mode: 'solo'`), 2인 → 2개(`mode: 'coop'`, 서로의 deviceId가 `partnerDeviceId`, `teamScore` 같음).
- `grep -rn "pc-device-host\|pc-host" src` 결과 0건을 검증 커맨드로 확인.

## Acceptance Criteria
- [ ] 두 슬롯이 준비되면 2인 판이 시작되고(체력 1.6배), 한쪽이 준비 중이면 "2P 준비 중"이 뜨고 시작되지 않는다.
- [ ] 결과 화면에서 2P 십자선으로 "다시 시작"을 쏘면 같은 구성으로 새 판.
- [ ] 2인 판 종료 시 서버 기록에 `mode: "coop"` 두 줄, Top5 불변.
- [ ] `pc-device-host`/`pc-host`가 소스에 없다.

## Validation
- `npx vitest run tests/coop-start-flow.test.ts` — 통과
- `grep -rn "pc-device-host\|pc-host" src | wc -l` — `0`
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- 수동: 1P 마우스 + 2P 폰으로 무기 선택(6장) → 1웨이브 → 일시정지 "다시 시작" → 같은 구성 확인. 게임오버 후 `tail -2 data/play-records.jsonl`에 `"mode":"coop"` 두 줄.

## Commit Message
```text
feat(pc): start, restart and score a two-player run

Plan: 2026-11-07-two-player-coop
Phase: P04-pc-input-lobby
Task: T05-start-and-result-flow

- Every lobby start path goes through the start gate and shows "2P 준비 중" when blocked
- Restart keeps the 1P/2P roster; either crosshair can pick restart or lobby on the result screen
- Coop runs submit one coop score per player with partner info; fixed PC device ids removed
- Tutorial and sensor lab use only the first joined slot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
