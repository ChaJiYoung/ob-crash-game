# Task: T01 Game Tuning and Gauges

## Status: pending

## Goal
난이도 상수 파일을 만들고 피버, 판정 피해, 스킬 쿨다운, 금색 캔, 수리 카드를 결정값으로 바꾼다. 피버와 스킬이 너무 빨리 차는 문제를 해결한다.

## Decision Summary
- D09: 피버 처치 4, PERFECT 추가 2. 금색 캔은 피버 +30%, 스킬 1회. 쿨다운 Lv.1~4 35 / 31 / 27 / 23초.
- D10: 판정 피해 PERFECT 2.0 / GREAT 1.0 / GOOD 0.5.
- D08: 수리 카드는 체력 +2, 최대 체력 증가 없음. 피버 부스터는 설명대로 실제 +50%.

## Implementation

### I01. 상수 파일

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING` — 난이도 수치 모음; new
  - `src/shared/constants.ts` :: `JUDGMENT_SPECS`, `FEVER_CONSTANTS`, `WEAPON_ARCHETYPE_SPECS`, `REWARD_CARD_SPECS` — 상수 참조; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/shared/gameTuning.ts (다른 파일을 import하지 않는다)
  export const GAME_TUNING = {
    fever: { killDelta: 4, perfectDelta: 2, cardBoostGain: 50 },
    judgment: { perfectDamage: 2.0, greatDamage: 1.0, goodDamage: 0.5 },
    skillCooldownMsByLevel: { 1: 35000, 2: 31000, 3: 27000, 4: 23000 },
    goldenCan: { feverGain: 30, skillStockGain: 1 },
    repairCard: { healAmount: 2 },
  } as const;
  ```
- **Execution Flow / Logic**:
  1. `JUDGMENT_SPECS`: `PERFECT.feverDelta = perfectDelta`, 각 `damageMultiplier`를 `GAME_TUNING.judgment` 값으로 한다.
  2. `FEVER_CONSTANTS.KILL_FEVER_DELTA`를 `GAME_TUNING.fever.killDelta`로 한다.
  3. `WEAPON_ARCHETYPE_SPECS`의 리터럴 표 이름을 `BASE_WEAPON_ARCHETYPE_SPECS`로 바꾸고, 아래 함수 결과를 export한다. P03-T02가 이 함수를 확장한다.
     ```typescript
     function applyWeaponTuning(
       base: Record<WeaponKind, WeaponArchetypeSpec>
     ): Record<WeaponKind, WeaponArchetypeSpec>;
     export const WEAPON_ARCHETYPE_SPECS = applyWeaponTuning(BASE_WEAPON_ARCHETYPE_SPECS);
     ```
     이 Task에서는 각 레벨의 `skillCooldownMs`만 표 값으로 덮어쓴다. 원본 객체를 직접 변경하지 않는다.
  4. `evaluateHitJudgment`의 피버 분기 `damageMultiplier: 1.5`는 **그대로 둔다.** 시뮬레이션에 쓴 값이고 피버에는 이미 피해 2배가 적용된다.

### I02. 금색 캔과 카드 효과

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: 금색 캔 처리, `applyRewardCard` — 효과 변경; modify
  - `src/pc/engine/WeaponSystem.ts` :: `addSkillStock` — 스킬 1회 충전; modify
  - `src/shared/constants.ts` :: `REWARD_CARD_SPECS.bar_repair` — 설명 변경; modify
  - `src/pc/components/GameCanvas3D.tsx` :: 카드 문구 — 설명 변경; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // WeaponSystem
  public addSkillStock(amount: number): void {
    this.skillStock = Math.min(this.getMaxSkillStock(), this.skillStock + amount);
    if (this.skillStock >= this.getMaxSkillStock()) this.skillCooldownRemainingMs = 0;
  }
  ```
- **Execution Flow / Logic**:
  1. 금색 캔(`:1371-1372`):
     ```typescript
     this.weaponSystem.addSkillStock(GAME_TUNING.goldenCan.skillStockGain);
     this.scoreManager.addFeverGauge(GAME_TUNING.goldenCan.feverGain);
     ```
  2. `applyRewardCard`:
     - `bar_repair`: `this.lives = Math.min(this.maxLives, this.lives + GAME_TUNING.repairCard.healAmount);` (`maxLives` 증가 삭제)
     - `fever_boost`: `this.scoreManager.addFeverGauge(GAME_TUNING.fever.cardBoostGain);`
  3. `chargeFeverToMax`는 다른 곳에서 쓰지 않으면 지운다. `grep -n chargeFeverToMax -r src tests`로 확인한다.
  4. `REWARD_CARD_SPECS.bar_repair`: `nameKo: '바리케이드 수리'`, `descriptionKo: '바 방어선 체력 +2 회복'`.
  5. `GameCanvas3D` 카드 문구: 수리 `'방어선 체력 +2 회복'`, 초고속 장전 `'재장전 딜레이 20% 단축\n최대 탄창 +2발 확장'`.

### I03. 테스트 갱신

- Related Files:
  - `tests/shared-protocol.test.ts`, `tests/score-fever-multiplier.test.ts`, `tests/engine-judgment-and-spawn.test.ts`, `tests/gatling-balance.test.ts`, `tests/gameplay-polish.test.ts` — 수치 갱신; modify

#### Details
- `tests/shared-protocol.test.ts`: `:43` `feverDelta` 2, `:60` `KILL_FEVER_DELTA` 4
- `tests/score-fever-multiplier.test.ts`:
  - `:42` `round(2 * 0.33) = 1`이므로 기대값 1
  - 처치 검사: `round(2 * 0.33) + round(4 * 0.33) = 1 + 1 = 2`
- `tests/engine-judgment-and-spawn.test.ts`:
  - `:47` `feverDelta` 2, `:48`, `:59`, `:81` 중 피버 분기가 아닌 일반 PERFECT 배율은 2.0, `:81` 피버는 1.5 유지, `:70` GOOD 0.5
  - `:97-109` 피버 누적 주석과 반복 횟수를 PERFECT +2, 처치 +6 기준으로 다시 계산한다.
  - `:511` 샷건 Lv.2: 4 × 0.40 × 2.0 = 3.2 → hp 0.8
  - `:550` 리볼버 Lv.1 정면: 4.0 - 2.0 = 2.0
  - `:551` 관통: 3.0 - (2.0 × 0.467) = 2.066
  - `:574` 개틀링 Lv.1: 2.0 - (0.25 × 2.0) = 1.5
  - `:687` 금색 캔: `isFeverReady`는 `false`, `feverGauge`는 약 30 이상으로 변경
  - `:748`, `:772`, `:796`, `:818`의 판정별 피해 기대값을 새 배율로 다시 계산한다.
- `tests/gatling-balance.test.ts`: 개틀링 비처치 피버 3 → 1, 리볼버 8 → 2, 처치 관련 값도 같은 공식으로 갱신
- `tests/gameplay-polish.test.ts`: `:166-173` 수리 카드 → `lives = 2`에서 카드 후 `lives = 4`, `maxLives = 5`
- `tests/tutorial-and-guide.test.ts:31-36` 주석의 배율 설명을 고친다. 튜토리얼 동작은 GREAT 1.0으로 여전히 1HP 캔을 한 방에 잡는다. GOOD은 0.5로 체력이 더 많이 남는다.
- 새 테스트: 금색 캔이 스킬 1회만 채우는지, `fever_boost`가 50만 오르는지.

### I04. 표시 문구

- Related Files:
  - `src/pc/components/JudgmentBanner.tsx` :: `getJudgmentBannerSpec` — 배율 표시; modify
  - `tests/pc-hud-and-banner.test.ts` :: `:87-101` — 문구 기대값; modify

#### Details
- `subtitle`을 `2.0x 데미지 (+150 PTS)`, `1.0x 데미지 (+100 PTS)`, `0.5x 데미지 (+50 PTS)`로 바꾼다.

## Acceptance Criteria
- [ ] 난이도 수치를 `gameTuning.ts`에서 바꾸면 게임에 반영된다.
- [ ] 피버가 처치만으로 약 17~25마리에 찬다(개틀링 제외).
- [ ] 금색 캔이 피버를 다 채우지 않는다.
- [ ] 수리 카드가 최대 체력을 올리지 않는다.

## Validation
- `npx vitest run tests/shared-protocol.test.ts tests/score-fever-multiplier.test.ts tests/engine-judgment-and-spawn.test.ts tests/gatling-balance.test.ts tests/gameplay-polish.test.ts tests/tutorial-and-guide.test.ts tests/pc-hud-and-banner.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(balance): centralize tuning and slow fever and skill gauges

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P03-balance-and-cards
Task: T01-game-tuning-and-gauges

- Add GAME_TUNING as the single source for difficulty values
- Apply new fever, judgment damage, and skill cooldown values
- Weaken golden can, repair card, and fever boost effects
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
