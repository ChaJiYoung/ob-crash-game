# Task: T01 Summon Acceleration

## Status: todo

## Goal
보스 조우가 길어질수록 공유 소환 타이머의 간격이 짧아지게 한다. 보스를 살려 두고 부하만 잡아 점수를 쌓는 방식이 오히려 위험해진다.

## Decision Summary
- D02: 보스가 살아 있는 시간이 길어질수록 소환 간격 단축. [초안] 8초에서 최소 4초까지 약 40초에 걸쳐 선형.
- 기존 소환 규칙 유지: 소환 반경 안일 때만, 동시 부하 수 `summonMaxActive`(7) 이하일 때만.

## Implementation

### I01. 튜닝 값

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.boss.summonAccel` — 값 추가; modify

#### Details
- **Data & Schema Fields**:
  ```typescript
  summonAccel: { minIntervalMs: 4000, rampMs: 40000 }, // [초안]
  ```

### I02. 엔진

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `spawnBossEncounter`(`:1387` 부근), `update`의 소환 분기(`:1203` 부근), `freezeTimers`, `startGame`, `startWave` — 간격 계산; modify

#### Details
- **Signatures & Types**:
  ```typescript
  public bossEncounterStartMs = 0;
  public getBossSummonIntervalMs(nowMs: number): number;
  ```
- **Execution Flow / Logic**:
  1. `spawnBossEncounter`에서 `bossEncounterStartMs = nowMs`. `startGame`·`startWave`에서 0으로.
  2. `getBossSummonIntervalMs`: `t = clamp((nowMs - bossEncounterStartMs) / rampMs, 0, 1)`, 반환 `Math.round(summonIntervalMs + (minIntervalMs - summonIntervalMs) * t)`. 조우 전(`bossEncounterStartMs === 0`)이면 기본 간격.
  3. 소환 분기의 조건을 `nowMs - lastBossSummonTimeMs >= GAME_TUNING.boss.summonIntervalMs`에서 `getBossSummonIntervalMs(nowMs)`로 바꾼다.
  4. `freezeTimers`에서 `if (this.bossEncounterStartMs !== 0) this.bossEncounterStartMs += deltaMs`(카드 선택·일시정지 중 간격이 줄어들지 않게).
  5. 다중 보스(냉각기 2대 + 대왕)에서도 타이머는 하나이므로 가속은 조우 전체에 한 번만 적용된다.

### I03. 테스트

- Related Files:
  - `tests/boss-encounters.test.ts` :: 소환 간격 검사; modify
  - `tests/boss-summon-acceleration.test.ts` :: 새 테스트; new

#### Details
- 조우 직후 8초, 20초 경과 시 약 6초, 40초 이상이면 4초(하한)이다.
- `freezeTimers`로 시간을 밀어도 가속이 그만큼 진행되지 않는다.
- 기존 테스트가 `lastBossSummonTimeMs = -8000`으로 가정한 부분은 간격 함수를 쓰도록 맞춘다.


## Acceptance Criteria
- [ ] 조우가 길어질수록 소환 간격이 4초까지 줄어든다.
- [ ] 카드 선택·일시정지 중에는 가속이 진행되지 않는다.
- [ ] 보스 웨이브가 아닐 때와 다음 조우 시작 시 값이 초기화된다.

## Validation
- `npx vitest run tests/boss-summon-acceleration.test.ts tests/boss-encounters.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(boss): shorten the minion summon interval as the fight drags on

Plan: 2026-11-05-score-differentiation
Phase: P02-boss-pressure
Task: T01-summon-acceleration

- Add a summon acceleration ramp from 8s down to 4s over 40s
- Shift the ramp start with the other frozen timers
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit:
