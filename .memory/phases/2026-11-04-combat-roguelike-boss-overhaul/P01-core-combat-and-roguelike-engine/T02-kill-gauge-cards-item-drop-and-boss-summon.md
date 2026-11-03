# Task: T02 킬 게이지 보상 카드(전장 일시정지), 적 처치 아이템 드롭(배율 패시브 카드) 및 냉각기 보스 10m 정지·미니웨이브 소환

## Status: done

## Goal
`BeerCrusherEngine.ts`에 ① 몬스터 처치 수(Kill Gauge) 누적 시 전투 중 3D 보상 카드를 팝업하고 선택 완료 전까지 필드 몬스터들을 일시정지(Freeze)하는 시스템, ② 몬스터 처치 시 기본 4% 확률(패시브 카드 선택 시 2배·3배·4배 증가)로 사격형 아이템을 드롭하고 바리케이드 카드는 체력 100% 전체 회복 + 최대체력 +1을 부여하는 보상 체계, ③ Wave 5 냉각기 보스가 전방 10m에 멈춰 서서 탭 레버 소환 액션과 함께 부하 미니웨이브를 지속 소환하고 보스 처치 시 즉시 승리하는 메커니즘을 구현한다.

## Decision Summary
- **D03**: 웨이브별 목표 킬 수(Wave 1: `10`, Wave 2: `14`, Wave 3: `18`, Wave 4: `20`, Wave 5: `15`)를 채울 때마다 전투 도중에도 3D 보상 카드가 출현하며, 카드가 떠 있는 동안 기존 몬스터·투사체의 이동과 스폰을 완전 일시정지(Freeze)한다.
- **D04**: 몬스터 처치 시 내부 기본 확률 `4%`로 해당 위치에 사격형 아이템이 스폰되며, 패시브 카드(`lucky_drop`) 중첩 시 플레이어에게는 `"아이템 드롭 빈도 2배/3배/4배 증가!"`로 표기하고 내부 확률을 `8% / 12% / 16%`로 높인다. 바리케이드 카드(`bar_repair`)는 체력 전체 회복 + 최대체력 +1을 제공한다.
- **D05**: Wave 5 냉각기 보스는 `radiusM = 10.0m`에서 정지(방어선 즉사 폐지)하며, 주기적으로 탭 레버 소환 액션을 취하며 부하 미니웨이브(4~5마리)를 소환한다. 보스 처치 시 남은 부하들이 즉시 제거되며 `VICTORY` 처리된다.

## Implementation

### I01. 킬 게이지 보상 카드 & 전장 일시정지 및 패시브/고밸류 카드 시스템 (`BeerCrusherEngine.ts`)

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `BeerCrusherEngine`, `WaveProgressInfo` — 킬 게이지 카드 트리거, 전장 일시정지, 적 처치 아이템 드롭, 보상 카드 효과 구현; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface WaveProgressInfo {
    wave: number;
    totalWaves: number;
    killedInWave: number;
    totalSpawns: number;
    remainingInWave: number;
    progressPercent: number;
    cardKillCount: number;
    cardKillTarget: number;
    luckyDropMultiplier: number; // 1 | 2 | 3 | 4
  }

  // BeerCrusherEngine methods
  public getCardKillTarget(waveIndex?: number): number;
  public getLuckyDropMultiplier(): number;
  public getNextLuckyDropMultiplier(): number;
  public spawnWaveRewardCards(nowMs: number, isWaveClear?: boolean): void;
  public spawnItemTargetAt(
    nowMs: number,
    thetaRad: number,
    radiusM: number,
    forcedItemKind?: ItemBuffKind
  ): ActiveTargetEntity;
  ```
- **Data & Schema Fields**:
  - `maxLives: number` (기본값 `STAGE_CONSTANTS.PLAYER_MAX_LIVES = 5`, `startGame` 시 5로 리셋, `bar_repair` 카드 선택 시 +1 증가)
  - `luckyDropStacks: number` (기본값 `0`, 최대 `3`, `startGame` 시 0으로 리셋)
  - `cardKillCount: number` (기본값 `0`, 일반 몬스터 처치 시 +1, `getCardKillTarget()` 도달 시 0으로 리셋 및 카드 스폰)
  - `pendingWaveAdvance: boolean` (기본값 `false`, 웨이브 클리어 시점에 스폰된 카드인지 여부)
  - `waveCardKillTargets: Record<number, number>` (`{ 1: 10, 2: 14, 3: 18, 4: 20, 5: 15 }`)
  - `dropRng: () => number` (기본값 `() => Math.random()`, 테스트에서 결정론적 드롭 검증 가능)
- **Execution Flow / Logic**:
  1. Precondition & Validation:
     - `update(nowMs, dtSec)`에서 **타겟 이동 루프(`1. Advance active targets radially`) 진입 직전**에 `if (!this.isTutorialMode && !this.isSandboxMode && (this.isWeaponSelectPending || this.isRewardCardPending))`를 검사하여, 카드가 떠 있는 동안에는 필드 위 몬스터와 투사체가 단 1mm도 전진하거나 방어선을 침범하지 않도록 즉시 `{ breaches: [], phaseChanged: false, reloadedJustNow }`를 반환한다.
  2. Core Processing:
     - **몬스터 처치 후처리 (`handleMonsterKilled(target, nowMs)`)**:
       - 일반 몬스터(`!target.isItem && !target.isProjectile && !target.isGoldenCan && !target.weaponSelectKind && !target.rewardCardKind && target.kind !== 'boss'`)가 사격(`shootAt`) 또는 스킬(`triggerWeaponSkill`)로 처치될 때:
       - ① **적 처치 랜덤 아이템 드롭**: 현재 필드 위 아이템(`t.isItem`) 개수가 2개 미만이고 튜토리얼/샌드박스가 아닐 때, `const dropProb = 0.04 * this.getLuckyDropMultiplier();`를 계산하여 `this.dropRng() < dropProb`이면 처치된 몬스터 위치(`thetaRad: target.thetaRad`, `radiusM: Math.max(6.5, Math.min(16.0, target.radiusM))`)에 `spawnItemTargetAt`으로 4종 아이템(`power_shot`, `wide_scope`, `ice_freeze`, `bar_repair`) 중 하나를 스폰한다.
       - ② **킬 게이지 누적 및 중도 카드 스폰**: `this.cardKillCount += 1;` 후 `this.cardKillCount >= this.getCardKillTarget()`이면 `this.cardKillCount = 0;`으로 초기화하고, 아직 웨이브가 끝나지 않았고 `!this.isRewardCardPending`이면 `this.spawnWaveRewardCards(nowMs, false)`를 호출한다.
     - **보상 카드 스폰 (`spawnWaveRewardCards(nowMs, isWaveClear = false)`)**:
       - `this.isRewardCardPending = true; this.rewardCardsSpawnTimeMs = nowMs; this.pendingWaveAdvance = isWaveClear;`
       - 이미 떠 있는 카드 타겟이 있다면 중복 생성하지 않도록 기존 `rewardCardKind` 타겟을 정리한 뒤 3장을 생성한다 (`xPositions = [-2.4, 0, 2.4]`, `z = -5.0`, **`customBaseY = 1.48`**). `spawnWeaponSelectTargets`의 `customBaseY`도 `1.48`로 통일한다.
       - 3장 후보 구성:
         - 슬롯 1: `'weapon_level_up'`
         - 슬롯 2: `this.luckyDropStacks < 3 ? 'lucky_drop' : 'rapid_reload'`
         - 슬롯 3: `this.lives < this.maxLives ? 'bar_repair' : (this.luckyDropStacks < 3 ? 'rapid_reload' : 'fever_boost')`
     - **보상 카드 선택 처리 (`shootAt`의 `target.rewardCardKind` 분기)**:
       - 800ms 오선택 방지 딜레이(`nowMs - this.rewardCardsSpawnTimeMs < 800`) 통과 후 카드를 맞히면 `this.applyRewardCard(target.rewardCardKind, nowMs)`를 실행한다.
       - **`this.activeTargets = this.activeTargets.filter((t) => !t.rewardCardKind);`** 로 카드 타겟 3장만 제거하고, 전투 중 남아 있던 일반 몬스터와 보스는 그대로 보존한다!
       - 만약 `this.pendingWaveAdvance`가 `true`였거나 현재 웨이브의 남은 스폰 및 살아있는 몬스터가 0이라면 다음 웨이브(`this.startWave(this.currentWave + 1)`)로 넘어가고, 그렇지 않으면 현재 웨이브 전투를 즉시 재개한다.
     - **카드 효과 적용 (`applyRewardCard`)**:
       - `'weapon_level_up'`: `this.weaponSystem.upgradeWeaponLevel();`
       - `'rapid_reload'`: `this.weaponSystem.applyRapidReloadBuff();`
       - `'bar_repair'`: `this.maxLives += 1; this.lives = this.maxLives;` (최대 체력 +1 영구 확장 및 체력 100% 전체 회복)
       - `'lucky_drop'`: `this.luckyDropStacks = Math.min(3, this.luckyDropStacks + 1);`
       - `'fever_boost'`: `this.scoreManager.chargeFeverToMax();`
  3. Error & Exception Handling:
     - 웨이브 마지막 몬스터를 잡은 순간 킬 게이지 카드와 웨이브 클리어 카드가 이중으로 뜨지 않도록, `pendingWaveAdvance` 플래그로 통합 제어한다.
  4. State Transition & Return:
     - `getWaveProgress()`가 `{ ...기존 필드, cardKillCount: this.cardKillCount, cardKillTarget: this.getCardKillTarget(), luckyDropMultiplier: this.getLuckyDropMultiplier() }`를 반환한다.

### I02. Wave 5 냉각기 보스 전방 10m 정지 & 탭 레버 미니웨이브 소환 및 보스 처치 즉시 승리 (`BeerCrusherEngine.ts`)

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `BeerCrusherEngine.update`, `BeerCrusherEngine.spawnBossMinionWave`, `BeerCrusherEngine.isBossSummoning` — 보스 10m 정지, 주기적/체력 비례 부하 미니웨이브 소환 및 보스 사망 시 즉시 승리 처리; modify

#### Details
- **Signatures & Types**:
  ```typescript
  public spawnBossMinionWave(nowMs: number, count?: number): ActiveTargetEntity[];
  public isBossSummoning(nowMs?: number): boolean;
  ```
- **Data & Schema Fields**:
  - `bossSummonActionUntilMs: number` (기본값 `0`, 소환 액션 시 `nowMs + 1800` 설정)
  - `lastBossSummonTimeMs: number` (기본값 `0`)
  - `lastBossSummonHpThreshold: number` (기본값 `45`, 보스 체력 45 / 30 / 15 이하 도달 시 단계적 감소)
- **Execution Flow / Logic**:
  1. Precondition & Validation:
     - `startGame` 및 `startWave`에서 `bossSummonActionUntilMs = 0`, `lastBossSummonTimeMs = 0`, `lastBossSummonHpThreshold = 45`로 초기화한다.
  2. Core Processing:
     - **보스 전방 10.0m 정지 (`update`)**:
       - `target.kind === 'boss'`인 타겟을 전진시킬 때 `next.radiusM <= 10.0`이면 `target.radiusM = 10.0; target.x = Math.sin(target.thetaRad) * 10.0; target.z = -Math.cos(target.thetaRad) * 10.0; target.breached = false;`로 고정한다 (보스가 방어선에 도달해 즉사시키는 현상 완전 제거).
     - **보스 탭 레버 부하 미니웨이브 소환 (`update` & `spawnBossMinionWave`)**:
       - Wave 5에서 살아있는 보스(`const boss = this.getBossEntity()`)가 있고 `boss.radiusM <= 12.5`일 때:
       - 시간 조건(`this.lastBossSummonTimeMs === 0 || nowMs - this.lastBossSummonTimeMs >= 9000`) 또는 체력 임계치 조건(`this.lastBossSummonHpThreshold > 0 && boss.hp <= this.lastBossSummonHpThreshold`)이 충족되면:
         - 체력 임계치로 트리거된 경우 `this.lastBossSummonHpThreshold -= 15;`로 다음 임계치(45 ➔ 30 ➔ 15 ➔ 0)로 갱신한다.
         - 현재 필드 위 일반 부하 몬스터 수가 7마리 미만이면 `this.spawnBossMinionWave(nowMs, 4)`를 호출한다.
       - `spawnBossMinionWave(nowMs, count = 4)`:
         - `this.lastBossSummonTimeMs = nowMs; this.bossSummonActionUntilMs = nowMs + 1800;`
         - `['pilgood', 'caslight', 'obi', 'hanmac', 'bottle']` 중에서 `count`마리를 보스 주변 부채꼴 각도(`-0.42 ~ +0.42 rad`)와 거리(`11.5 ~ 14.5m`)에 스폰하여 `this.activeTargets`에 추가한다.
     - **보스 처치 시 즉시 승리 (`shootAt` & `triggerWeaponSkill`)**:
       - `target.kind === 'boss'`가 처치(`target.hp <= 0`)되는 즉시 필드의 남은 부하 몬스터와 투사체, 카드를 모두 비우고(`this.activeTargets = []`), `this.isRewardCardPending = false; this.gamePhase = 'VICTORY';`로 전환한다.
  3. Error & Exception Handling:
     - Wave 5에서 기본 `totalSpawns`가 모두 소진되었더라도 보스가 살아있는 한 `VICTORY`로 넘어가지 않으며, 오직 보스가 처치되었을 때만 `VICTORY`로 전환되도록 보장한다.
  4. State Transition & Return:
     - `isBossSummoning(nowMs)`는 `nowMs < this.bossSummonActionUntilMs` 여부를 반환하여 3D 렌더러가 보스 탭 레버 애니메이션을 재생하게 한다.

### I03. 킬 게이지 카드, 전장 일시정지, 아이템 드롭 및 보스 미니웨이브 테스트 (`tests/gameplay-polish.test.ts`, `tests/engine-judgment-and-spawn.test.ts`)

- Related Files:
  - `tests/gameplay-polish.test.ts` :: `Gameplay Polish Quality Package (P0~P2)` — 킬 게이지 카드 스폰, 전장 일시정지(Freeze), 패시브 드롭 배율, 바리케이드 전체 회복, 보스 10m 정지 및 미니웨이브 소환/즉시 승리 검증; modify
  - `tests/engine-judgment-and-spawn.test.ts` — 카드 높이(`1.48m`) 및 웨이브 진행 호환성 검증; modify

#### Details
- **Signatures & Types**: Vitest 테스트 케이스.
- **Data & Schema Fields**: `BeerCrusherEngine` 인스턴스 및 결정론적 `dropRng` 함수.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `engine.startGame()`으로 Wave 1 시작.
  2. Core Processing:
     - 전투 도중 몬스터 10마리 처치 시 `isRewardCardPending === true`가 되며, 이때 필드에 남아있는 다른 몬스터가 `engine.update(now + 5000, 5.0)` 동안 전혀 이동하지 않음(Freeze)을 검증한다.
     - 카드를 사격해 선택한 뒤에는 기존 몬스터가 사라지지 않고 다시 정상 이동하며, `bar_repair` 카드 선택 시 `maxLives`가 6으로 증가하고 `lives`가 6으로 100% 회복됨을 검증한다.
     - `lucky_drop` 카드 선택 시 `getLuckyDropMultiplier()`가 `1 ➔ 2 ➔ 3 ➔ 4`로 증가하고 `dropRng` 주입 시 4% ➔ 8% ➔ 12% ➔ 16% 확률로 아이템이 스폰됨을 검증한다.
     - Wave 5 보스가 `10.0m` 지점에서 멈추어 방어선을 뚫지 않으며, `spawnBossMinionWave`로 부하들이 소환되고, 보스 처치 시 남은 부하들과 상관없이 즉시 `gamePhase === 'VICTORY'`가 됨을 검증한다.
  3. Error & Exception Handling: 카드 스폰 후 800ms 면역 딜레이(`now + 900`) 이후 사격하여 선택 처리한다.
  4. State Transition & Return: 모든 테스트 케이스 통과.

## Acceptance Criteria
- [ ] 전투 중 웨이브별 목표 킬 수(10/14/18/20/15킬) 달성 시 즉시 3D 보상 카드 3장이 스폰되고, 카드 선택 전까지 필드 위 모든 몬스터의 이동과 스폰이 일시정지(Freeze)된다.
- [ ] 몬스터 처치 시 기본 4% 확률로 사격형 아이템이 스폰되며, `lucky_drop` 카드 중첩에 따라 드롭 배율이 2배(8%), 3배(12%), 4배(16%)로 증가한다.
- [ ] `bar_repair` 보상 카드는 방어선 최대 체력을 +1 확장하고 체력을 100% 전체 회복시키며, 일반 `bar_repair` 드롭 아이템은 체력을 +1만 회복시킨다.
- [ ] Wave 5 보스는 전방 10.0m에서 멈춰 서며, 주기적/체력 비례로 탭 레버 소환 액션(`isBossSummoning() === true`)과 함께 부하 미니웨이브를 소환하고, 보스 처치 시 남은 몬스터와 무관하게 즉시 `VICTORY`가 된다.

## Validation
- `npm test -- tests/gameplay-polish.test.ts tests/engine-judgment-and-spawn.test.ts` — 모든 테스트 통과

## Commit Message
```text
feat(engine): add kill-gauge reward cards with combat freeze, item drop passive, and boss mini-waves

Plan: 2026-11-04-combat-roguelike-boss-overhaul
Phase: P01-core-combat-and-roguelike-engine
Task: T02-kill-gauge-cards-item-drop-and-boss-summon

- Trigger 3D reward cards on wave kill thresholds and freeze active monsters while cards are pending
- Spawn shootable item drops on monster kills (4% base, 2x/3x/4x with lucky_drop passive card)
- Upgrade bar_repair reward card to full heal + +1 maxLives
- Stop Wave 5 cooler boss at 10m, summon minion mini-waves on tap lever action, and trigger instant victory on boss kill
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
