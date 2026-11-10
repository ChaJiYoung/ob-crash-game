# Task: T01 spread-ratio

## Status: done

## Goal
P03 시뮬레이션에서 샷건 클리어율이 28%/10%로 떨어져, 산탄 피해 비율을 올려 회복시킨다(D09).

## Decision Summary
- 비율만 15/25/35/45%로 바꾸고 마릿수·반경은 그대로. 한 발 서열(리볼버 > 샷건)은 최선의 경우 82~94%로 유지.

## Implementation

### I01. 수치와 테스트
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.shotgunSpread.damageRatioByLevel` — modify
  - `tests/shotgun-spread.test.ts`, `tests/guide-cards.test.tsx` — modify (기대값)
#### Details
- `{ 1: 0.10, 2: 0.15, 3: 0.20, 4: 0.25 }` → `{ 1: 0.15, 2: 0.25, 3: 0.35, 4: 0.45 }`. 가이드 문구는 GAME_TUNING에서 자동 계산.

## Acceptance Criteria
- [x] 전체 테스트·tsc 통과
- [x] 시뮬레이션(TUNE)으로 샷건 정확(탭) 58% / 보통(탭) 45% 확인

## Validation
- `npx vitest run`, `npx tsc --noEmit -p .`

## Commit Message
```text
fix(shotgun): 산탄 피해 비율을 15/25/35/45%로 올려 샷건 클리어율 회복
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 아래 커밋
