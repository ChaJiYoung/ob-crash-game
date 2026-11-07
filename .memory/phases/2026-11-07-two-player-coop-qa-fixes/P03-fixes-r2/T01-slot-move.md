# Task: T01 같은 기기가 다른 슬롯으로 붙으면 이전 슬롯 비우기

## Status: done

## Goal
같은 폰이 다른 슬롯 QR로 다시 붙으면 PC 로비에서 이전 슬롯이 비워지고 새 슬롯에만 남게 한다. 지금은 두 슬롯에 같은 폰이 남고 "연결 끊김"이 표시되며, 마우스 버튼이 양쪽 모두 비활성이 되어 마우스 플레이어가 들어갈 수 없다(B BUG-1, `two-player-coop-qa-r2/B-mouse-phone/V-diag2-after-moves.png`, `scripts/diag-slot-move2.mjs`).

## Decision Summary
- 서버는 이미 이전 슬롯을 비우고 PC에 `ERROR CONTROLLER_DISCONNECTED slot: 이전슬롯`을 보낸다(P03-T01 서버). PC는 이를 일반 끊김으로 받아 이전 슬롯에 플레이어를 남겨 둔 채 `isConnected: false`만 바꾼다.
- 고치는 곳은 PC 슬롯 상태 하나: **`CONTROLLER_PAIRED(slot, player)`를 받으면, 다른 슬롯에 같은 `deviceId`의 플레이어가 있으면 그 슬롯을 비운다**(`input: null`, `player` 없음). 서버 프로토콜은 바꾸지 않는다.

## Implementation

### I01. 순수 함수

- Related Files:
  - `src/pc/coopSlots.ts` :: `applyControllerPaired`(new); modify

#### Details
```typescript
/** CONTROLLER_PAIRED 반영: 그 슬롯을 모바일·연결됨으로, 다른 슬롯에 같은 기기가 있으면 비운다. */
export function applyControllerPaired(slots: SlotPair, slot: PlayerSlot, player: PlayerProfile): SlotPair;
```
1. `other = slot === 1 ? 2 : 1`. `slots[other-1].player?.deviceId === player.deviceId`면 `chooseSlotInput(slots, other, null).slots`로 비운다.
2. 그다음 지금 `PCGamePage` 로직 그대로: `updateSlot(chooseSlotInput(s, slot, 'mobile').slots, slot, { player, isConnected: true })`.

### I02. 페이지

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `case 'CONTROLLER_PAIRED'`(526행 부근); modify

#### Details
- `setSlots((prev) => applyControllerPaired(prev, msg.slot, msg.player))`.
- 판 중(PLAYING)에 같은 기기가 슬롯을 옮기는 경우는 로비가 아니므로 비우지 않는다(슬롯→플레이어 매핑이 고정). `gamePhaseRef.current`가 `PAIRING`/`ZEROING`일 때만 다른 슬롯을 비우고, 판 중이면 지금 동작 유지.

### I03. 테스트

- Related Files:
  - `tests/coop-slots.test.ts`; modify

#### Details
- 기기 X가 2P 페어링 → 1P 페어링: 1P에 X, 2P 비어 있음(input null). 다시 2P 페어링: 2P에 X, 1P 비어 있음.
- 다른 기기 Y가 1P, X가 2P → X가 2P 재페어링: 1P의 Y 유지.

## Acceptance Criteria
- [ ] B의 진단 순서(2P→1P→2P)에서 한 슬롯에만 남고, 빈 슬롯의 마우스 버튼이 활성.

## Validation
- `npx vitest run tests/coop-slots.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과

## Commit Message
```text
fix(lobby): a phone that moves to another slot leaves its old slot

Plan: 2026-11-07-two-player-coop-qa-fixes
Phase: P03-fixes-r2
Task: T01-slot-move

- applyControllerPaired clears the other slot when it holds the same device (lobby only)
- The mouse can join the freed slot again

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 1e17f64
