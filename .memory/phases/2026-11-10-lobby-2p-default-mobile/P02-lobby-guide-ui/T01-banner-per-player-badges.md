# Task: T01 배너 플레이어별 뱃지 (lobbyGuide 구조 재편)

## Status: done

## Goal
상단 배너(`lobby-next-step`)가 1P 줄/2P 줄로 나뉘어 플레이어마다 3단계 뱃지(폰: QR 스캔 › 영점 조정 › 쏴서 시작, 마우스: 닉네임 입력 › 클릭으로 시작)를 보여 주고, 주황 큰 문장(`lobby-next-headline`)과 detail은 사라진다. 1P가 준비 완료이고 2P가 폰 미연결이면 2P 줄 라벨이 "2P (선택)"이 된다.

## Decision Summary
- D04: 단일 단계 줄 → 플레이어별 줄. 입력을 하나도 안 골랐으면 "입력 방식 선택" 단계 한 줄만.
- D07: `LobbyNextAction`에서 `ready`·`headline`·`detail` 제거(죽은 필드). 전체 시작 가능 여부는 `StartGate.canStart`만 본다. 따라서 `getLobbyNextAction`의 `gate` 인자도 필요 없어져 제거한다.
- D06(a): "(선택)" 조건 = 2P 입력이 mobile + player 없음 + 1P가 `isSlotReady`. 이 조건 함수 `isOptionalSlot`은 다음 Task(T02, 2P 카드 글자)에서도 재사용한다.
- 선언(`lobbyGuide`)과 호출부(`LobbyNextStepBanner`, `QRPairingModal`)를 한 Task에 묶는다: 필드를 지우면 호출부가 즉시 컴파일 실패하기 때문.

## Implementation

### I01. `lobbyGuide.ts` 데이터 구조 재편

- Related Files:
  - `src/pc/lobbyGuide.ts` :: `LobbyNextAction`, `LobbySlotRow`(new), `isOptionalSlot`(new), `getLobbyNextAction` — modify
  - `src/pc/coopSlots.ts` :: `SlotState`, `SlotPair`, `isSlotReady` — read-only
  - `src/shared/types.ts` :: `PlayerSlot` — read-only

#### Details
- **Signatures & Types**:
  ```typescript
  import type { PlayerSlot } from '../shared/types';
  import { isSlotReady } from './coopSlots';
  import type { SlotPair, SlotState } from './coopSlots';

  export type LobbyStepId = 'choose' | 'connect' | 'zero' | 'start'; // 기존 유지
  export type LobbyStepState = 'done' | 'active' | 'todo';          // 기존 유지
  export interface LobbyStep { id: LobbyStepId; label: string; state: LobbyStepState } // 기존 유지

  export interface LobbySlotRow {
    slot: PlayerSlot;
    /** "1P" / "2P" / "2P (선택)" */
    label: string;
    /** 1P 준비 완료 + 2P 폰 미연결이면 true */
    optional: boolean;
    steps: LobbyStep[];
  }
  export interface LobbyNextAction {
    /** 입력을 고른 슬롯마다 1줄(번호 순). 아무도 안 골랐으면 1P 줄 1개(choose 단계). */
    rows: LobbySlotRow[];
  }

  /** 2P가 폰 연결 전이고 1P가 이미 준비 완료 -> 2P는 "선택 사항". 1P 슬롯은 항상 false. */
  export function isOptionalSlot(slots: SlotPair, slot: PlayerSlot): boolean;
  export function getLobbyNextAction(slots: SlotPair): LobbyNextAction; // gate 인자 제거
  ```
- **Execution Flow / Logic**:
  1. 기존 `PHONE_STEPS`(connect 'QR 스캔', zero '영점 조정', start '쏴서 시작')·`MOUSE_STEPS`(connect '닉네임 입력', start '클릭으로 시작')·`withStates`는 **그대로 재사용**한다.
  2. `isOptionalSlot(slots, slot)`: `slot === 2 && slots[1].input === 'mobile' && !slots[1].player && isSlotReady(slots[0])`.
  3. 슬롯별 활성 단계 `activeStepOf(s: SlotState): LobbyStepId`:
     - `mobile`: `!s.player` → `'connect'`; `s.player && (!s.isConnected || !s.isZeroCalibrated)` → `'zero'`; 그 외 → `'start'`
     - `mouse`: `!s.player` → `'connect'`; 아니면 `'start'`
  4. `getLobbyNextAction`: `chosen = slots.filter(s => s.input !== null)`. 비었으면 `{ rows: [{ slot: 1, label: '1P', optional: false, steps: [{ id: 'choose', label: '입력 방식 선택', state: 'active' }] }] }`. 아니면 `chosen`(slot 오름차순)마다 `defs = input==='mobile' ? PHONE_STEPS : MOUSE_STEPS`, `steps = withStates(defs, activeStepOf(s))`, `optional = isOptionalSlot(slots, s.slot)`, `label = `${s.slot}P` + (optional ? ' (선택)' : '')`.
  5. `StartGate`·`getStartGate` import와 `ready`/`headline`/`detail` 생성 코드, `labelOf`, `target`, `hasPhone`, `hasMouse` 등 안 쓰게 되는 로컬을 전부 삭제한다(lint/미사용 변수 방지).
  6. **함정**: 폰 연결이 끊긴 슬롯(`player` 있음, `isConnected=false`)은 '영점 조정' 단계가 active다(기존 동작과 동일). 끊김 문구는 이제 배너가 아니라 슬롯 카드 헤더("● 연결 끊김")가 맡는다 — 배너에서 일부러 뺀다.

### I02. 배너 컴포넌트와 모달 호출부

- Related Files:
  - `src/pc/components/LobbyNextStepBanner.tsx` :: `LobbyNextStepBanner` — modify
  - `src/pc/components/QRPairingModal.tsx` :: `getLobbyNextAction(slots, startGate)` 호출(490행) — modify
  - `src/shared/constants.ts` :: `PLAYER_COLORS` — read-only(슬롯 색상 라벨)

#### Details
- `LobbyNextStepBannerProps`는 `{ action: LobbyNextAction }` 유지. 컨테이너 `data-testid="lobby-next-step"`는 유지하되 `flexDirection: 'column'`, `gap: '6px'`, `alignItems: 'stretch'`로 바꿔 줄을 세로로 쌓는다. 기존 padding/배경/테두리 스타일은 유지.
- 각 `row`: `<div data-testid={`lobby-row-${row.slot}`}>` 가로 flex(gap 8px, alignItems center). 맨 앞에 슬롯 라벨 칩 `row.label`(배경 `PLAYER_COLORS[row.slot]`, 흰 글씨, 12px/900, `optional`이면 `opacity: 0.7`), 이어서 `steps` 뱃지를 기존 `STATE_STYLE`·스타일 그대로 렌더하고 사이에 `›`.
- 뱃지 `data-testid`는 `lobby-step-${row.slot}-${step.id}`로 바꾸고 `data-state`는 유지. 뱃지 앞 글머리: `done`이면 `'✓ '`, 아니면 `` `${i + 1}. ` ``(기존과 동일).
- 주황 문장 블록(`lobby-next-headline`, detail `<div>`)을 통째로 삭제한다. `flex: 1, minWidth: 240px` 래퍼도 삭제.
- `QRPairingModal.tsx` 490행을 `<LobbyNextStepBanner action={getLobbyNextAction(slots)} />`로 바꾼다. `startGate` prop은 시작 버튼이 계속 쓰므로 **지우지 않는다**.

### I03. 테스트 갱신

- Related Files:
  - `tests/lobby-next-step.test.ts` — modify(전면 재작성)
  - `tests/lobby-slot-cards.test.tsx` :: `'shows the next-step banner...'`(약 168~185행) — modify

#### Details
- `act = (slots) => getLobbyNextAction(slots)`; `activeId(slots, slot)`로 해당 행의 active 단계 id 확인 헬퍼. `ready`/`headline`/`detail` 단언은 모두 삭제하고 아래로 대체:
  - 둘 다 비어 있음 → `rows.length === 1`, `rows[0].steps` ids `['choose']`
  - 1P mobile, 2P 비어 있음(`createInitialSlots` + 1P 선택) → rows 1개, 1P 'connect' active, 라벨 `'1P'`
  - 1P mobile 접속만 → states `['done','active','todo']`; 영점까지 → `['done','done','active']`
  - 1P mouse 닉네임 대기 → ids `['connect','start']`; 닉네임 입력 후 → states `['done','active']`
  - **기본 로비**(`createLobbySlots('mobile')`) → rows 2개(1P connect active, 2P connect active), 둘 다 `optional === false`(1P가 아직 준비 안 됨)
  - 1P 폰 준비 완료 + 2P 폰 미연결 → 2P 행 `optional === true`, 라벨 `'2P (선택)'`, 1P 행 라벨 `'1P'`
  - 1P 준비 완료 + 2P 폰 접속(영점 전) → 2P 행 'zero' active, `optional === false`, 라벨 `'2P'`
  - 폰 연결 끊김(`isConnected:false`, player 있음) → 'zero' active
  - 혼합: 1P 마우스(준비) + 2P 폰 → 1P 행 ids `['connect','start']`, 2P 행 ids `['connect','zero','start']` (줄마다 입력에 맞는 단계)
  - `isOptionalSlot(slots, 1)`은 항상 false
- `lobby-slot-cards.test.tsx` 배너 테스트: 슬롯을 `createLobbySlots('mobile')`로 만들고 `data-testid="lobby-step-1-connect" data-state="active"`와 `lobby-step-2-connect`를 확인, `lobby-next-headline`이 **없음**을 단언. `'폰으로 QR을 스캔하세요'` 단언은 삭제.

## Acceptance Criteria
- [ ] 배너에 1P/2P 줄이 각각 보이고, 주황 문장(`lobby-next-headline`)은 DOM에 없다
- [ ] 1P 준비 완료 + 2P 폰 미연결일 때만 2P 라벨이 "2P (선택)"
- [ ] `LobbyNextAction`에 `ready`/`headline`/`detail`이 없고 `getLobbyNextAction`이 `gate`를 받지 않는다
- [ ] `tsc` 통과(미사용 import 없음)

## Validation
- `npx vitest run tests/lobby-next-step.test.ts tests/lobby-slot-cards.test.tsx tests/lobby-default-input.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(lobby): 배너를 플레이어별 3단계 뱃지로 바꾸고 주황 문장 제거

Plan: 2026-11-10-lobby-2p-default-mobile
Phase: P02-lobby-guide-ui
Task: T01-banner-per-player-badges

- LobbyNextAction을 rows(슬롯별 단계)로 재편, ready/headline/detail 제거
- isOptionalSlot 추가("2P (선택)" 라벨 조건)
- LobbyNextStepBanner를 1P/2P 줄로 렌더, lobby-next-step 테스트 재작성
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: git log --grep "Task: T01-banner-per-player-badges"
