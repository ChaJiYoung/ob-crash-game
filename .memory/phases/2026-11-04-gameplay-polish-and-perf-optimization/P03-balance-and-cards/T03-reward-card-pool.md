# Task: T03 Reward Card Pool

## Status: pending

## Goal
카드를 9종으로 늘리고 매번 중복 없이 3장을 뽑는다. MAX 무기 카드가 계속 나오는 문제와 같은 카드만 반복되는 문제를 해결하고, 무기 MAX 시점을 늦춘다.

## Decision Summary
- D08: 추가 4종은 공격력 +10%(최대 3회), 스킬 쿨다운 -10%(최대 3회), 피버 지속 +0.5초(최대 3회), 명중 판정 +5%(최대 2회).
- D08 제외 조건: 무기 Lv.4 또는 웨이브 상한, 행운 3회, 장전 3회, 피버가 찼거나 발동 중이면 피버 부스터, 체력이 가득하면 수리.
- D09: 무기 레벨 상한은 1웨이브 Lv.2, 2~4웨이브 Lv.3, 5웨이브부터 MAX.

## Implementation

### I01. 타입과 명세

- Related Files:
  - `src/shared/types.ts` :: `RewardCardKind`, `RewardCardSpec` — 종류와 필드 추가; modify
  - `src/shared/constants.ts` :: `REWARD_CARD_SPECS` — 9종 정의; modify
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.cards`, `weaponLevelCapByWave` — 수치 추가; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export type RewardCardKind =
    | 'weapon_level_up' | 'rapid_reload' | 'bar_repair' | 'fever_boost' | 'lucky_drop'
    | 'damage_up' | 'skill_cooldown' | 'fever_extend' | 'hit_zone_up';

  export interface RewardCardSpec {
    kind: RewardCardKind;
    nameKo: string;
    badgeText: string;
    colorHex: string;
    descriptionKo: string;
    cardSubtitleKo: string; // 3D 카드 두 줄 문구(\n 포함)
    icon: string;
  }
  ```
- **Data & Schema Fields**:
  ```typescript
  cards: {
    damageUp: { amount: 0.10, maxStacks: 3 },
    skillCooldown: { multiplier: 0.9, maxStacks: 3 },
    feverExtend: { amountMs: 500, maxStacks: 3 },
    hitZoneUp: { amount: 0.05, maxStacks: 2 },
    rapidReloadMaxStacks: 3,
    luckyDropMaxStacks: 3,
  },
  weaponLevelCapByWave: { 1: 2, 2: 3, 3: 3, 4: 3, 5: 4, 6: 4, 7: 4 },
  ```
- 기존 5종 문구는 `GameCanvas3D`의 현재 문구(P03-T01에서 수정한 값)와 아이콘을 옮긴다.
- 새 4종:
  | kind | nameKo | cardSubtitleKo | colorHex | icon |
  | :--- | :--- | :--- | :--- | :--- |
  | `damage_up` | 공격력 강화 | 사격 피해 +10%\n최대 3회 중첩 | `#ef4444` | 💥 |
  | `skill_cooldown` | 스킬 가속 | 스킬 쿨다운 -10%\n최대 3회 중첩 | `#06b6d4` | ⏱️ |
  | `fever_extend` | 피버 연장 | 피버 지속 +0.5초\n최대 3회 중첩 | `#f97316` | 🔥 |
  | `hit_zone_up` | 조준 보정 | 명중 판정 +5%\n최대 2회 중첩 | `#22c55e` | 🎯 |

### I02. 효과 적용

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `applyRewardCard`, `startGame`, `computeTargetAimCoords` — 카드 효과; modify
  - `src/pc/engine/WeaponSystem.ts` :: `addDamageBonus`, `setSkillCooldownScale`, `getSkillCooldownTotalMs`, `getRapidReloadStacks` — 지원 메서드; modify
  - `src/pc/engine/ScoreAndFeverManager.ts` :: `setFeverDurationBonusMs`, `activateFever`, `updateFeverTimer`, `reset` — 피버 연장; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // WeaponSystem
  public addDamageBonus(amount: number): void;
  public setSkillCooldownScale(scale: number): void;
  public getRapidReloadStacks(): number;
  // ScoreAndFeverManager
  public setFeverDurationBonusMs(ms: number): void;
  // BeerCrusherEngine
  private cardStacks: Record<'damage_up' | 'skill_cooldown' | 'fever_extend' | 'hit_zone_up', number>;
  ```
- **Execution Flow / Logic**:
  1. `applyRewardCard`에 4종 분기를 더한다. 스택을 올린 뒤 값을 다시 계산한다(`0.9 ** stacks`, `500 * stacks`).
  2. `getSkillCooldownTotalMs`: `Math.round(spec.skillCooldownMs * skillCooldownScale)`.
  3. 피버: `activateFever`와 `updateFeverTimer`가 `DURATION_MS + bonus`를 쓰게 한다. 게이지 표시 비율도 같은 값으로 나눈다.
  4. `computeTargetAimCoords`: 일반 대상의 범위에 `(1 + hitZoneUp.amount * stacks)`를 곱한다.
  5. `startGame`에서 스택과 무기·피버 보너스를 초기화한다. `WeaponSystem.reset`, `ScoreAndFeverManager.reset`도 값을 되돌리는지 확인한다.

### I03. 카드 뽑기

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `spawnWaveRewardCards`, `buildRewardCardPool` — 동적 풀; modify

#### Details
- **Signatures & Types**:
  ```typescript
  public buildRewardCardPool(): RewardCardKind[];
  ```
- **Execution Flow / Logic**:
  1. 풀 구성 조건:
     - `weapon_level_up`: `level < 4 && level < weaponLevelCapByWave[currentWave]`
     - `lucky_drop`: `luckyDropStacks < luckyDropMaxStacks`
     - `rapid_reload`: `getRapidReloadStacks() < rapidReloadMaxStacks`
     - `fever_boost`: `!isFeverReady && !isFeverActive`
     - `bar_repair`: `lives < maxLives`
     - `damage_up`, `skill_cooldown`, `fever_extend`, `hit_zone_up`: 스택이 최대 미만
  2. `this.dropRng`로 Fisher-Yates 셔플 후 앞 3장을 쓴다.
  3. **풀이 3장 미만이면** `bar_repair`와 `fever_boost`를 조건 없이 넣어 항상 3장을 만든다. 그래도 부족하면 `rapid_reload`를 더한다. 중복은 넣지 않는다.
  4. 기존 슬롯 고정 코드를 지운다. 배치(`xPositions`)와 카드 엔티티 생성은 유지한다.

### I04. 카드 표시

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `rewardCardKind` 분기 — 명세 사용; modify

#### Details
- 하드코딩한 title, sub, col, ico 분기를 지우고 `REWARD_CARD_SPECS[rk]`로 만든다.
- `lucky_drop`만 기존처럼 `engine.getNextLuckyDropMultiplier()`를 넣은 동적 문구를 쓴다. 문구가 달라지면 텍스처 캐시 키도 달라져 올바르게 동작한다.
- `src/pc/components/GuideModal.tsx:558`은 `Object.entries(REWARD_CARD_SPECS)`로 그리므로 9종이 자동 표시된다. 레이아웃이 넘치지 않는지 화면에서 확인한다.

### I05. 테스트

- Related Files:
  - `tests/reward-card-pool.test.ts` :: 풀과 효과 검증; new
  - `tests/shared-protocol.test.ts` :: `:135-136` — 9종 검사; modify
  - `tests/gameplay-polish.test.ts` :: `:149` — 무작위 카드 대응; modify
  - `tests/engine-judgment-and-spawn.test.ts` :: `:664` — 무작위 카드 대응; modify

#### Details
- **함정**: 기존 테스트는 `weapon_level_up` 카드가 항상 있다고 가정한다. 카드가 무작위가 되면 이따금 실패하는 테스트가 된다. `const card = cards[0]`을 쏘고 `selectedCard`가 그 종류인지 확인한다. 레벨 상승 검사는 `engine.applyRewardCard('weapon_level_up', now)`로 따로 한다.
- **새 테스트 시나리오**:
  - 무기 Lv.4에서 `weapon_level_up`이 풀에 없다.
  - 1웨이브 Lv.2, 3웨이브 Lv.3에서 풀에 없고, 5웨이브 Lv.3에서는 있다.
  - 행운 3회, 장전 3회, 스택 최대인 카드는 풀에 없다.
  - 피버가 찼거나 발동 중이면 `fever_boost`가 없다.
  - 체력이 가득하면 `bar_repair`가 없다.
  - 모든 카드가 최대여도 항상 서로 다른 3장이 나온다.
  - `dropRng` 고정값으로 결과가 같다.
  - 4종 효과: 피해 +10%, 쿨다운 x0.9, 피버 지속 +500ms, 판정 범위 +5%.
  - `startGame` 후 스택과 효과가 초기화된다.

## Acceptance Criteria
- [ ] 무기가 MAX면 무기 카드가 나오지 않는다.
- [ ] 카드 구성이 매번 달라진다.
- [ ] 새 카드 4종의 효과가 실제로 적용된다.
- [ ] 새 게임을 시작하면 카드 효과가 사라진다.

## Validation
- `npx vitest run tests/reward-card-pool.test.ts tests/shared-protocol.test.ts tests/gameplay-polish.test.ts tests/engine-judgment-and-spawn.test.ts` — 통과
- `npm test` — 전체 통과(반복 실행해도 통과)
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(cards): add nine card pool with random draws and weapon level caps

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P03-balance-and-cards
Task: T03-reward-card-pool

- Add damage, skill cooldown, fever duration, and hit zone cards
- Draw three distinct cards from a state-based pool
- Exclude capped cards and limit weapon level by wave
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
