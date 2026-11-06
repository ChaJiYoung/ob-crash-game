# Task: T01 회복 수단 하향

## Status: done

## Goal
수리 카드가 체력 1을 회복하고, 몬스터 처치 드롭 아이템에서 바 수리가 나오지 않는다.

## Decision Summary
- 결정 D01~D03. 아이템 정의(`ItemBuffKind`, `ITEM_BUFF_SPECS.bar_repair`, 3D 모델, 효과 라벨)는 지우지 않는다. 튜토리얼·샌드박스·테스트가 `forcedItemKind`나 `activateItemBuff('bar_repair')`로 쓴다.

## Implementation

### I01. 값과 드롭 후보
- Related Files:
  - `src/shared/gameTuning.ts` :: `repairCard.healAmount` 2 → 1; 새 키 `itemDropKinds: ['power_shot', 'wide_scope', 'ice_freeze']`(이 파일은 다른 파일을 import하지 않으므로 문자열 리터럴); modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `spawnItemTargetAt`(1052행 부근)의 `itemKinds`를 `GAME_TUNING.itemDropKinds as readonly ItemBuffKind[]`로 교체; modify
  - `src/shared/constants.ts` :: `REWARD_CARD_SPECS.bar_repair`의 `descriptionKo`·`cardSubtitleKo`의 "+2"를 "+1"로; modify
- 함정: `forcedItemKind`가 주어지면 후보와 상관없이 그 종류를 쓰므로 그대로 둔다. `activateItemBuff`의 회복 1은 건드리지 않는다.

### I02. 문서
- `README.md` 50행(카드 체력 +2 → +1), `docs/몬스터_도감_설명서.md` 아이템 표 출현 조건과 4번 항목, `docs/비어 크러셔 요구사항 분석서.md` FR-GIM-04, `docs/비어 크러셔 상세설계서.md` 575행 부근, `docs/튜토리얼_훈련장_가이드.md` 96행, `src/pc/components/GuideModal.tsx`의 `bar_repair` 항목 tip; modify

### I03. 테스트
- `tests/gameplay-polish.test.ts` 168행: 카드 회복 2 → 1(`lives 2 → 3`, 최대 체력 초과 없음)로 수정.
- 새 테스트: `spawnItemTargetAt`을 난수 0~0.99로 여러 번 불러 `bar_repair`가 나오지 않고 나머지 3종이 모두 나오는지, `forcedItemKind: 'bar_repair'`는 여전히 되는지. `tests/docs-sync.test.ts`: README가 `체력 +${healAmount}`를 담는지.

## Acceptance Criteria
- [x] 수리 카드가 체력 1을 회복하고 최대 체력을 넘기지 않는다.
- [x] 드롭 아이템에서 `bar_repair`가 나오지 않고 `forcedItemKind`로는 여전히 만들어진다.
- [x] 문서와 인게임 가이드가 이를 설명한다.

## Validation
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과

## Commit Message
```text
tune(heal): repair card heals 1 and bar repair no longer drops

Plan: 2026-11-06-heal-nerf
Phase: P01-heal-sources
Task: T01-heal-nerf

- repairCard.healAmount 2 -> 1
- Drop item pool is power shot, wide scope and ice freeze (itemDropKinds)
- Sync docs, guide and tests

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
