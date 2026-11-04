# Task: T01 Wave Clock and Time Bonus

## Status: todo

## Goal
웨이브마다 게임 시계 기준 경과 시간을 재고, 웨이브를 클리어하는 순간 기준 시간 대비 선형으로 줄어드는 시간 보너스를 점수에 더한다. 마지막 웨이브(승리)도 보너스를 받는다.

## Decision Summary
- D03: 기준 시간 이내면 상한, 기준의 2배까지 선형 감소해 0. 클리어 직후 지급(중간에 져도 이미 받은 보너스는 유지).
- D04: 일반 웨이브(1, 2, 4, 6)는 같은 상한, 보스 웨이브(3, 5, 7)는 `bossWaveWeight`(2)배.
- D03: 시간은 게임 시계 기준이라 카드 선택·일시정지 정지 시간은 `freezeTimers`로 제외된다.
- 튜토리얼·샌드박스에서는 지급하지 않는다.

## Implementation

### I01. 튜닝 값과 타입

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.score.timeBonus`, `GAME_TUNING.waves[i].parTimeSec` — 값 추가; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `WaveDefinition`(`:113` 부근), 웨이브 정의 생성부(`:194` 부근) — `parTimeSec` 전달; modify

#### Details
- **Data & Schema Fields**:
  ```typescript
  score: {
    scale: 0.1,
    precisionBonus: { ... },            // 기존
    timeBonus: {
      maxPerWave: 500,                  // [초안] 일반 웨이브 상한(최종 점수 단위, scale 적용 후)
      bossWaveWeight: 2,                // 보스 웨이브 가중
      zeroAtParMult: 2,                 // 기준 시간의 몇 배에서 0이 되는가
    },
  },
  // waves[i]에 추가. [초안] 스폰 일정(간격 x 스폰 수) + 여유. P03-T01에서 측정값으로 교체
  // 1: 26, 2: 30, 3: 45, 4: 34, 5: 50, 6: 36, 7: 70   (단위: 초)
  parTimeSec: number,
  ```
- 웨이브 정의 인터페이스에 `parTimeSec: number`를 더하고 생성부에서 `w.parTimeSec`를 넘긴다.

### I02. 웨이브 시계와 지급

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `startWave`, `startGame`, `update`, `freezeTimers`, `handleMonsterKilled`, 웨이브 완료 분기(`:1236` 부근) — 시계와 지급; modify

#### Details
- **Signatures & Types**:
  ```typescript
  private waveStartMs = 0;                      // 0 = 아직 시작 전. 웨이브 첫 update 틱에서 nowMs로 설정
  public waveTimeBonusTotal = 0;
  public lastWaveClear: { wave: number; seconds: number; bonus: number; atMs: number } | null = null;

  public computeWaveTimeBonus(wave: number, elapsedSec: number): number;
  private awardWaveTimeBonus(nowMs: number): void;
  ```
- **Execution Flow / Logic**:
  1. `computeWaveTimeBonus`: `par = waveDefs[wave].parTimeSec`, `zero = par * zeroAtParMult`,
     `ratio = clamp((zero - elapsedSec) / (zero - par), 0, 1)`,
     `weight = boss 웨이브 ? bossWaveWeight : 1`,
     반환 `Math.round(maxPerWave * weight * ratio)`.
  2. `startWave`와 `startGame`에서 `waveStartMs = 0`. `update`가 PLAYING 상태에서 `waveStartMs === 0`이면 `nowMs`로 설정한다(카드 선택 중에는 설정하지 않는다).
  3. `freezeTimers`: `if (this.waveStartMs !== 0) this.waveStartMs += deltaMs`.
  4. `awardWaveTimeBonus(nowMs)`: 튜토리얼·샌드박스면 반환. `elapsedSec = (nowMs - waveStartMs) / 1000`, 보너스 계산 후 `scoreManager.addBonusScore(bonus)`, `waveTimeBonusTotal += bonus`, `lastWaveClear = { wave, seconds, bonus, atMs: nowMs }`.
  5. 호출 위치(웨이브당 정확히 한 번):
     - 웨이브 완료 분기에서 `spawnWaveRewardCards(nowMs, true)` 직전.
     - `handleMonsterKilled`의 보스 처치 분기에서 마지막 웨이브라 `declareVictory()`를 부르기 **직전**(승리 처리 후에는 점수가 확정되므로 먼저 지급한다).
  6. 같은 웨이브에서 두 번 지급되지 않게 `lastWaveClear.wave === currentWave`면 건너뛴다. `startGame`에서 `lastWaveClear = null`, `waveTimeBonusTotal = 0`.

### I03. 점수 내역

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `getScoreBreakdown` — 합계 분해; modify

#### Details
- **Signatures & Types**:
  ```typescript
  public getScoreBreakdown(): { total: number; timeBonus: number; precisionBonus: number; base: number };
  ```
- `total = scoreManager.getState().totalScore`, `timeBonus = waveTimeBonusTotal`, `precisionBonus = precisionBonusApplied`, `base = total - timeBonus - precisionBonus`.

### I04. 테스트

- Related Files:
  - `tests/wave-time-bonus.test.ts` :: 새 테스트; new
  - `tests/game-tuning.test.ts` :: 모든 웨이브 `parTimeSec > 0`, `timeBonus` 값 검사; modify

#### Details
- **새 테스트 시나리오**:
  - `computeWaveTimeBonus`: 기준 이내 = 상한, 기준의 1.5배 = 상한의 절반, 2배 이상 = 0, 보스 웨이브는 `bossWaveWeight`배.
  - 웨이브 시계: `update`를 호출한 시점부터 잰다. `freezeTimers`로 시간을 밀면 그만큼 경과 시간에서 빠진다.
  - 웨이브를 클리어하면 정확히 한 번 지급되고 `lastWaveClear`가 채워진다. 같은 웨이브를 두 번 완료 처리해도 중복 지급이 없다.
  - 마지막 웨이브(보스 처치)는 `VICTORY` 전에 지급되어 최종 점수에 포함된다.
  - 튜토리얼·샌드박스에서는 지급하지 않는다. `startGame` 후 합계가 초기화된다.
  - `getScoreBreakdown`의 세 항목 합이 총점과 같다.


## Acceptance Criteria
- [ ] 웨이브를 빨리 끝낼수록 점수가 더해지고, 느리면 0이다.
- [ ] 카드 선택·일시정지 시간은 웨이브 시간에 포함되지 않는다.
- [ ] 마지막 웨이브의 보너스도 최종 점수에 포함된다.
- [ ] 기준 시간과 상한은 `GAME_TUNING` 한 곳에서만 바꾼다.

## Validation
- `npx vitest run tests/wave-time-bonus.test.ts tests/game-tuning.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(score): add per-wave linear time bonus

Plan: 2026-11-05-score-differentiation
Phase: P01-wave-time-bonus
Task: T01-wave-clock-and-time-bonus

- Track wave elapsed time on the game clock
- Pay a bonus that falls linearly from the par time to twice the par time
- Weight boss waves and expose a score breakdown
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit:
