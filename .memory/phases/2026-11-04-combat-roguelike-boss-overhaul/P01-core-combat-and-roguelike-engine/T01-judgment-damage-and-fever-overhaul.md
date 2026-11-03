# Task: T01 판정별 데미지 배율(0.8x/1.0x/1.5x), 초반 무기 화력 상향, MISS 페널티 폐지 및 피버 충전·2배 데미지 개편

## Status: done

## Goal
`constants.ts`, `HitJudgment.ts`, `ScoreAndFeverManager.ts`, `WeaponSystem.ts`, `BeerCrusherEngine.ts`를 개편하여, 빗나감(`MISS`) 페널티를 폐지하고 명중 정확도(`GOOD: 0.8x / GREAT: 1.0x / PERFECT: 1.5x`)에 비례한 사격 데미지를 적용하며, 1레벨 리볼버·샷건이 `GREAT` 이상 명중 시 1HP 기본 캔을 무조건 한 방에 처치(개틀링은 0.25 데미지로 4발 처치)하고, 피버 게이지는 `PERFECT(+8%)`와 `몬스터 처치(+12%)`로만 충전되며 피버 발동 중 실제 사격 데미지가 2배로 들어가도록 구현한다.

## Decision Summary
- **D01**: `GOOD = 0.8x`, `GREAT = 1.0x`, `PERFECT = 1.5x` 데미지 배율 적용. 리볼버 Lv.1~4 데미지를 `1.00 / 1.35 / 1.75 / 2.20`으로, 개틀링 Lv.1~4 데미지를 `0.25 / 0.32 / 0.40 / 0.50`으로 상향. 샷건은 `GREAT`/`PERFECT` 시 전체 펠릿에 판정 배율(`1.0x`/`1.5x`)을 곱하고 `GOOD` 시 `0.8x`를 곱해 Lv.1 `GREAT` 명중 시 `1.05` 데미지(1HP 캔 원샷), `GOOD` 명중 시 `0.84` 데미지(0.16 HP 잔존)가 되도록 통일한다.
- **D02**: `FEVER_CONSTANTS.MISS_PENALTY = 0`으로 미스 페널티를 폐지하고, 피버 게이지는 `PERFECT` 명중 시 `+8%`, 몬스터 처치(Kill) 시 `+12%`(`FEVER_CONSTANTS.KILL_FEVER_DELTA = 12`) 충전한다. 피버 발동 중(`isFeverActive`) 실제 사격 데미지를 2배 증폭한다.

## Implementation

### I01. 공유 타입 및 상수 스펙 개편 (`types.ts`, `constants.ts`)

- Related Files:
  - `src/shared/types.ts` :: `RewardCardKind` — 패시브 드롭 카드 `'lucky_drop'` 유니온 멤버 추가; modify
  - `src/shared/constants.ts` :: `JudgmentSpec`, `JUDGMENT_SPECS`, `FEVER_CONSTANTS`, `WEAPON_ARCHETYPE_SPECS`, `REWARD_CARD_SPECS` — 판정 배율, 피버 충전량, 무기별 데미지 및 신규 보상 카드 스펙 정의; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/shared/types.ts
  export type RewardCardKind =
    | 'weapon_level_up'
    | 'rapid_reload'
    | 'bar_repair'
    | 'fever_boost'
    | 'lucky_drop';

  // src/shared/constants.ts
  export interface JudgmentSpec {
    maxErrorRatio: number;
    baseScore: number;
    feverDelta: number;
    damageMultiplier: number;
    colorHex: string;
  }

  export const JUDGMENT_SPECS: Record<Exclude<JudgmentGrade, 'MISS'>, JudgmentSpec> = {
    PERFECT: {
      maxErrorRatio: 0.25,
      baseScore: 150,
      feverDelta: 8,
      damageMultiplier: 1.5,
      colorHex: '#fbbf24',
    },
    GREAT: {
      maxErrorRatio: 0.55,
      baseScore: 100,
      feverDelta: 0,
      damageMultiplier: 1.0,
      colorHex: '#38bdf8',
    },
    GOOD: {
      maxErrorRatio: 1.00,
      baseScore: 50,
      feverDelta: 0,
      damageMultiplier: 0.8,
      colorHex: '#4ade80',
    },
  };

  export const FEVER_CONSTANTS = {
    MAX_GAUGE: 100,
    MISS_PENALTY: 0,
    KILL_FEVER_DELTA: 12,
    DURATION_MS: 4000,
    LOCK_WHEN_FULL: true,
  } as const;
  ```
- **Data & Schema Fields**:
  - `JudgmentSpec`: `maxErrorRatio: number` (non-null), `baseScore: number` (non-null), `feverDelta: number` (PERFECT=8, GREAT=0, GOOD=0), `damageMultiplier: number` (PERFECT=1.5, GREAT=1.0, GOOD=0.8), `colorHex: string`.
  - `WEAPON_ARCHETYPE_SPECS.revolver.levels`:
    - Lv.1 `damagePerHit`: `0.75` ➔ `1.00`
    - Lv.2 `damagePerHit`: `1.00` ➔ `1.35`
    - Lv.3 `damagePerHit`: `1.35` ➔ `1.75`
    - Lv.4 `damagePerHit`: `1.75` ➔ `2.20`
  - `WEAPON_ARCHETYPE_SPECS.gatling.levels`:
    - Lv.1 `damagePerHit`: `0.15` ➔ `0.25`
    - Lv.2 `damagePerHit`: `0.20` ➔ `0.32`
    - Lv.3 `damagePerHit`: `0.25` ➔ `0.40`
    - Lv.4 `damagePerHit`: `0.35` ➔ `0.50`
  - `REWARD_CARD_SPECS`:
    - `lucky_drop`: `{ kind: 'lucky_drop', nameKo: '행운의 보급품', badgeText: 'LUCKY DROP', colorHex: '#a855f7', descriptionKo: '몬스터 처치 시 아이템 출현 빈도 배율 증가 (중첩 가능)' }`
    - `bar_repair.descriptionKo`: `'바 방어선 체력 100% 전체 회복 및 최대 체력 +1 영구 확장'`
- **Execution Flow / Logic**:
  1. Precondition & Validation: `RewardCardKind`의 모든 키가 `REWARD_CARD_SPECS: Record<RewardCardKind, RewardCardSpec>`에 빠짐없이 정의되어 `tsc --noEmit` 타입 무결성을 만족해야 한다.
  2. Core Processing: `JUDGMENT_SPECS`에 `damageMultiplier` 필드를 추가하고 `GREAT`/`GOOD`의 `feverDelta`를 `0`으로, `PERFECT`의 `feverDelta`를 `8`로 설정한다. `FEVER_CONSTANTS.MISS_PENALTY`는 `0`, `KILL_FEVER_DELTA`는 `12`로 정의한다.
  3. Error & Exception Handling: 런타임 예외 없음(정적 상수 테이블).
  4. State Transition & Return: 변경된 상수들이 `HitJudgment`, `ScoreAndFeverManager`, `WeaponSystem`, `BeerCrusherEngine`에서 참조된다.

### I02. 판정 계산기 및 피버·무기 매니저 개편 (`HitJudgment.ts`, `ScoreAndFeverManager.ts`, `WeaponSystem.ts`, `BeerCrusherEngine.ts`)

- Related Files:
  - `src/pc/engine/HitJudgment.ts` :: `HitJudgmentResult`, `evaluateHitJudgment` — `damageMultiplier` 반환 및 `MISS` 시 `feverDelta: 0` 처리; modify
  - `src/pc/engine/ScoreAndFeverManager.ts` :: `ScoreAndFeverManager` — `registerHit(grade, killBonusScore, killed)`에서 처치 시 `+12%` 피버 충전, `getComboMultiplier()` 1.0 고정, `applyMissPenalty()` 게이지/콤보 차감 제거; modify
  - `src/pc/engine/WeaponSystem.ts` :: `WeaponSystem` — `rapidReloadStacks` 및 Lv.MAX 초과 레벨업 시 `damageBonusMultiplier`(+15%p 중첩) 지원; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `BeerCrusherEngine.shootAt` — 판정 배율(`judgment.damageMultiplier`), 파워샷(`2.0x`), 피버(`2.0x`), 무기 보너스 배율을 결합한 데미지 산출; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/pc/engine/HitJudgment.ts
  export interface HitJudgmentResult {
    grade: JudgmentGrade;
    errorRatio: number;
    baseScore: number;
    feverDelta: number;
    damage: number;
    damageMultiplier: number;
  }

  // src/pc/engine/ScoreAndFeverManager.ts
  public registerHit(
    grade: Exclude<JudgmentGrade, 'MISS'>,
    killBonusScore = 0,
    killed = false
  ): {
    earnedScore: number;
    totalScore: number;
    combo: number;
    maxCombo: number;
    feverGauge: number;
    isFeverReady: boolean;
  }

  // src/pc/engine/WeaponSystem.ts
  public getDamageBonusMultiplier(): number;
  ```
- **Data & Schema Fields**:
  - `HitJudgmentResult`: `damageMultiplier: number` (PERFECT=1.5, GREAT=1.0, GOOD=0.8, MISS=0).
  - `WeaponSystem`:
    - `private rapidReloadStacks: number = 0` (초기값 0, `applyRapidReloadBuff` 호출 시 +1)
    - `private damageBonusMultiplier: number = 1.0` (초기값 1.0, Lv.4 상태에서 `upgradeWeaponLevel` 호출 시 +0.15 중첩)
- **Execution Flow / Logic**:
  1. Precondition & Validation:
     - `evaluateHitJudgment(aimDistanceM, hitRadiusM, isFeverActive)`: `hitRadiusM <= 0`이거나 `errorRatio > 1.0`이면 `grade: 'MISS'`, `feverDelta: 0`, `damage: 0`, `damageMultiplier: 0`을 반환한다.
  2. Core Processing:
     - `evaluateHitJudgment`:
       - `isFeverActive === true`이고 `errorRatio <= 1.0`이면 `grade: 'PERFECT'`, `damage: 2`, `damageMultiplier: 1.5`, `feverDelta: 0`을 반환한다.
       - 일반 상태에서는 `PERFECT`(`<= 0.25`), `GREAT`(`<= 0.55`), `GOOD`(`<= 1.0`) 등급에 따라 `JUDGMENT_SPECS[grade].damageMultiplier`(`1.5`, `1.0`, `0.8`)와 `feverDelta`(`8`, `0`, `0`)를 반환한다.
     - `ScoreAndFeverManager`:
       - `getComboMultiplier()`는 항상 `1.0`을 반환한다 (탄알 타격 콤보 배율 폐지). 단, 서버 제출(`GAME_SCORE_SUBMIT`) 호환을 위해 내부 `combo`/`maxCombo` 카운터는 적중 시 +1 누적한다.
       - `registerHit(grade, killBonusScore = 0, killed = false)`: `!this.isFeverActive`일 때 `const delta = spec.feverDelta + (killed ? FEVER_CONSTANTS.KILL_FEVER_DELTA : 0);`만큼 `this.feverGauge`를 증가시킨다 (`Math.min(100, this.feverGauge + delta)`).
       - `applyMissPenalty()`: `FEVER_CONSTANTS.MISS_PENALTY`가 `0`이므로 `this.combo`와 `this.feverGauge`를 감소시키지 않고 현재 상태를 그대로 반환한다.
     - `WeaponSystem`:
       - `applyRapidReloadBuff()`: `this.rapidReloadStacks += 1; this.hasRapidReloadBuff = true; this.ammo = Math.min(this.getMaxAmmo(), this.ammo + 2);`
       - `getMaxAmmo()`: `base + this.rapidReloadStacks * 2`.
       - `getReloadDurationMs()`: `Math.max(450, Math.round(base * Math.pow(0.8, this.rapidReloadStacks)))`.
       - `upgradeWeaponLevel()`: `this.weaponLevel < 4`이면 레벨 +1 및 탄창 완충; 이미 `this.weaponLevel === 4`이면 `this.refillSkillInstant()`와 함께 `this.damageBonusMultiplier = Number((this.damageBonusMultiplier + 0.15).toFixed(2))`를 적용한다.
     - `BeerCrusherEngine.shootAt`:
       - `const powerMult = isPowerShot ? 2.0 : 1.0;`
       - `const feverMult = isFever ? 2.0 : 1.0;`
       - `const judgmentMult = result.damageMultiplier;`
       - `const weaponBonusMult = this.weaponSystem.getDamageBonusMultiplier();`
       - `const totalMult = powerMult * feverMult * judgmentMult * weaponBonusMult;`
       - **Shotgun**: `baseDamage = levelSpec.pelletCount * levelSpec.damagePerHit;` ➔ `damage = Number((baseDamage * totalMult).toFixed(3));` (Lv.1 기준 `GOOD`=0.84, `GREAT`=1.05, `PERFECT`=1.575).
       - **Revolver**: `damage = Number((levelSpec.damagePerHit * totalMult).toFixed(3));` (Lv.1 기준 `GOOD`=0.80, `GREAT`=1.00, `PERFECT`=1.50).
       - **Gatling**: `damage = Number((levelSpec.damagePerHit * totalMult).toFixed(3));` (Lv.1 기준 `GOOD`=0.20, `GREAT`=0.25, `PERFECT`=0.375).
       - 타겟 HP 차감 후 `const killed = target.hp <= 0;`를 판별하고 `this.scoreManager.registerHit(result.grade, killed ? target.killBonusScore : 0, killed)`를 호출한다.
  3. Error & Exception Handling:
     - 부동소수점 오차(예: `0.35 * 3 * 1.0 = 1.0499999999999998`)로 인해 1HP 캔이 죽지 않는 현상을 방지하기 위해 `Number((...).toFixed(3))` 반올림을 적용한다.
  4. State Transition & Return:
     - `shootAt`은 `{ fired: true, grade: result.grade, target: primaryTarget, killed, earnedScore, hitTargets }`를 반환한다.

### I03. 판정·피버·무기 데미지 유닛 테스트 업데이트 (`tests/engine-judgment-and-spawn.test.ts`)

- Related Files:
  - `tests/engine-judgment-and-spawn.test.ts` :: `Core Engine: Fan Spawn, 3-Tier Judgment, Fever 100% Lock, Auto Reload` — 개편된 판정 배율(0.8x/1.0x/1.5x), 미스 페널티 제거, 피버 충전(+8/+12) 및 피버 2배 데미지 검증; modify

#### Details
- **Signatures & Types**: Vitest `describe` / `it` 테스트 스위트.
- **Data & Schema Fields**: 테스트 픽스처(`BeerCrusherEngine`, `ScoreAndFeverManager`, `evaluateHitJudgment`).
- **Execution Flow / Logic**:
  1. Precondition & Validation: `engine.startGame()`으로 초기화된 상태에서 테스트 타겟을 배치한다.
  2. Core Processing:
     - `evaluateHitJudgment` 테스트에서 `PERFECT`(`damageMultiplier: 1.5`, `feverDelta: 8`), `GREAT`(`damageMultiplier: 1.0`, `feverDelta: 0`), `GOOD`(`damageMultiplier: 0.8`, `feverDelta: 0`), `MISS`(`feverDelta: 0`)를 검증한다.
     - `ScoreAndFeverManager` 테스트에서 `GOOD`/`GREAT` 일반 적중 시 게이지 +0%, `PERFECT` 적중 시 +8%, 몬스터 처치(`killed = true`) 시 +12%가 충전되고, `applyMissPenalty()` 호출 시 게이지와 콤보가 깎이지 않음을 검증한다.
     - 3종 무기 탄도학 테스트에서 새로운 데미지 수치(샷건 Lv.2 `PERFECT` = `4 * 0.40 * 1.5 = 2.40`, 리볼버 Lv.1 `GREAT` = `1.0`, `PERFECT` = `1.5`, 개틀링 Lv.1 `GREAT` = `0.25`, `PERFECT` = `0.375`) 및 피버 발동 중 2배 데미지를 검증한다.
  3. Error & Exception Handling: 부동소수점 비교 시 `toBeCloseTo`를 사용한다.
  4. State Transition & Return: 모든 테스트 케이스가 통과해야 한다.

## Acceptance Criteria
- [ ] `evaluateHitJudgment`가 `PERFECT(1.5x, fever +8)`, `GREAT(1.0x, fever 0)`, `GOOD(0.8x, fever 0)`, `MISS(0x, fever 0)`를 반환한다.
- [ ] 1레벨 리볼버와 1레벨 샷건으로 1HP 기본 캔(`pilgood`, `caslight`)을 `GREAT` 이상으로 명중시키면 단 1발에 즉시 처치(`killed: true`)되고, `GOOD`으로 맞히면 체력이 소량(`0.2` / `0.16`) 남는다.
- [ ] 사격이 빗나가도(`MISS`) 피버 게이지가 감소하지 않으며, 몬스터 처치 시 `+12%`, `PERFECT` 명중 시 `+8%`씩 피버 게이지가 상승한다.
- [ ] 피버 발동(`isFeverActive = true`) 상태에서 사격 시 평상시 대비 2배의 사격 데미지가 적용된다.

## Validation
- `npm test -- tests/engine-judgment-and-spawn.test.ts` — 모든 테스트 통과

## Commit Message
```text
feat(engine): implement accuracy damage multipliers, weapon buffs, and kill/perfect fever charging

Plan: 2026-11-04-combat-roguelike-boss-overhaul
Phase: P01-core-combat-and-roguelike-engine
Task: T01-judgment-damage-and-fever-overhaul

- Apply 0.8x (GOOD), 1.0x (GREAT), and 1.5x (PERFECT) damage multipliers in shootAt
- Rebalance Lv.1 revolver (1.0) and gatling (0.25) base damage so GREAT one-shots 1HP cans
- Remove MISS fever penalty and charge fever gauge on PERFECT (+8%) and monster kill (+12%)
- Apply actual 2x weapon damage multiplier during active Fever mode
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
