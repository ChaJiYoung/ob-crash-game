# Task: T03 EX 보스 난입

## Status: done

## Goal
EX 시작 후 게임 시계 60초마다 보스가 1대씩 러시 속에 난입한다(소형 → 대형 → 소형 …). 러시는 멈추지 않고, 못 잡은 보스는 필드에 남아 누적된다. 보스를 잡아도 클리어 연출·필드 정리·목숨 회복은 없고 처치 점수만 얻는다. 보스는 본편처럼 포탄을 쏘지만 졸개 소환은 하지 않는다.

## Decision Summary
- 결정 D08: 60초 간격, 1대씩 번갈아, HP = 기준(소형 150, 대형 250) × 1.10^(n-1) × `rules.bossHpMult`(2인 ×2), 소환 없음, 보상은 점수만.
- 일반 몬스터의 DANGER HP 배율은 보스에 쓰지 않는다(첫 보스가 GREAT 186발이 되어 잡을 수 없음).

## Implementation

### I01. 튜닝 상수

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.exRush.boss` — EX 보스 계수; modify(T02에서 만든 `exRush` 안에 추가)

#### Details
- **Data & Schema Fields**:
  ```ts
  boss: {
    /** EX 게임 시계 기준 난입 간격. */
    intervalMs: 60000,
    /** n번째(1부터) 난입: 홀수 = 소형(cooler), 짝수 = 대형(king). */
    coolerHp: 150,
    kingHp: 250,
    /** 난입할 때마다 HP ×(1 + 0.1). n번째 = 기준 × hpGrowth^(n-1). */
    hpGrowth: 1.1,
  },
  ```

### I02. 헬퍼

- Related Files:
  - `src/pc/engine/exRush.ts` :: `getExBossSpec`, `getExBossDueCount` — 보스 순서·HP 계산; modify

#### Details
- **Signatures & Types**:
  ```ts
  /** 지금까지 나왔어야 할 보스 수 = floor(elapsedMs / intervalMs). 0~59999ms는 0. */
  export function getExBossDueCount(elapsedMs: number): number;
  /** n(1부터) → 역할과 기본 HP(인원 배율 전). Number(x.toFixed(3)). */
  export function getExBossSpec(n: number): { role: 'cooler' | 'king'; hp: number };
  // n=1 → { cooler, 150 }, n=2 → { king, 275 }, n=3 → { cooler, 181.5 }, n=4 → { king, 332.75 }
  ```

### I03. 엔진: 보스 생성 공용화·난입·처치·포탄

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `spawnBossEncounter`, `makeBossEntity`(new), `spawnExBoss`(new), `updateExRush`, `updateBossShells`(new), `update`, `handleMonsterKilled`, `startGame`/`enterExRush`; modify

#### Details
- **makeBossEntity 추출**: `spawnBossEncounter` 안의 지역 함수 `make(role, hp, theta, hitRadiusM)`를 private 메서드로 옮긴다. king이면 `modelScaleMult = GAME_TUNING.boss.kingScale`, `customBaseY = getTargetBaseY('boss', false) * kingScale`, `hitRadiusM = spec.hitRadiusM * kingScale`까지 이 메서드 안에서 처리하도록 정리한다(기존 spawnBossEncounter의 king 후처리를 옮김). 시그니처:
  ```ts
  private makeBossEntity(role: 'cooler' | 'king', hp: number, theta: number): ActiveTargetEntity
  ```
  `spawnBossEncounter`는 이 메서드를 쓰도록 바꾸고 동작은 동일해야 한다(기존 boss-* 테스트로 확인).
- **새 필드**: `private exBossCount = 0;` — `startGame`과 `enterExRush`에서 0으로 초기화.
- **spawnExBoss(nowMs)**:
  1. `this.exBossCount += 1; const { role, hp } = getExBossSpec(this.exBossCount);`
  2. `const scaledHp = Number((hp * this.rules.bossHpMult).toFixed(3));`
  3. 위치(theta): 후보 `[0, -s, s, -2s, 2s]`(s = `GAME_TUNING.boss.coolerSpreadRad`) 중, 현재 살아 있는 보스들의 `bossBaseThetaRad`와 모두 `s / 2` 이상 떨어진 첫 값. 없으면 0.
  4. `this.activeTargets.push(this.makeBossEntity(role, scaledHp, theta))`
  5. `this.bossWarningUntilMs = nowMs + GAME_TUNING.boss.warningMs;`(기존 WARNING 밴드·경고음이 hudSnapshot의 `isBossWarning`으로 그대로 뜬다)
  6. `this.bossEncounterStartMs = nowMs; this.lastBossProjectileMs = nowMs; this.bossShooterIndex = 0;`
  7. `isBossEncounterActive`는 **false로 둔다**(true면 `checkBossHpSummons`가 졸개를 소환하고 본편 스폰 규칙이 바뀐다).
- **updateExRush()** 끝에 추가:
  ```ts
  while (this.exBossCount < getExBossDueCount(this.exElapsedMs)) this.spawnExBoss(nowMs);
  this.updateBossShells(nowMs, null);
  ```
- **updateBossShells 추출**: `update()`의 "Periodic projectile spawn from the boss" 블록을
  ```ts
  /** fieldCap이 null이면 필드 수 제한 없이 간격마다 쏜다(EX). */
  private updateBossShells(nowMs: number, fieldCap: number | null): void
  ```
  로 옮긴다. 본편 경로는 `this.updateBossShells(nowMs, waveDef.maxSimultaneous + 2)`로 호출해 기존 동작 유지.
- **handleMonsterKilled()** 보스 분기:
  ```ts
  if (target.kind === 'boss') {
    if (this.isExActive) return; // EX: 클리어 연출·필드 정리 없음. 점수는 사격 처리에서 이미 들어감
    if (this.getBossEntities().length > 0) return;
    this.startBossClearSequence(target, nowMs);
    return;
  }
  ```
  처치 점수가 실제로 사격 경로(`shootAtInner`의 `registerHit(..., target.killBonusScore, ...)`)와 스킬 경로(`applySkillDamage`)에서 들어가는지 코드로 확인하고, 들어가지 않는 경로가 있으면 이 Task 안에서 맞춘다.
- **목숨**: 보스 처치 시 `healLives`를 부르지 않는다(D08).

### I04. 테스트

- Related Files:
  - `tests/ex-rush.test.ts` — 보스 케이스 추가; modify

#### Details
1. `getExBossDueCount`: 59999→0, 60000→1, 125000→2. `getExBossSpec`: 1→cooler 150, 2→king 275, 3→cooler 181.5.
2. 엔진(EX 진입 상태로 만든 뒤, 일반 몬스터는 매 틱 제거하거나 `exRng` 고정): `exElapsedMs`가 60초를 넘는 첫 update에서 보스 1대(cooler, hp 150), `bossWarningUntilMs > now`, `isBossEncounterActive === false`.
3. 120초: 첫 보스를 안 잡았으면 보스 2대(cooler + king 275), king은 `modelScaleMult === GAME_TUNING.boss.kingScale`, 두 보스 theta가 다르다.
4. 2인: 첫 보스 HP 300.
5. EX 보스를 `killBoss` 헬퍼로 처치: `isBossClearSequence() === false`, 일반 몬스터가 필드에 남아 있음, `lives` 변화 없음, 보스를 쏜 플레이어 점수 증가.
6. 보스가 있는 동안 졸개 소환(`isSummonedMinion`)이 생기지 않음.
7. 기존 `tests/boss-*.test.ts` 전부 통과(makeBossEntity·updateBossShells 추출 회귀 확인).

## Acceptance Criteria
- [x] 60초마다 보스 1대가 소형→대형 순으로 난입하고 HP가 매번 10% 오른다(2인 ×2).
- [x] EX 보스 처치 시 클리어 연출·필드 정리·카드·목숨 회복이 없고 러시는 계속된다.
- [x] 못 잡은 보스는 누적되고 서로 다른 위치에 선다.
- [x] EX 보스는 포탄을 쏘고 졸개를 소환하지 않는다.
- [x] 본편 보스 동작은 바뀌지 않는다.

## Validation
- `npx vitest run tests/ex-rush.test.ts tests/boss-encounters.test.ts tests/boss-clear-sequence.test.ts tests/boss-concurrent-spawns.test.ts tests/boss-hp-summons.test.ts tests/boss-shell-ramp.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 타입 오류 없음

## Commit Message
```text
feat(ex-rush): EX 보스 60초 난입(소형·대형 교대, 누적, 소환·클리어 연출 없음)

Plan: 2026-11-17-ex-endless-waves
Phase: P01-engine-ex-rush
Task: T03-ex-boss-intrusion

- GAME_TUNING.exRush.boss 계수(60초, 150/250, 난입마다 ×1.1)
- exRush.ts getExBossDueCount·getExBossSpec
- 엔진: makeBossEntity·updateBossShells 추출, spawnExBoss, EX 보스 처치 시 클리어 시퀀스 생략
- ex-rush 테스트에 보스 난입·누적·처치 케이스 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
