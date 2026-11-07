# Task: T04 슬롯을 플레이어 처리부에 묶기

## Status: done

## Goal
P01-T05의 어댑터·처리부 구조에서 2인을 켠다. 처리부(`PlayerActionProcessor`)를 엔진 플레이어 수만큼 두고, 폰 어댑터를 슬롯마다 하나씩 만들어 슬롯→플레이어 매핑대로 묶고, 마우스 어댑터를 마우스 플레이어에 묶는다. 게임 동작 코드는 새로 쓰지 않는다 — 1인과 같은 처리부가 둘일 뿐이다(D24, D25). 플레이어 수만큼 십자선을 그린다(색·이름표는 P05-T02).

## Decision Summary
- 슬롯→플레이어 매핑은 판 시작 시점에 `buildSlotIndexMap(slots)`(P04-T01)로 고정해 `slotIndexMapRef`에 둔다. 매핑에 없는 슬롯의 폰은 처리부에 묶이지 않는다(`sink()`가 null — 조준 표시만, 로비에서는 아래 4번).
- 마우스 묶기 규칙은 함수 하나 `getMouseBinding(slots, map, playerCount): PlayerIndex | null`에만 둔다: 마우스 슬롯이 있으면 그 플레이어. 없으면 플레이어가 1명일 때 보조 입력으로 플레이어 0(지금 1인 폰 판에서 마우스도 쓰이는 동작 유지). 그 외(폰 2대)는 null. 이 묶음은 **게임 중 사격**에만 쓰인다. 로비·결과 화면 버튼은 마우스가 HTML 클릭으로 누르므로(D26) 묶음과 무관하게 폰 2대 상황에서도 PC 마우스로 누를 수 있다.
- 3D 총은 이 Task에서 아직 하나(플레이어 0 조준). 두 자루는 P05-T06(D21).

## Implementation

### I01. 어댑터 묶기

- Related Files:
  - `src/pc/coopSlots.ts` :: `getMouseBinding`; modify
  - `src/pc/input/PhoneAdapter.ts` :: 생성자 `slot`, `syncFeedback`의 메시지 `slot`; modify
  - `src/pc/PCGamePage.tsx` :: `phoneAdaptersRef`, `mouseAdapterRef`, `syncProcessors`, `SENSOR_RELAY`, `ZERO_CALIBRATED`, 카운트다운 자동 영점, HUD 틱; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export function getMouseBinding(slots: SlotPair, map: Partial<Record<PlayerSlot, PlayerIndex>>, playerCount: number): PlayerIndex | null;

  // PhoneAdapter
  constructor(opts: { slot: PlayerSlot; sink: () => InputSink | null; send: (msg: ClientToServerMessage) => void; roomId: () => string; getTuning: () => SensorTuningConfig });
  // syncFeedback가 보내는 FEVER_STATUS_SYNC / SKILL_STATE_SYNC에 slot: this.slot (P03-T01)

  // PCGamePage
  const phoneAdaptersRef = useRef<Record<PlayerSlot, PhoneAdapter>>(/* 1, 2 각각 */);
  const processorFor = (index: PlayerIndex | undefined) => (index === undefined ? null : processorsRef.current[index] ?? null);
  ```
- **Execution Flow / Logic**:
  1. 폰 어댑터 `sink`: `() => processorFor(slotIndexMapRef.current[slot])`. 마우스 어댑터 `sink`: `() => processorFor(getMouseBinding(slotsRef.current, slotIndexMapRef.current, engine.players.length) ?? undefined)`.
  2. `syncProcessors()`(P01-T05): `engine.players.length`만큼 — 2인이면 자연히 2개. 각 처리부의 `onAim`은 `crosshairRefs[index]` 갱신 + `index === 0`이면 캔버스 총 조준.
  3. `SENSOR_RELAY`: `phoneAdaptersRef.current[msg.slot].onSensorFrame(msg.payload)`. 진단·센서 랩 표시는 매핑상 플레이어 0의 슬롯(`soloSlot = indexToSlot(map, 0) ?? 1`)일 때만.
  4. 로비(판 시작 전)에는 매핑이 아직 없으므로, 참여 슬롯을 임시 매핑(`buildSlotIndexMap(slots)`)으로 묶고 처리부를 참여 인원만큼 둔다 — 그래야 어느 폰이든 "게임 시작" 버튼을 쏠 수 있다(마우스는 HTML 클릭이라 필요 없음). 판 시작 때 같은 매핑으로 고정.
  5. `ZERO_CALIBRATED`(resume 아님): `phoneAdaptersRef.current[msg.slot].resetZero()`. 카운트다운 끝: 매핑된 폰 슬롯마다 `autoZeroFromLatest()`.
  6. HUD 틱: 모든 처리부 `tick()`, 매핑된 폰 슬롯마다 `adapter.syncFeedback(processor.getState())`.
  7. `handleShootEvent(result)`(처리부 `onShot`): 피버·무기는 `engine.getPlayer(result.playerIndex)`, 연출 `canvasRef.current?.playShotFx(result, processorsRef.current[result.playerIndex].aim)`, `crosshairRefs[result.playerIndex].current?.kick()`.

### I02. 캔버스 연출

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `GameCanvas3DHandle.playShotFx`; modify

#### Details
- `playShotFx(result: EngineShootResult, aim?: { aimX: number; aimY: number })`: 트레이서 목표에 `aim ?? targetAimRef.current`. 피버·파워샷 색은 `engine.getPlayer(result.playerIndex)`와 `engine.isBuffActive('power_shot', undefined, result.playerIndex)`.

### I03. 십자선

- Related Files:
  - `src/pc/PCGamePage.tsx` :: PLAYING·결과 렌더 `CrosshairOverlay`, 로비 십자선; modify

#### Details
- `engine.players.map((_, i) => <CrosshairOverlay key={i} ref={crosshairRefs[i]} … />)` — 1인도 같은 map(길이 1). 개별 값은 P05-T01 전까지 렌더 시점에 `engine.getPlayer(i)`에서 읽는다.
- 로비: 묶인 처리부마다 십자선(어느 폰이 어디를 겨누는지 보여 버튼을 쏠 수 있게).

### I04. 테스트

- Related Files:
  - `tests/slot-binding.test.ts`; new

#### Details
- `getMouseBinding`: 1P 폰 단독 → 0, 1P 마우스 단독 → 0, 1P 폰·2P 마우스 → 1, 1P 마우스·2P 폰 → 0, 폰 2대 → null.
- 폰 2대 결과 화면: 마우스로 "다시 시작" 버튼 HTML 클릭 → `pressScreenButton('restart')` 한 번 실행(마우스 묶음이 null이어도).
- 처리부 2개 + 폰 어댑터 2개(가짜 sink 대신 실제 처리부, 2인 엔진): 슬롯 2 snapFire → 플레이어 1만 사격. 슬롯 2 `syncFeedback` 메시지에 `slot: 2`와 플레이어 1 상태.
- 매핑에 없는 슬롯의 snapFire → 사격 없음.

## Acceptance Criteria
- [x] 이 Task에서 새로 쓴 사격·연사·피버·스킬 코드가 없다(처리부 재사용만).
- [x] 1인 판 조작이 이전과 같다.

## Validation
- `npx vitest run tests/slot-binding.test.ts tests/player-action-processor.test.ts tests/input-adapters.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- 수동: 1인 폰·1인 마우스 회귀 한 웨이브씩. 2인 시작은 P04-T05 이후 확인.

## Commit Message
```text
feat(pc): bind phone slots and the mouse to per-player processors

Plan: 2026-11-07-two-player-coop
Phase: P04-pc-input-lobby
Task: T04-per-slot-input

- One PhoneAdapter per slot and one MouseAdapter, each bound to a player processor by the slot map
- getMouseBinding decides which player the mouse drives
- Crosshairs and shot FX follow result.playerIndex

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: completed
