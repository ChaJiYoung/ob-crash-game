# Task: T04 Boss Patterns and Shield

## Status: pending

## Goal
가운데만 쏴서는 보스를 잡을 수 없게 한다. 보스가 좌우로 움직이고, 뒤로 갈수록 패턴이 추가되며, 부하를 잡아야 대왕 쉴드가 풀린다.

## Decision Summary
- D12:
  - 냉각기 1대: 좌우 이동
  - 냉각기 2대: 교차 이동, 투사체 번갈아 발사
  - 대왕: 쉴드(무적). 부하 6마리 처치 또는 냉각기 처치로 해제. 등장 시와 체력 2/3, 1/3에서 다시 켜짐.
  - 돌진 없음. 소환은 보스전 전체에서 타이머 하나를 공유한다. 8초마다 4마리, 필드의 부하가 7마리 미만일 때.

## Implementation

### I01. 상수

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.boss` — 패턴 수치 추가; modify

#### Details
- **Data & Schema Fields**:
  ```typescript
  // GAME_TUNING.boss에 추가
  summonIntervalMs: 8000,
  summonCount: 4,
  summonMaxActive: 7,
  firstSummonDelayMs: 2500,
  shieldReleaseKills: 6,
  shieldHpThresholds: [2 / 3, 1 / 3],
  movement: {
    singleAmplitudeRad: 0.32, singleSpeed: 0.9,
    crossAmplitudeRad: 0.34, crossSpeed: 0.8,
    kingAmplitudeRad: 0.12, kingSpeed: 0.5,
    withKingOffsetRad: 0.34, withKingWobbleRad: 0.1,
  },
  ```

### I02. 이동

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `updateBossMovement`, `update` — 좌우 이동; modify

#### Details
- **Signatures & Types**:
  ```typescript
  private updateBossMovement(nowMs: number): void;
  ```
- **Execution Flow / Logic**: `update`에서 대상 이동 루프 **앞**에 호출한다. `advanceRadialTarget`이 `thetaRad`로 x, z를 계산하므로 theta만 바꾸면 된다. `t = nowMs / 1000`.
  | 상황 | 대상 | thetaRad |
  | :--- | :--- | :--- |
  | 냉각기 1대 | 냉각기 | `singleAmplitudeRad * sin(t * singleSpeed)` |
  | 냉각기 2대(대왕 없음) | idx 0 / 1 | `±crossAmplitudeRad * sin(t * crossSpeed)` |
  | 대왕 있음 | 냉각기 idx 0 / 1 | `±(withKingOffsetRad + withKingWobbleRad * sin(t * crossSpeed))` |
  | 대왕 있음 | 대왕 | `kingAmplitudeRad * sin(t * kingSpeed)` |
  - 방향 구분을 위해 `bossBaseThetaRad`의 부호를 쓴다(왼쪽 음수, 오른쪽 양수).
  - 냉각기 1대가 남은 2대 전투에서는 남은 냉각기의 패턴을 유지한다.
  - 일시정지와 카드 대기 중에는 `update`가 먼저 끝나므로 움직이지 않는다.

### I03. 공유 소환과 투사체

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `update` 소환 블록, 투사체 블록, `spawnBossEncounter`, `lastBossSummonHpThreshold` — 규칙 변경; modify

#### Details
- **Execution Flow / Logic**:
  1. `spawnBossEncounter`에서 `this.lastBossSummonTimeMs = nowMs - summonIntervalMs + firstSummonDelayMs`로 초기화한다.
  2. `:1032-1054` 소환 블록을 아래로 교체한다. 체력 기준 소환(`hpTrigger`)과 `lastBossSummonHpThreshold`는 지운다. 사용자가 돌진 대신 "중간중간 소환"을 원했고, 쉴드 재활성화가 체력 구간 역할을 대신한다.
     ```typescript
     if (this.isBossEncounterActive) {
       const bosses = this.getBossEntities();
       const inRange = bosses.some((b) => b.radiusM <= GAME_TUNING.boss.summonRadiusM);
       if (inRange && nowMs - this.lastBossSummonTimeMs >= GAME_TUNING.boss.summonIntervalMs) {
         const activeMinions = /* 기존 계산과 동일 */;
         if (activeMinions < GAME_TUNING.boss.summonMaxActive) {
           this.spawnBossMinionWave(nowMs, GAME_TUNING.boss.summonCount);
         }
       }
     }
     ```
     `spawnBossMinionWave`가 `lastBossSummonTimeMs`를 갱신하는 것은 유지한다. 부하가 많아 소환하지 않은 경우에는 다음 프레임에 다시 검사한다.
  3. 보스전 중에는 `spawnedInWave`가 `totalSpawns`에 도달해 일반 스폰이 멈춘다. 보스전 도중 스폰이 다시 시작되지 않는지 테스트한다.
  4. 투사체: 보스 발사 주기 3.5초는 유지하되, 살아 있는 냉각기가 번갈아 쏘게 한다. `spawnMonsterProjectile`의 `origin` 인자는 P04-T02에서 추가됐다. 한맥은 자기 타이머로 쏘므로 여기서 다루지 않는다.
     ```typescript
     private bossShooterIndex = 0; // spawnBossEncounter에서 0으로 초기화
     ```
     - 보스전에서 발사할 때 살아 있는 냉각기 목록을 만들고 `coolers[bossShooterIndex % coolers.length]`의 현재 `thetaRad`, `radiusM`을 넘긴 뒤 `bossShooterIndex`를 1 올린다. 냉각기가 없으면 대왕 위치를 쓴다.

### I04. 대왕 쉴드

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `ActiveTargetEntity`, `EngineShootResult`, `shootAt`, `triggerWeaponSkill`, `handleMonsterKilled`, `updateKingShield` — 쉴드; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // ActiveTargetEntity
  isShielded?: boolean;
  // EngineShootResult.shieldBlocked는 P04-T03에서 추가됨. 그대로 쓴다.
  // 엔진 필드
  private shieldKillCount = 0;
  private shieldThresholdIndex = 0;
  private updateKingShield(): void;
  ```
- **Execution Flow / Logic**:
  1. `spawnBossEncounter`: 대왕에게 `isShielded = true`. `shieldKillCount = 0`, `shieldThresholdIndex = 0`.
  2. `updateKingShield`(매 `update` 호출): 대왕이 있고 쉴드가 꺼져 있고 `hp <= maxHp * shieldHpThresholds[index]`이면 쉴드를 켜고 `index + 1`, `shieldKillCount = 0`.
  3. `handleMonsterKilled`:
     - 냉각기 처치 시 대왕 쉴드 해제
     - 보스전 중 일반 몬스터 처치 시 `shieldKillCount + 1`, `shieldReleaseKills` 이상이면 해제
  4. `shootAt`의 표준 피해 경로 앞:
     ```typescript
     if (target.isShielded) {
       return { fired: true, grade: result.grade, target, hitTargets: [target], killed: false, shieldBlocked: true, weaponKind, weaponLevel };
     }
     ```
     점수와 피버를 주지 않는다. 판정 대상 선택에서는 제외하지 않는다. 쉴드에 막히는 것을 보고 다른 대상을 쏘게 하는 의도다.
  5. `triggerWeaponSkill` 세 분기: `monster.isShielded`이면 피해를 건너뛴다. 슬로우와 스턴은 적용해도 된다.
  6. 리볼버 관통(`rearTargets`)도 쉴드 대상을 제외한다.

### I05. 테스트

- Related Files:
  - `tests/boss-encounters.test.ts` — 패턴 시나리오 추가; modify

#### Details
- 냉각기 1대의 x가 시간에 따라 변하고 z 방향 정지 거리를 유지한다.
- 냉각기 2대는 서로 반대 방향으로 움직인다.
- 소환은 8초 간격이고, 부하가 7마리 이상이면 소환하지 않으며, 보스 2대여도 한 번만 소환한다.
- 냉각기 2대의 투사체가 각 냉각기의 theta에서 번갈아 나오고, 1대만 남으면 그 냉각기에서만 나온다.
- 쉴드 대왕을 정중앙으로 쏘면 체력이 그대로이고 `shieldBlocked === true`, 점수와 피버가 변하지 않는다.
- 부하 6마리 처치 또는 냉각기 처치로 쉴드가 풀리고, 체력 2/3, 1/3 아래에서 다시 켜진다.
- 쉴드 중 스킬로 대왕 체력이 줄지 않는다.
- 카드 대기 중 보스가 움직이지 않는다.

## Acceptance Criteria
- [ ] 첫 보스가 좌우로 움직여 조준을 따라가야 한다.
- [ ] 두 번째 보스전에서 타깃을 바꿔야 한다.
- [ ] 대왕이 쉴드로 막히고, 부하를 잡으면 풀린다.
- [ ] 판이 끝나지 않는 상황이 없다.

## Validation
- `npx vitest run tests/boss-encounters.test.ts tests/gameplay-polish.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(boss): add boss movement, shared summons, and king shield

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P04-waves-and-bosses
Task: T04-boss-patterns-and-shield

- Move coolers side to side and cross paired coolers
- Share one summon timer across the encounter
- Shield the king until minions or coolers are killed
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
