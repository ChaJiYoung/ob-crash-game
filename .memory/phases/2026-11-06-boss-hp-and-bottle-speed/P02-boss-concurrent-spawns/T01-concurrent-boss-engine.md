# Task: T01 보스전 일반 몬스터 병행 (엔진)

## Status: done

## Goal
보스 웨이브(3·5·7)에서 일반 몬스터를 `totalSpawns`의 50%(올림) 소환하면 보스가 등장하고, 보스가 하나라도 살아 있는 동안에는 `totalSpawns`를 넘겨서도 `spawnIntervalMs`마다 일반 몬스터를 보충한다. 마지막 보스를 잡으면 기존 처치 연출이 남은 몬스터를 정리하고 웨이브가 끝난다.

## Decision Summary
- 결정 D03, D04. 보스 체력이 늘어도 필드에 계속 맞힐 몬스터가 있게 하는 것이 목적이다.
- 일반 몬스터 수는 보스·소환 부하·투사체를 빼고 센다. 지금은 `activeTargets.length`를 그대로 써서 보스와 부하가 자리를 차지하면 보충이 막힌다.
- 보스 웨이브의 종료 판정은 `bossSpawned && 보스 없음`이다. 일반 웨이브의 `totalSpawns` 소진 조건은 쓰지 않는다.

## Implementation

### I01. 튜닝 키 추가
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.boss`; modify

#### Details
- `boss` 객체에 키 하나를 추가한다(`warningMs` 위나 `summonDropChance` 근처, 한국어 주석 포함).
  ```typescript
  /** 일반 몬스터를 totalSpawns의 이 비율(올림)만큼 소환하면 보스가 등장한다. 보스가 살아 있는 동안 일반 몬스터는 계속 보충된다. */
  encounterStartRatio: 0.5,
  ```
- 결과 임계값: 3웨이브 `ceil(15×0.5)=8`, 5웨이브 `ceil(20×0.5)=10`, 7웨이브 `ceil(25×0.5)=13`.

### I02. 엔진 스폰·보스 등장·종료 조건
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `update`(1365~1415행 부근), `spawnBossEncounter`, 새 private `countFieldMonsters`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  /** 필드의 일반 몬스터 수. 보스·소환 부하·투사체·아이템·황금캔·카드는 세지 않는다. */
  private countFieldMonsters(): number {
    return this.activeTargets.filter(
      (t) =>
        !t.isItem && !t.isProjectile && !t.isGoldenCan &&
        !t.weaponSelectKind && !t.rewardCardKind &&
        t.kind !== 'boss' && !t.isSummonedMinion
    ).length;
  }
  ```
- **Execution Flow / Logic** (`update()` 안, "2. Periodic enemy spawn" 구간):
  1. `canSpawn` 계산을 바꾼다.
     - 필드 개수: `const fieldCount = this.isBossEncounterActive ? this.countFieldMonsters() : this.activeTargets.length;` (보스전이 아닐 때는 기존 동작을 그대로 둔다. 1·2·4·6웨이브와 보스 등장 전은 변하면 안 된다.)
     - 조건: `fieldCount < waveDef.maxSimultaneous && (this.spawnedInWave < waveDef.totalSpawns || this.isBossEncounterActive) && (this.spawnedInWave === 0 || nowMs - this.lastSpawnTimeMs >= waveDef.spawnIntervalMs)`
  2. 스폰 블록 바로 뒤, 보스 투사체 블록 앞에서 보스를 등장시킨다.
     ```typescript
     if (waveDef.boss && !this.bossSpawned &&
         this.spawnedInWave >= Math.ceil(waveDef.totalSpawns * GAME_TUNING.boss.encounterStartRatio)) {
       this.spawnBossEncounter(nowMs);
     }
     ```
     `spawnBossEncounter`가 `bossSpawned`, `isBossEncounterActive`, 경고 띠, 보스 엔티티, `lastSpawnTimeMs = nowMs`를 처리하므로 그대로 쓴다(다음 일반 몬스터는 한 간격 뒤에 나온다. 의도된 동작).
  3. 보스 투사체 조건 `this.activeTargets.length < waveDef.maxSimultaneous + 2`를 `this.countFieldMonsters() < waveDef.maxSimultaneous + 2`로 바꾼다. 안 바꾸면 보충된 몬스터와 부하가 합쳐 필드가 가득 차서 보스가 포탄을 쏘지 못한다.
  4. 웨이브 종료 블록(1405행 부근):
     - `miniWaveDone`의 `waveDef.boss && !this.bossSpawned` 분기와 `spawnBossEncounter` 호출·`return`을 삭제한다. 보스 등장은 2번 단계가 담당한다.
     - 종료 조건을 보스 웨이브와 일반 웨이브로 나눈다. **중간 보스(3·5웨이브)가 처치 연출을 마친 뒤 카드를 주고 다음 웨이브로 넘기는 일은 이 블록이 한다**(`advanceBossClear`는 `activeTargets = []`로 비우고 끝나며, 다음 `update`가 이 블록에서 카드를 준다). 이 블록을 막으면 중간 보스를 잡아도 카드와 웨이브 진행이 멈춘다.
       ```typescript
       const miniWaveDone = waveDef.boss
         ? this.bossSpawned && !bossAlive // 보스가 죽고 처치 연출이 필드를 비웠다. 남은 소환 수와 무관하다.
         : this.spawnedInWave >= waveDef.totalSpawns && monsterTargets.length === 0;
       ```
       보스 웨이브는 `spawnedInWave >= totalSpawns`를 요구하면 안 된다. 보스가 50% 시점에 등장해 일찍 죽으면 소환 수가 `totalSpawns`에 못 미쳐 웨이브가 영원히 끝나지 않는다. 보스 처치 후(`isBossEncounterActive === false`)에는 보충 스폰 조건도 거짓이므로 새 몬스터가 나오지 않는다.
     - 7웨이브는 `advanceBossClear`가 `declareVictory()`를 부르고 `gamePhase`가 `VICTORY`가 되어 `update` 앞부분에서 반환하므로 이 블록에 오지 않는다.
  5. `getWaveProgress`·`killedInWave`는 건드리지 않는다(`Math.min(killedInWave, totalSpawns)`로 이미 100% 상한이다). 보충 몬스터를 잡아 `killedInWave`가 `totalSpawns`를 넘어도 안전하다.
- **함정들**:
  - `isBossEncounterActive`는 `startBossClearSequence`에서 `false`로 바뀐다. 처치 연출 중에는 `update`가 일찍 반환하므로(`bossClearUntilMs > 0`) 보충 스폰이 일어나지 않는다. 이 순서를 바꾸지 않는다.
  - 테스트 헬퍼(`finishMiniWave`)는 `spawnedInWave = totalSpawns`로 두고 필드를 비운 뒤 `update`를 한 번 부른다. 새 로직에서도 같은 프레임에 보스가 등장해야 한다(`spawnedInWave >= ceil(...)`이므로 만족). 그때 `canSpawn`은 `isBossEncounterActive`가 아직 `false`라 거짓이어야 한다. 즉 보스 등장 판정은 스폰 블록 **뒤**에 둔다.
  - 보충 몬스터가 보스 웨이브에서 `spawnedInWave`를 계속 올리므로 `remainingSpawns` 계산(카드 선택 후 웨이브 진행, 1771행 부근)은 0으로 고정된다. 보스 웨이브의 중간 카드는 T02에서 추가되며, 그 상호작용은 T02 I02에서 확인한다. 이 Task에서는 중간 카드가 없는 상태(`cardKillTarget: null`)로 검증한다.
  - 중간 보스 처치 후 흐름은 "마지막 보스 처치 → `startBossClearSequence`(1.5초 연출, 남은 몬스터 연쇄 폭발) → `advanceBossClear`가 필드를 비움 → 다음 `update`의 `miniWaveDone` → `awardWaveTimeBonus` + `spawnWaveRewardCards(nowMs, true)`"이다. 이 경로가 살아 있는지 테스트 5번이 고정한다.
  - 보스 처치 연출이 남은 일반 몬스터를 연쇄로 터뜨리므로 보충 몬스터가 남아 있어도 웨이브는 정상 종료된다. 처치 연출 중 `killedInWave`가 오른다. 이 값은 상한이 있어 문제없다.
  - 튜토리얼·샌드박스는 `update` 앞부분에서 이미 반환한다. 영향 없음.
  - (구현 중 추가) 보스가 죽은 뒤 `isBossEncounterActive`가 `false`가 되면 `spawnedInWave < totalSpawns`가 다시 참이 되어 연출이 끝난 프레임에 일반 몬스터가 한 마리 더 나올 수 있다. `bossDefeated = waveDef.boss && bossSpawned && !isBossEncounterActive`일 때 `canSpawn`을 막는다.
  - (구현 중 추가) 테스트가 `isBossEncounterActive`만 직접 켜면 `bossSpawned`가 거짓이라 보스가 한 대 더 나온다(`skill-blade.test.ts`는 `bossSpawned = true`도 같이 설정). 70초 동안 보스만 남기는 `boss-encounters` 포탄 테스트는 보충 몬스터가 방어선에 닿아 게임이 끝나므로 보스 외 타깃을 비운다.

### I03. 테스트
- Related Files:
  - `tests/boss-concurrent-spawns.test.ts` :: 새 파일; new
  - `tests/boss-encounters.test.ts`, `tests/boss-clear-sequence.test.ts`, `tests/boss-hp-summons.test.ts`, `tests/boss-minion-drop.test.ts`, `tests/boss-drop-chance.test.ts`, `tests/wave-time-bonus.test.ts`, `tests/engine-judgment-and-spawn.test.ts`; 실패하는 경우에만 modify

#### Details
- 새 파일 케이스 (`startWave(n)` → `startGame({ withWeaponSelect: false })` 후 시계는 직접 넘긴다. 기존 `tests/boss-hp-summons.test.ts`의 `step()` 패턴을 따른다):
  1. 3웨이브에서 `spawnedInWave = 7`이면 보스가 없고, 8이 되면 보스가 1대 등장한다. 5웨이브 10, 7웨이브 13도 같은 방식으로 확인한다.
  2. 보스가 살아 있고 일반 몬스터가 0일 때 `spawnIntervalMs` 이상 시계를 넘기고 `update`하면 일반 몬스터가 늘고 `spawnedInWave`가 `totalSpawns`를 넘어선다.
  3. 보스 + 부하 4마리가 있어도 일반 몬스터는 `maxSimultaneous`까지 채워진다(`countFieldMonsters` 결과가 `maxSimultaneous`를 넘지 않는다).
  4. 보스 웨이브가 아닌 4웨이브는 `totalSpawns`를 넘어 스폰하지 않는다.
  5. 마지막 보스를 잡으면 `isBossClearSequence()`가 참이 되고, 연출이 끝난 뒤 3·5웨이브는 `isRewardCardPending`이 참이 되어 카드가 나오고(카드를 고르면 다음 웨이브로 진행), 7웨이브는 `VICTORY`가 된다. 일반 몬스터가 남아 있어도, 소환 수가 `totalSpawns`에 못 미쳐도(보스를 일찍 잡은 경우) 막히지 않는다. 연출 중과 연출 뒤에는 일반 몬스터가 새로 스폰되지 않는다.
  6. 보스·부하·일반 몬스터가 필드를 채운 상태에서도 3.5초 간격으로 보스 투사체가 나온다(`isProjectile` 타깃 생성).
  7. `spawnedInWave = totalSpawns`로 두고 필드를 비운 뒤 한 번 `update`하면 같은 프레임에 보스가 등장한다(기존 헬퍼 호환).
- 기존 테스트가 실패하면 보스 등장 시점이 "모두 처치 후"가 아니라 "50% 소환 시점"으로 바뀐 것이 원인인지 확인하고, 의도된 변경일 때만 기대값을 고친다. 원인이 다르면 구현을 고친다.

## Acceptance Criteria
- [x] 3·5·7웨이브에서 보스가 각각 8·10·13번째 소환 시점에 등장한다.
- [x] 보스가 살아 있는 동안 `totalSpawns`를 넘어 일반 몬스터가 보충되고, `maxSimultaneous`는 일반 몬스터 기준으로만 센다.
- [x] 마지막 보스 처치 후 3·5웨이브는 카드가 나오고 다음 웨이브로 넘어가며 7웨이브는 승리한다. 연출 중과 이후에는 새 스폰이 없다.
- [x] 보스 투사체가 필드가 붐비는 상황에서도 계속 발사된다.
- [x] 비보스 웨이브의 스폰 동작은 이전과 같다.

## Validation
- `npx vitest run tests/boss-concurrent-spawns.test.ts tests/boss-encounters.test.ts tests/boss-clear-sequence.test.ts tests/boss-hp-summons.test.ts tests/boss-minion-drop.test.ts tests/boss-drop-chance.test.ts tests/wave-time-bonus.test.ts tests/engine-judgment-and-spawn.test.ts` — 모두 통과
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
feat(boss): fight regular monsters alongside the boss

Plan: 2026-11-06-boss-hp-and-bottle-speed
Phase: P02-boss-concurrent-spawns
Task: T01-concurrent-boss-engine

- Boss appears once half of the wave's spawns are out (boss.encounterStartRatio)
- Keep refilling regular monsters while a boss is alive, capped by regular monsters only
- Boss waves end through the boss clear sequence; shell fire ignores boss and minions in the crowd check

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
