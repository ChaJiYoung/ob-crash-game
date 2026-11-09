# Task: T01 2P 기본 모바일

## Status: done

## Goal
로비가 처음 열릴 때와 판이 끝나 로비로 돌아올 때 모두 2P 슬롯이 `input: 'mobile'`(player 없음)로 미리 선택되어, 2P QR 카드가 바로 보인다. 게이트 로직(`getStartGate`/`isSlotJoined`)은 그대로라 2P가 미연결이어도 1P만으로 시작된다(D02).

## Decision Summary
- D01: 2P 기본값은 항상 mobile. localStorage에 저장하지 않는다(1P만 `lobbyInputMemory`가 기억).
- D02: `isSlotJoined` = `input !== null && !!player`. 입력만 고른 슬롯은 "미참여"라 `playerCount`·`buildSlotIndexMap`·`getJoinedSlots`에 영향이 없다 → 게임 시작 로직은 건드리지 않는다.

## Implementation

### I01. `createLobbySlots` 2P 기본 mobile + 로비 복귀 규칙 헬퍼

- Related Files:
  - `src/pc/coopSlots.ts` :: `createLobbySlots`, `applyLobbyReturnDefaults`(new) — modify
  - `src/pc/PCGamePage.tsx` :: `handleReturnToLobby` (약 1378~1397행) — modify
  - `src/pc/lobbyInputMemory.ts` :: `loadLastInput` — read-only

#### Details
- **Signatures & Types**:
  ```typescript
  // coopSlots.ts
  /** 로비가 열릴 때의 슬롯: 1P는 firstInput으로, 2P는 항상 mobile(미연결)로 미리 선택한다. */
  export function createLobbySlots(firstInput: SlotInput): SlotPair;

  /**
   * 판을 마치고 로비로 돌아올 때 슬롯을 로비 초기 규칙으로 되돌린다.
   * - 마우스 슬롯(1P·2P)은 입력을 비운다(마우스 닉네임은 로비에서 다시 확정).
   * - 1P 입력이 비었으면 firstInput으로 채운다.
   * - 2P 입력이 비었으면 'mobile'로 채운다.
   * 이미 폰으로 연결된 슬롯(mobile + player)은 건드리지 않는다.
   */
  export function applyLobbyReturnDefaults(slots: SlotPair, firstInput: SlotInput): SlotPair;
  ```
- **Execution Flow / Logic**:
  1. `createLobbySlots`: `const s1 = chooseSlotInput(createInitialSlots(), 1, firstInput).slots; return chooseSlotInput(s1, 2, 'mobile').slots;` — 2P를 mobile로 고르는 건 `MOUSE_TAKEN`과 무관(마우스끼리만 충돌)이라 1P가 mouse여도 성공한다.
  2. `applyLobbyReturnDefaults`: `PCGamePage.handleReturnToLobby`의 기존 `setSlots` 콜백 본문을 그대로 옮긴다. 순서가 중요하다: ① 1P가 mouse면 `chooseSlotInput(next,1,null)` ② 2P가 mouse면 `chooseSlotInput(next,2,null)` ③ 1P가 null이면 `chooseSlotInput(next,1,firstInput)` ④ **(신규)** 2P가 null이면 `chooseSlotInput(next,2,'mobile')`. ③이 ④보다 먼저여야 1P가 mouse로 복원될 때 2P가 mobile로 채워져도 충돌이 없다(어느 순서든 충돌은 없지만 기존 순서를 보존).
  3. `PCGamePage.handleReturnToLobby`: `setSlots((prev) => applyLobbyReturnDefaults(prev, loadLastInput()));`로 교체. 그 아래 `if (loadLastInput() === 'mouse' && slotsRef.current[0].input !== 'mobile') sendLookupLocalPlayer(1);`와 `setPhase('PAIRING')` 등은 **그대로** 둔다(StrictMode 이중 호출 방지를 위해 서버 전송은 업데이트 함수 밖).
  4. `PCGamePage.tsx` import 목록(46행 근처)에 `applyLobbyReturnDefaults` 추가. `chooseSlotInput`이 `handleReturnToLobby` 밖에서도 쓰이므로 import는 지우지 않는다.

### I02. 기존 테스트 갱신 + 신규 테스트

- Related Files:
  - `tests/lobby-default-input.test.ts` :: `describe('createLobbySlots')`, `'a mobile 1P lobby shows the QR area...'` — modify
  - `tests/coop-slots.test.ts` — modify(`applyLobbyReturnDefaults` 케이스 추가; 파일 끝에 새 `describe`)

#### Details
- `createLobbySlots` 테스트(약 55~70행): 기대값을 `mobile[1].input` → `'mobile'`, `mouse[1].input` → `'mobile'`로 바꾼다. 이름도 `'preselects 1P and 2P(mobile)'`. `chooseSlotInput(mouse, 2, 'mouse').rejected === 'MOUSE_TAKEN'` 단언은 **그대로 유지**(1P가 mouse면 2P 마우스 거절은 여전히 유효). `isZeroCalibrated`, `player === undefined` 단언 추가.
- `'a mobile 1P lobby shows the QR area and only one empty slot card'`: 이제 빈 카드가 0장이고 QR 영역이 2개다. 이름을 `'a mobile lobby shows two QR areas and no empty slot card'`로 바꾸고 `html.match(/Slot \d QR Code|QR 생성 중/g)`의 길이 2, `html.includes('비어 있음')` false를 단언.
- 신규(`applyLobbyReturnDefaults`):
  - mouse 1P(player 있음) + mouse 아닌 2P(mobile+player) → 1P는 `firstInput`('mobile'로 호출) 으로, 2P의 mobile·player·`isZeroCalibrated`는 유지.
  - 2P가 null이면 mobile로 채워진다.
  - 2P가 mouse였다면 null을 거쳐 mobile로 채워진다.
  - `firstInput='mouse'`일 때 1P=mouse, 2P=mobile.

## Acceptance Criteria
- [ ] `createLobbySlots('mobile'|'mouse')` 모두 `slots[1].input === 'mobile'`, `slots[1].player === undefined`
- [ ] 로비 복귀 후에도 2P가 비어 있지 않고 mobile이다(연결된 2P 폰은 그대로 유지)
- [ ] 1P만 준비된 상태에서 `getStartGate(createLobbySlots(...) + 1P ready).canStart === true`(회귀 방지: 기존 `coop-start-flow` 통과)
- [ ] `tsc` 통과

## Validation
- `npx vitest run tests/lobby-default-input.test.ts tests/coop-slots.test.ts tests/coop-start-flow.test.ts tests/lobby-slot-cards.test.tsx` — 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(lobby): 2P 슬롯을 모바일로 미리 선택 (로비 진입·복귀 공통)

Plan: 2026-11-10-lobby-2p-default-mobile
Phase: P01-default-slots
Task: T01-default-2p-mobile

- createLobbySlots가 2P를 항상 mobile(미연결)로 선택
- applyLobbyReturnDefaults 추가, handleReturnToLobby가 사용
- lobby-default-input·coop-slots 테스트 갱신/추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: git log --grep "Task: T01-default-2p-mobile"
