# Task: T01 소환 점증, 문서, 기준 시간

## Status: done

## Goal
각 보스가 체력 구간마다 4, 5, 6마리를 소환하고, 안내 문구가 이를 그대로 설명한다.

## Decision Summary
- 결정 D01~D03. 값과 문서를 함께 바꿔야 `docs-sync` 테스트가 통과하므로 Task를 나누지 않는다.

## Implementation

### I01. 값과 엔진
- Related Files:
  - `src/shared/gameTuning.ts` :: `boss.summonCount` → `summonCountByStep: [4, 5, 6]`; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `checkBossHpSummons`; modify

#### Details
- 함정: 구간 번호는 `crossed += 1` **전에** 읽어야 첫 소환이 4마리다. 한 프레임에 여러 구간을 건너뛰면 구간별로 각각 소환한다.
  ```typescript
  const count = GAME_TUNING.boss.summonCountByStep[crossed];
  crossed += 1;
  this.spawnBossMinionWave(nowMs, count);
  ```
- 주석의 `summonCount` 표현도 고친다. `summonHpThresholds`와 길이가 같아야 하므로 테스트로 묶는다.

### I02. 문서
- Related Files:
  - `src/pc/components/GuideModal.tsx` 95행: `${summonCountByStep.join('·')}마리씩`; modify
  - `README.md` 56행: `4·5·6마리씩 필드 10~18m`; modify
  - `docs/몬스터_도감_설명서.md` 70행: `부하 4·5·6마리를 필드 10~18m`, 소환 총량 표기가 있으면 보스당 15마리; modify
  - `docs/비어 크러셔 요구사항 분석서.md` 73행: `부하 4·5·6마리를 소환`; modify
  - `docs/비어 크러셔 상세설계서.md` 333행: `한 번에 4·5·6마리를 필드 10~18m`; modify

### I03. 테스트
- Related Files:
  - `tests/boss-hp-summons.test.ts`, `tests/gameplay-polish.test.ts`, `tests/docs-sync.test.ts`; modify
#### Details
- 누적 소환 [4, 9, 15, 15], 보스 2대는 각자 계산, 한 프레임 건너뛰기 합계, 배열 길이가 구간 수와 같음. 규칙 버전이 5인지 확인. `docs-sync`는 `summonCountByStep.join('·')`를 기준으로 한다.

### I04. 기준 시간과 측정
- `npx tsx .memory/references/scripts/measure-wave-times.ts 30`의 "정확" 합산값으로 3·5·7웨이브 `parTimeSec`만 갱신한다. `simulate-current-decisions.ts` 결과를 `.memory/references/playtest-2026-11-05-skill-guard-ammo.md` 끝에 기록한다. 스크린샷은 소환 수가 보이지 않아 다시 찍지 않는다.

## Acceptance Criteria
- [x] 보스당 4, 5, 6마리가 차례로 소환된다.
- [x] 문서에 "4마리씩" 표현이 없고 `RANKING_RULESET_VERSION`은 5다.

## Validation
- `npm test && npx tsc --noEmit && npm run build` — 통과

## Commit Message
```text
tune(boss): escalate summons to 4, 5 and 6 as a boss loses health

Plan: 2026-11-06-boss-summon-escalation
Phase: P01-escalating-summons
Task: T01-escalating-summons

- Replace the flat summon count with summonCountByStep and sync the docs
- Re-measure boss wave par times and keep the ranking ruleset at v5

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
