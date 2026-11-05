# Task: T01 패시브 카드 HUD

## Status: pending

## Goal
전투 중 무기 칸 옆에서 적용 중인 패시브 카드와 누적 수를 볼 수 있다.

## Decision Summary
- 결정 D02. 쌓이는 카드 6종만 표시한다. 없으면 칸을 그리지 않는다.

## Implementation

### I01. 엔진과 스냅샷
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `getPassiveCardStacks`; modify
  - `src/pc/hudSnapshot.ts` :: `HudSnapshot.passiveCards`, `buildHudSnapshot`, `isHudSnapshotEqual`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface PassiveCardStack { kind: RewardCardKind; count: number }
  public getPassiveCardStacks(): PassiveCardStack[];
  ```
- 순서: `damage_up`, `skill_cooldown`, `fever_extend`, `hit_zone_up`(이상 `cardStacks`), `rapid_reload`(`weaponSystem.getRapidReloadStacks()`), `lucky_drop`(`luckyDropStacks`). `count > 0`만 돌려준다.
- 함정: `isHudSnapshotEqual`은 값을 `===`로 비교한다. 새 배열을 그대로 넣으면 100ms마다 달라 HUD가 계속 다시 그려진다. 기존 `activeBuffs`처럼 건너뛰는 키에 `passiveCards`를 넣고, 문자열 `passiveCardsKey`(예: `damage_up:2,lucky_drop:1`)를 함께 두어 이것으로 변화를 잡는다.

### I02. 화면
- Related Files:
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `PassiveCardBar`, 왼쪽 아래 무기 칸; modify
  - `src/pc/PCGamePage.tsx` :: `<ArcadeOverlayHUD passiveCards={hudState.passiveCards}`; modify

#### Details
- 무기 칸을 `display: flex; alignItems: flex-end; gap: 10px` 묶음으로 감싸고 오른쪽에 세로로 놓는다. 각 칸: `REWARD_CARD_SPECS[kind].icon`과 `×{count}`, `title={nameKo}`, 배경 `rgba(17,24,39,0.96)`. `passiveCards`가 비면 렌더링하지 않는다. prop은 선택값으로 기본 `[]`이다.
- 함정: `damage_up`과 다른 카드가 아이콘을 공유할 수 있다(`fever_boost`, `fever_extend` 모두 🔥). 표시 대상 6종은 겹치지 않는지 테스트로 확인한다.
- `pointerEvents`는 HUD와 같게 두어 조준을 막지 않는다.

### I03. 테스트
- Related Files:
  - `tests/passive-card-hud.test.ts`; new
#### Details
- 카드가 없으면 빈 배열, 누적 수 반영, 즉시 효과 카드 제외, 새 게임에서 초기화. 같은 상태의 스냅샷 두 개가 같다고 판단되고 카드를 얻으면 다르다고 판단됨. HUD 렌더링에 아이콘과 `×2`가 나오고 빈 경우 칸이 없음.

## Acceptance Criteria
- [ ] 카드를 고르면 무기 칸 옆 표시가 늘어나고, 조준점과 스킬 표시를 가리지 않는다.
- [ ] 값이 그대로면 HUD가 다시 그려지지 않는다.

## Validation
- `npx vitest run tests/passive-card-hud.test.ts`, `npm test`, `npx tsc --noEmit`, `npm run build` — 통과

## Commit Message
```text
feat(hud): show active passive cards beside the weapon panel

Plan: 2026-11-06-boss-drop-and-passive-cards
Phase: P02-passive-cards
Task: T01-passive-cards-hud

- Expose stacking cards from the engine and keep the HUD snapshot comparison stable
- Draw each card icon with its stack count

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
