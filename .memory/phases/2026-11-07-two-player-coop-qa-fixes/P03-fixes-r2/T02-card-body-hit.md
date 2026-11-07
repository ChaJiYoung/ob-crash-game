# Task: T02 선택 표적은 카드 몸체를 맞혀야 선택

## Status: done

## Goal
무기·보상 카드 선택에서 "카드를 실제로 맞힌 경우에만" 그 카드가 골라지게 한다. 지금은 2인 판에서 1P가 2P 카드를 쏘면, 1P 카드 중 가장 가까운 것이 판정 반지름 안에 들어와 1P 카드가 골라진다(B BUG-5). D13 "자기 소유 표적만 맞힐 수 있다"는 "남의 카드를 쏘면 아무 일도 없다"는 뜻이어야 한다.

## Decision Summary
- 원인(계산 확인): 선택 표적도 몬스터와 같은 판정(`findBestTarget`)을 쓰는데, 판정 반지름이 `apparentHitRadius × 무기 허용 배율(샷건 1.40, 개틀링 1.05 …)`이다. 2인 배치(깊이 7.7m, `hitRadiusM 1.0`)에서 반지름이 조준 좌표로 약 0.67(가로 보정 후 약 0.37)이고 샷건이면 1.4배라, 2P 카드 쪽(+0.2)을 쏴도 1P의 가장 안쪽 카드(−0.18 부근)가 맞은 것으로 처리된다.
- 고침: **선택 표적의 판정 반지름을 카드 실제 크기에서 계산하고 무기 허용 배율·판정 강화 카드·와이드 스코프를 적용하지 않는다.** 카드는 무기 성능과 무관한 메뉴라서 1인·2인 모두 같은 규칙(D24). 1인에서도 카드 몸체 밖을 쏘면 선택되지 않는다(지금은 화면 대부분이 가장 가까운 카드로 판정됨 — 의도된 변화로 기록).
- 카드 크기: 몸체 1.8m × 2.4m(`TargetModels3D` `card-frame-geo`) × `modelScaleMult`. 원형 판정이므로 반폭 0.9m를 반지름으로 쓴다(세로 여유는 `customBaseY`·카드 중심 기준).

## Implementation

### I01. 판정

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `findBestTarget`, `computeTargetAimCoords`(선택 표적 분기), `shootCardSelect`; modify
  - `src/shared/gameTuning.ts` :: `selectTargetHitHalfWidthM`(0.9); modify

#### Details
- `computeTargetAimCoords(target, …)`: 선택 표적이면 `baseHitRadius`에 `hitRadiusM` 대신 `GAME_TUNING.selectTargetHitHalfWidthM * (target.modelScaleMult ?? 1)`를 쓰고, `zoneScale`(판정 축소·강화 카드)과 `wideScopeMult`를 1로 둔다.
- `findBestTarget`: 선택 표적이면 `weaponHitToleranceMult = 1`, 세로 배율도 1(카드는 세로로 길어 세로 압축 불필요).
- 이 분기는 "표적 종류가 카드"라는 데이터 규칙이고 인원수·모드 분기가 아니다.
- `rules.selectLayout.hitRadiusM`와 `GAME_TUNING.selectLayout`의 `hitRadiusM`는 쓰이지 않게 되므로 삭제한다(테스트·문서에서 참조하던 곳 함께 정리).

### I02. 테스트

- Related Files:
  - `tests/hit-and-select-round.test.ts`, `tests/select-round-players.test.ts`; modify

#### Details
- 2인 판, 샷건 1P: 2P 가장 안쪽 카드 중심 좌표를 1P가 쏘면 `fired: false`, `done` 변화 없음. 1P 가장 안쪽 카드 중심을 쏘면 그 카드가 선택.
- 1인 판: 카드 중심 → 선택, 카드 반폭의 1.2배 바깥 → `fired: false`.
- 무기를 샷건·리볼버·개틀링으로 바꿔도 같은 카드 판정 반지름.

## Acceptance Criteria
- [ ] 남의 카드를 쏘면 아무 일도 없다(2인).
- [ ] 카드 판정이 무기 종류와 무관하다.

## Validation
- `npx vitest run tests/hit-and-select-round.test.ts tests/select-round-players.test.ts tests/card-select-gate.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
fix(engine): select targets are picked only by hitting the card body

Plan: 2026-11-07-two-player-coop-qa-fixes
Phase: P03-fixes-r2
Task: T02-card-body-hit

- Card hit radius comes from the card size, without weapon tolerance, hit-zone cards or wide scope
- Shooting the other player's card no longer selects your nearest card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: (이 Task 커밋, Task: T02-card-body-hit)
