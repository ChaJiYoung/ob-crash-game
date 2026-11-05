# Task: T01 드롭률 10%

## Status: done

## Goal
보스 부하의 아이템 드롭이 절반으로 줄어 보스전 체력 회복이 줄어든다.

## Decision Summary
- 결정 D01. 값과 문서만 바꾼다. 규칙 v5 유지.

## Implementation

### I01. 값과 문서
- Related Files:
  - `src/shared/gameTuning.ts` :: `boss.summonDropChance` 0.20 → 0.10; modify
  - `README.md` 59행: "보스 소환 부하 20%" → "보스 소환 부하 10%"; modify
  - `docs/몬스터_도감_설명서.md` 71행: "아이템 드롭률(20%)" → "아이템 드롭률(10%)"; modify
  - `tests/boss-minion-drop.test.ts` :: 값 고정 검사가 있으면 `GAME_TUNING` 참조로; modify

### I02. 측정
- `npx tsx .memory/references/scripts/simulate-current-decisions.ts 100 all "보통(탭)"`와 `"부정확(탭)"` 결과를 `.memory/references/playtest-2026-11-05-skill-guard-ammo.md` 끝에 기록한다. 봇은 아이템을 일부러 노리지 않아 효과가 작게 나올 수 있음을 함께 적는다. 드롭률이 소환 몬스터 처치에만 쓰이는지 테스트로 확인한다: 소환 부하 처치 때 `dropRng`가 0.09면 드롭, 0.11이면 없음. 일반 몬스터는 0.03이면 드롭, 0.05면 없음.

## Acceptance Criteria
- [x] 드롭률이 10%이고 문서가 같다. 일반 몬스터 4%는 그대로다.

## Validation
- `npm test`, `npx tsc --noEmit` — 통과

## Commit Message
```text
tune(boss): halve the item drop chance of summoned minions

Plan: 2026-11-06-boss-drop-and-passive-cards
Phase: P01-boss-drop
Task: T01-drop-chance

- Lower summonDropChance to 0.10 so boss fights heal less
- Record bot results and sync the docs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
