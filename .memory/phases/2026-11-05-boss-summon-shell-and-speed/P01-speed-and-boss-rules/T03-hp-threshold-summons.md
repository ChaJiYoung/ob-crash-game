# Task: T03 보스 체력 상향과 체력 구간 소환

## Status: pending

## Goal
시간 간격 소환을 없애고, 각 보스가 체력 99 / 66 / 33% 아래로 내려갈 때마다 4마리를 소환한다. 보스 체력을 올린다.

## Decision Summary
- 결정 D02, D04, D05, D06. 필드 상한은 없다. 낙하 위치(`minionDrop`)는 그대로. 보스 포탄(3500ms)은 건드리지 않는다.

## Implementation

### I01. 설정
- Related Files:
  - `src/shared/gameTuning.ts`; modify

#### Details
- `boss` 블록에서 삭제: `summonRadiusM`, `summonIntervalMs`, `summonAccel`(주석 포함), `summonMaxActive`, `firstSummonDelayMs`.
- `boss` 블록에 추가/변경:
  ```typescript
  /** 각 보스가 자기 최대 체력 대비 이 비율 아래로 내려갈 때마다 summonCount마리를 소환한다(무기와 상관없이 보스당 같은 횟수). */
  summonHpThresholds: [0.99, 0.66, 0.33],
  summonCount: 4,
  ```
- 웨이브 표의 보스 체력: 3웨이브 `coolerHp: [75]`, 5웨이브 `coolerHp: [70, 70]`, 7웨이브 `coolerHp: [90, 90], kingHp: 200`.
- `summonDropChance`, `minionDrop`, `summonKinds`는 그대로.

### I02. 엔진
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `bossSummonCrossed`(new), `checkBossHpSummons`(new), `update`, `spawnBossEncounter`, `freezeTimers`, `startGame`, `startWave`, `startTutorialMode`, `startSandboxMode`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  /** 보스 id별로 지나간 소환 구간 수. */
  private bossSummonCrossed: Map<string, number> = new Map();

  private checkBossHpSummons(nowMs: number): void {
    const thresholds = GAME_TUNING.boss.summonHpThresholds;
    for (const boss of this.getBossEntities()) {
      let crossed = this.bossSummonCrossed.get(boss.id) ?? 0;
      const ratio = boss.hp / boss.maxHp;
      while (crossed < thresholds.length && ratio <= thresholds[crossed]) {
        crossed += 1;
        this.spawnBossMinionWave(nowMs, GAME_TUNING.boss.summonCount);
      }
      this.bossSummonCrossed.set(boss.id, crossed);
    }
  }
  ```
- `update`의 "Boss encounter: one shared summon timer" 블록 전체를 `if (this.isBossEncounterActive) this.checkBossHpSummons(nowMs);`로 교체한다.
- 삭제: `getBossSummonIntervalMs`, `lastBossSummonTimeMs`(필드·`startGame`/`startWave`의 초기화·`freezeTimers`의 `if (this.lastBossSummonTimeMs !== 0) ...`·`spawnBossEncounter`의 대입), `lastBossSummonHpThreshold`(필드·초기화·대입). `bossEncounterStartMs`는 다른 곳에서 쓰는지 grep한 뒤 안 쓰면 함께 정리한다(쓰면 유지).
- `bossSummonCrossed.clear()`를 `spawnBossEncounter`, `startGame`, `startWave`, `startTutorialMode`, `startSandboxMode`에서 호출한다.
- **함정**: 보스가 한 방에 죽으면 `activeTargets`에서 즉시 빠져 `checkBossHpSummons`가 못 보므로, 마지막 일격이 구간을 건너뛰어도 그 구간 소환은 나오지 않는다(의도된 동작). 한 프레임에 여러 구간을 건너뛰면 구간 수만큼 소환한다. `spawnBossMinionWave`는 소환 몬스터를 `activeTargets`에 넣고 보스 소환 연출(1.8초)을 켠다. 소환 몬스터가 남아 있으면 웨이브 종료를 막는 기존 규칙은 그대로다.

### I03. 테스트
- Related Files:
  - `tests/boss-summon-acceleration.test.ts` — 삭제하고 `tests/boss-hp-summons.test.ts`로 교체; new
  - `tests/boss-encounters.test.ts`, `tests/boss-minion-drop.test.ts`, `tests/game-tuning.test.ts`, `tests/hud-snapshot.test.ts`; modify (시간 소환·보스 체력 값에 의존하는 케이스)

#### Details
- 새 `tests/boss-hp-summons.test.ts`: `finishMiniWave(engine, 3, 1000)`로 3웨이브 보스를 만든 뒤(`boss-encounters.test.ts`의 헬퍼를 복사).
  - 체력 100%에서는 소환이 없다. `boss.hp = boss.maxHp * 0.98`로 두고 `engine.update`하면 소환 몬스터가 4마리 생긴다(`isSummonedMinion` 필터). 이어서 `0.65`로 두면 4마리 더, `0.32`에서 4마리 더, 그 뒤에는 더 안 생긴다(총 12).
  - 한 번에 `0.2`로 건너뛰면 3구간을 한꺼번에 소환한다(12마리).
  - 필드에 소환 몬스터가 10마리 이상 있어도 소환이 막히지 않는다(상한 없음).
  - 5웨이브 냉각기 2대는 각자 체력 구간을 따로 센다(하나만 깎으면 12마리).
  - 7웨이브 대왕도 같은 규칙이다(방패 없음).
  - 다음 웨이브/게임 시작 때 구간 기록이 초기화된다.
  - 시간이 흘러도(`update(1000 + 60_000)`) 체력이 그대로면 소환이 없다.
- 기존 테스트에서 `GAME_TUNING.boss.summonIntervalMs`·`summonAccel`·`summonMaxActive`·`firstSummonDelayMs`를 읽는 곳은 새 규칙으로 교체하거나 지운다. 보스 체력(45/40/50/120)을 하드코딩한 곳은 `GAME_TUNING.waves[...].boss`를 읽도록 바꾼다.
- `tests/docs-sync.test.ts` `FORBIDDEN`에 `{ pattern: /소환 간격은 8초|8초에서 시작|5초까지 짧아/, why: 'boss summons are driven by boss HP now' }` 추가.

## Acceptance Criteria
- [ ] 보스당 체력 99 / 66 / 33% 아래에서 4마리씩 총 12마리가 나온다.
- [ ] 시간 소환 관련 설정·필드·함수가 코드와 테스트에서 사라진다.
- [ ] 보스 체력이 75 / 70×2 / 90×2 / 대왕 200이다.

## Validation
- `grep -rn "summonIntervalMs\|summonAccel\|summonMaxActive\|firstSummonDelayMs\|getBossSummonIntervalMs\|lastBossSummonTimeMs\|summonRadiusM" src tests` — 결과 없음
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- `npx tsx .memory/references/scripts/simulate-current-decisions.ts 30 all 보통` — 끝까지 돌고 클리어율을 기록한다(난이도 상승 예상)

## Commit Message
```text
feat(boss): summon by boss HP instead of a timer and raise boss HP

Plan: 2026-11-05-boss-summon-shell-and-speed
Phase: P01-speed-and-boss-rules
Task: T03-hp-threshold-summons

- each boss summons 4 minions at 99/66/33% HP, no field cap
- remove the timed summon, its acceleration and active cap
- boss HP 75 / 70x2 / 90x2 / king 200
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
