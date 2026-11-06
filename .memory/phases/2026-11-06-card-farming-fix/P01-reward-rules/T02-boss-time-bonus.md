# Task: T02 보스 웨이브 시간 보너스 상향

## Status: pending

## Goal
보스 웨이브(3·5·7)의 시간 보너스가 최대 2,800점이 되어, 기준 시간에서 늦어질수록 잃는 점수가 킬 점수 증가 속도(초당 약 50~70점)보다 가파르다.

## Decision Summary
- 결정 D07. `timeBonus.bossWaveWeight` 2 → 4만 바꾼다. `maxPerWave`(700)와 `zeroAtParMult`(1.6)는 그대로다.
- 근거: 2026-11-06 14:08 기록에서 파밍은 킬로 약 6,000~9,000점을 더 벌고 시간 보너스는 1,400점만 잃었다.
- `RANKING_RULESET_VERSION`은 5 유지(상자 기능 마지막 Task에서 6으로 올린다).

## Implementation

### I01. 값
- Related Files:
  - `src/shared/gameTuning.ts` :: `score.timeBonus.bossWaveWeight`(30행 부근); modify

#### Details
- `bossWaveWeight: 2` → `4`. 보스 웨이브 만점은 `maxPerWave × bossWaveWeight = 2,800`이다.
- 엔진은 `computeWaveTimeBonus`가 `def.boss ? cfg.bossWaveWeight : 1`로 이미 읽는다(`BeerCrusherEngine.ts:1877`). 코드 변경은 없다.
- 기울기: 보스 웨이브에서 par에서 par×1.6까지 2,800점이 줄어들므로 초당 `2800 / (0.6 × par)`점이다. 3웨이브 par 34초 → 약 137점/초, 5웨이브 38초 → 약 123, 7웨이브 45초 → 약 104. 이 값이 킬 점수 증가 속도(초당 약 50~70점)보다 커야 한다는 것이 이 Task의 존재 이유다. par가 바뀌어도(P02-T04) 기울기가 100점/초 아래로 떨어지지 않아야 하므로 테스트로 묶는다.

### I02. 문서
- Related Files:
  - `README.md` 41행, `docs/무기_및_스킬_가이드.md` 176행의 "(보스 웨이브는 1,400점)" → "(보스 웨이브는 2,800점)"; modify
  - `src/pc/components/GuideModal.tsx` 343행: `GAME_TUNING.score.timeBonus`를 참조하는지 확인하고, 숫자가 하드코딩이면 참조로 바꾼다; modify(필요 시)

#### Details
- `tests/docs-sync.test.ts`의 `보스 웨이브는 ${fmt(t.maxPerWave * t.bossWaveWeight)}점` 검증이 문서 문구와 맞아야 통과한다(이 테스트는 이미 값에서 계산한다).

### I03. 테스트
- Related Files:
  - `tests/wave-time-bonus.test.ts`; modify (하드코딩 기대값 확인, 새 케이스 추가)
  - `tests/game-tuning.test.ts`; modify

#### Details
- 먼저 `grep -rnE "1400|1,400|bossWaveWeight" src tests README.md docs/*.md`로 하드코딩된 값을 찾는다. `cfg.bossWaveWeight`를 참조하는 기존 테스트는 그대로 통과해야 한다.
- 새 테스트: 3·5·7웨이브에서 `computeWaveTimeBonus(w, par)`(= 만점)와 `computeWaveTimeBonus(w, par + 10)`의 차이가 100점 이상이다(10초 늦으면 최소 1,000점 손실). 값은 `GAME_TUNING.waves[w-1].parTimeSec`에서 가져온다.
- `game-tuning.test.ts`의 `bossWaveWeight >= 1` 검증은 그대로 둔다. 보스 웨이브 만점이 4,000점을 넘지 않는지(점수 규모 폭주 방지)를 추가로 확인해도 된다.

## Acceptance Criteria
- [ ] 보스 웨이브 만점이 2,800점이고 일반 웨이브는 700점이다.
- [ ] 보스 웨이브에서 par보다 10초 늦으면 100점 이상, 즉 1,000점 이상 줄어든다.
- [ ] 문서·가이드가 2,800점으로 안내하고 `RANKING_RULESET_VERSION`은 5다.

## Validation
- `npx vitest run tests/wave-time-bonus.test.ts tests/game-tuning.test.ts tests/docs-sync.test.ts tests/result-breakdown.test.ts tests/score-fever-multiplier.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과

## Commit Message
```text
tune(score): double the boss wave time bonus to 2800

Plan: 2026-11-06-card-farming-fix
Phase: P01-reward-rules
Task: T02-boss-time-bonus

- timeBonus.bossWaveWeight 2 -> 4 so a fast boss kill beats farming kill points
- Pin a steepness check (>= 100 points per second past par) and sync README and guides

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
