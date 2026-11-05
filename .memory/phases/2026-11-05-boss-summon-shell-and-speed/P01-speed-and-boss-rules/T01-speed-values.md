# Task: T01 속도 값 변경

## Status: done

## Goal
후반 웨이브가 초반보다 느리게 느껴지는 문제를 속도 값으로 해결한다: 웨이브당 증가 8%, 오비 2.2, 병맥주 2.0.

## Decision Summary
- 결정 D01. 필굿 2.6, 카스 라이트 2.4, 한맥 2.0, 보스 0.85, 분열한 작은 병 2.2(고정)는 그대로. 큰 병 2.0 < 작은 병 2.2라 역전은 없다.

## Implementation

### I01. 값과 문구
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.speedPerWave`; modify (0.04 → 0.08, 주석의 설명은 그대로 두되 `7웨이브 +48%` 추가)
  - `src/shared/constants.ts` :: `TARGET_SPECS.obi.speedMps`(1.9 → 2.2), `TARGET_SPECS.bottle.speedMps`(1.5 → 2.0); modify
  - `src/pc/components/GuideModal.tsx` :: `MONSTER_DETAILS` 오비 `speedText`(`'1.9 m/s'` → `'2.2 m/s'`), 병맥주 `speedText`(`'1.5 m/s'` → `'2.0 m/s'`); modify
  - `docs/몬스터_도감_설명서.md` :: 오비 줄 `1.9 m/s` → `2.2 m/s`, 병맥주 줄 `1.5 m/s` → `2.0 m/s`; modify
  - `tests/shared-protocol.test.ts` :: 33행 `TARGET_SPECS.bottle.speedMps).toBe(1.5)` → `2.0`; modify

#### Details
- `grep -rn "1\.9 m/s\|1\.5 m/s\|speedPerWave\|0\.04\|4%" README.md docs src tests`로 남은 문구를 확인한다. README에 웨이브별 속도 증가 설명이 있으면 8%로 고친다.
- `tests/boss-encounters.test.ts`의 `scales normal monster speed by +4% per wave but not boss speed`는 하드코딩이 아니라 `GAME_TUNING.speedPerWave`를 읽는지 확인한다. 4% 고정이면 `GAME_TUNING.speedPerWave`로 바꾼다.
- 건드리지 않는 곳: `monsters.bottle.childSpeedMps`(2.2), 보스 속도, 필굿 돌진 배율.

## Acceptance Criteria
- [ ] 7웨이브 일반 몬스터 속도가 기본 × 1.48이다.
- [ ] 도감·가이드·문서의 오비·병맥주 속도가 새 값과 같다.

## Validation
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
feat(tuning): speed up late waves and the slow monsters

Plan: 2026-11-05-boss-summon-shell-and-speed
Phase: P01-speed-and-boss-rules
Task: T01-speed-values

- speedPerWave 0.04 -> 0.08
- obi 1.9 -> 2.2, bottle 1.5 -> 2.0
- guide and docs follow the new speeds
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
