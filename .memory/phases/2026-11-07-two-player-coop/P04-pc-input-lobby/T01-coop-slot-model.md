# Task: T01 슬롯 상태 순수 모델

## Status: pending

## Goal
로비와 게임 화면이 함께 쓰는 슬롯 규칙을 React 밖의 순수 함수 모듈로 만든다: 슬롯별 입력 방식 선택(마우스 최대 1명, D01), 준비 완료 판정(폰=영점 완료, 마우스=닉네임 등록 즉시, D07), 시작 가능 여부와 안내 문구("2P 준비 중"), 슬롯→엔진 플레이어 번호 매핑. 화면 코드가 이 규칙을 직접 계산하지 않게 해서 vitest로 규칙을 고정한다.

## Decision Summary
- 한쪽 슬롯만 참여하면 1인 판(D06). 그 슬롯이 2P여도 엔진 플레이어 0번이고 화면은 1인 모양(D09: 1인은 배지·색 구분 없음).
- 참여(joined)의 정의: 입력을 골랐고, 폰이면 서버 페어링(`CONTROLLER_PAIRED`)됨, 마우스면 서버 등록(`LOCAL_PLAYER_REGISTERED`)됨.

## Implementation

### I01. 모듈

- Related Files:
  - `src/pc/coopSlots.ts` :: 아래 전부; new

#### Details
- **Signatures & Types**:
  ```typescript
  import type { PlayerProfile, PlayerSlot } from '../shared/types';
  import type { PlayerIndex } from './engine/PlayerCombatState';

  export type SlotInput = 'mobile' | 'mouse';

  export interface SlotState {
    slot: PlayerSlot;
    /** 로비에서 고른 입력. null이면 빈 슬롯. */
    input: SlotInput | null;
    /** 서버가 확인한 프로필(폰: CONTROLLER_PAIRED, 마우스: LOCAL_PLAYER_REGISTERED). */
    player?: PlayerProfile;
    /** 폰 전용: ZERO_CALIBRATED 받음. */
    isZeroCalibrated: boolean;
    /** 폰 전용: 소켓 연결 상태(CONTROLLER_DISCONNECTED면 false). 마우스는 항상 true. */
    isConnected: boolean;
    /** 판 도중 30초 유예가 지나 이탈 처리됨(D08, D20). */
    isAway: boolean;
  }

  export type SlotPair = readonly [SlotState, SlotState];

  export function createInitialSlots(): SlotPair; // 둘 다 input null, isConnected true, 나머지 false
  /** 입력 선택. 다른 슬롯이 이미 마우스면 마우스 선택을 거절한다. 같은 입력 재선택은 그대로. 입력을 바꾸면 player/isZeroCalibrated 초기화. */
  export function chooseSlotInput(slots: SlotPair, slot: PlayerSlot, input: SlotInput | null): { slots: SlotPair; rejected?: 'MOUSE_TAKEN' };
  export function updateSlot(slots: SlotPair, slot: PlayerSlot, patch: Partial<Omit<SlotState, 'slot'>>): SlotPair; // 불변 갱신
  export function isSlotJoined(s: SlotState): boolean; // input !== null && !!player
  export function isSlotReady(s: SlotState): boolean; // joined && (mouse || (isZeroCalibrated && isConnected))
  export function getJoinedSlots(slots: SlotPair): SlotState[]; // 슬롯 번호 오름차순

  export interface StartGate {
    canStart: boolean;
    playerCount: 0 | 1 | 2;
    /** 참여했지만 아직 준비 안 된 슬롯. */
    waitingSlots: PlayerSlot[];
    /** 로비에 띄울 안내. 예: "2P 준비 중", "1P·2P 준비 중", "플레이어를 연결하세요". 시작 가능하면 null. */
    message: string | null;
  }
  export function getStartGate(slots: SlotPair): StartGate;

  /** 판 시작 시점에 고정하는 매핑. joined 슬롯 순서대로 0,1. */
  export function buildSlotIndexMap(slots: SlotPair): Partial<Record<PlayerSlot, PlayerIndex>>;
  export function indexToSlot(map: Partial<Record<PlayerSlot, PlayerIndex>>, index: PlayerIndex): PlayerSlot | undefined;
  /** 마우스 슬롯의 엔진 번호. 마우스 참여자가 없으면 null. */
  export function getMouseIndex(slots: SlotPair, map: Partial<Record<PlayerSlot, PlayerIndex>>): PlayerIndex | null;
  ```
- **Execution Flow / Logic** (`getStartGate`):
  1. joined 0명 → `{ canStart: false, playerCount: 0, waitingSlots: [], message: '플레이어를 연결하세요' }`.
  2. joined 중 준비 안 된 슬롯 → `waitingSlots`. 메시지: 1개면 `${n}P 준비 중`, 2개면 `1P·2P 준비 중`.
  3. `canStart = waitingSlots.length === 0`, `playerCount = joined.length`.
  - 한쪽만 joined이고 다른 쪽은 input만 고르고 페어링 전이면(joined 아님) 1인으로 시작 가능(D07 "한쪽만 연결한 경우는 그 한 명만 준비되면 기존처럼 시작").

### I02. 테스트

- Related Files:
  - `tests/coop-slots.test.ts`; new

#### Details
- 1P 마우스 선택 후 2P 마우스 → `rejected: 'MOUSE_TAKEN'`, 2P input null 유지.
- 1P 폰 페어링·영점 완료, 2P 미사용 → `canStart`, `playerCount 1`.
- 1P 마우스 등록, 2P 폰 페어링(영점 전) → `canStart false`, `message '2P 준비 중'`.
- 둘 다 준비 → `playerCount 2`, `buildSlotIndexMap` = `{1:0, 2:1}`.
- 2P만 참여 → map `{2:0}`, `getMouseIndex`는 2P가 마우스면 0.
- 폰 준비 완료 후 `isConnected false` → 다시 준비 안 됨.
- `chooseSlotInput(…, 'mobile' → 'mouse')` 시 `player`·`isZeroCalibrated` 초기화.

## Acceptance Criteria
- [ ] 로비 규칙(D01, D06, D07)이 순수 함수와 테스트로 고정된다.

## Validation
- `npx vitest run tests/coop-slots.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
feat(pc): slot model for the two-player lobby

Plan: 2026-11-07-two-player-coop
Phase: P04-pc-input-lobby
Task: T01-coop-slot-model

- coopSlots.ts: input choice (one mouse at most), readiness, start gate message, slot-to-player map
- A single joined slot starts a normal solo run

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
