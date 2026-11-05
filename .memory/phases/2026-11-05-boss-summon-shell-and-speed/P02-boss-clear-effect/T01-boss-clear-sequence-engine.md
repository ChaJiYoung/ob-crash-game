# Task: T01 엔진 보스 처치 시퀀스

## Status: pending

## Goal
마지막 보스가 죽으면 즉시 필드를 비우고 카드/승리로 넘어가는 대신, 1.5초 시퀀스를 엔진이 관리한다: 남은 몬스터가 0.1초 간격으로 연쇄로 사라지고, 끝나면 카드(3·5웨이브) 또는 승리(7웨이브)로 넘어간다.

## Decision Summary
- 결정 D10. 시퀀스 중에는 사격·스킬을 막고, 소환·포격·스폰·몬스터 이동을 멈춘다. 시계는 흐른다(쿨다운·피버·장전). 시간 보너스는 보스 처치 시점에 정산한다.

## Implementation

### I01. 설정과 상태
- Related Files:
  - `src/shared/gameTuning.ts` :: `boss.clear`(new); modify
  - `src/pc/engine/BeerCrusherEngine.ts`; modify

#### Details
- **gameTuning.ts** (`boss` 블록): 
  ```typescript
  /** 마지막 보스를 잡은 뒤 연출 시간. 이 동안 남은 몬스터가 cascadeGapMs 간격으로 연쇄로 터진다. */
  clear: { durationMs: 1500, cascadeGapMs: 100 },
  ```
- **Signatures & Types** (엔진):
  ```typescript
  export type BossClearEvent =
    | { type: 'defeated'; x: number; z: number; y: number }
    | { type: 'cascade'; target: ActiveTargetEntity };

  private bossClearUntilMs = 0;
  private bossClearNextCascadeMs = 0;
  private bossClearEvents: BossClearEvent[] = [];
  public isBossClearSequence(): boolean { return this.bossClearUntilMs > 0; }
  /** 화면 배너용: 시퀀스가 끝나는 게임 시각. 0이면 없음. */
  public getBossClearUntilMs(): number { return this.bossClearUntilMs; }
  public drainBossClearEvents(): BossClearEvent[];
  private startBossClearSequence(boss: ActiveTargetEntity, nowMs: number): void;
  private advanceBossClear(nowMs: number, dtSec: number): void;
  ```
- **startBossClearSequence**:
  1. `this.isBossEncounterActive = false; this.bossEncounterStartMs = null;`
  2. `this.awardWaveTimeBonus(nowMs);` (모든 웨이브에서. 이미 정산됐으면 무시된다)
  3. `activeTargets`에서 아이템·황금 캔·포탄·카드·무기 선택 대상을 즉시 제거한다. 일반 몬스터는 그대로 둔다(연쇄 대상). `clearSkillProjectiles()`로 칼날·거품을 비운다.
  4. `this.bossClearUntilMs = nowMs + GAME_TUNING.boss.clear.durationMs; this.bossClearNextCascadeMs = nowMs + GAME_TUNING.boss.clear.cascadeGapMs;`
  5. 이벤트 `{ type: 'defeated', x: boss.x, z: boss.z, y: baseY }`를 쌓는다(`y`는 `boss.customBaseY ?? getTargetBaseY('boss')`).
- **advanceBossClear(nowMs, dtSec)**: 
  1. `this.weaponSystem.update(nowMs, feverActive, dtSec * 1000)`와 `this.scoreManager.updateFeverTimer(nowMs)`를 호출한다(쿨다운·피버 시계가 계속 흐르도록).
  2. `nowMs >= bossClearNextCascadeMs`이면 필드의 일반 몬스터(`!isItem && !isProjectile && !isGoldenCan`) 중 방어선에 가장 가까운(`radiusM` 오름차순) 한 마리를 `activeTargets`에서 빼고 `{ type: 'cascade', target }` 이벤트를 쌓는다. 같은 호출에서 여러 마리를 처리하지 않고, 간격은 `bossClearNextCascadeMs += cascadeGapMs`로 민다(프레임이 길면 다음 호출에서 따라잡도록 `while`이 아니라 한 마리씩).
  3. `nowMs >= bossClearUntilMs`이면 남은 몬스터를 모두 제거(이벤트 없이)하고 시퀀스를 끝낸다: `bossClearUntilMs = 0`. 7웨이브(`currentWave >= STAGE_CONSTANTS.TOTAL_WAVES`)면 `declareVictory()`를 부르고 `update`가 `phaseChanged: true`를 돌려주게 한다. 3·5웨이브는 다음 `update`의 기존 `miniWaveDone` 분기가 카드를 낸다(`activeTargets`가 비고 `bossSpawned`가 true이며 `bossAlive`가 false).
- **점수·드롭·분열·킬 카운트 없음**: 연쇄 대상에는 `registerHit`, `handleMonsterKilled`, `killedInWave`를 호출하지 않는다.

### I02. 연결
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `handleMonsterKilled`, `update`, `shootAt`, `triggerWeaponSkill`, `activateFever`, `freezeTimers`, `advanceSkillBlades`, `advanceSkillFoam`, `startGame`, `startWave`, `startTutorialMode`, `startSandboxMode`, `declareVictory`; modify

#### Details
- **`handleMonsterKilled` 보스 분기** 교체:
  ```typescript
  if (target.kind === 'boss') {
    if (this.getBossEntities().length > 0) return; // other bosses remain
    this.startBossClearSequence(target, nowMs);
    return;
  }
  ```
  기존의 `isBossEncounterActive = false`, `bossEncounterStartMs = null`, `activeTargets = []`, `isRewardCardPending = false`, `declareVictory()`는 시퀀스 시작/종료 쪽으로 옮겨졌다. `awardWaveTimeBonus` 호출도 `startBossClearSequence`로 옮긴다(여기서 지운다).
- **`update`**: `this.updateGuards(nowMs);` 바로 앞(= `waveStartMs` 설정 뒤)에 넣는다.
  ```typescript
  if (this.bossClearUntilMs > 0) {
    this.advanceBossClear(nowMs, dtSec);
    return { breaches: [], phaseChanged: this.gamePhase === 'VICTORY', reloadedJustNow: false };
  }
  ```
  카드 선택 중 시간 정지(`isCardSelectPending`)는 시퀀스 중에는 발생하지 않는다(카드가 없다).
- **입력 차단**: `shootAt` 맨 앞에서 `if (this.bossClearUntilMs > 0) return { fired: false, grade: 'MISS' };`, `triggerWeaponSkill`에서 `if (this.isCardSelectPending || this.bossClearUntilMs > 0 || !consumeSkill)`가 되게(소모하기 전에 막는다), `activateFever`도 시퀀스 중에는 `false`를 돌려준다.
- **VICTORY 검사 대체**: `triggerWeaponSkill`, `advanceSkillBlades`, `advanceSkillFoam`, `update`의 칼날·거품 직후 `(this.gamePhase as GamePhase) === 'VICTORY'` 검사는 `|| this.bossClearUntilMs > 0`도 포함한다(보스가 죽은 직후 남은 칼날·거품이 나머지 몬스터를 더 때리지 않게 하고 목록을 비운다).
- **`freezeTimers`**: `if (this.bossClearUntilMs > 0) { this.bossClearUntilMs += deltaMs; this.bossClearNextCascadeMs += deltaMs; }` (일시 정지와 같은 방식).
- **초기화**: `startGame`, `startWave`, `startTutorialMode`, `startSandboxMode`, `exitTutorialMode`, `exitSandboxMode`에서 `bossClearUntilMs = 0`, `bossClearNextCascadeMs = 0`, `bossClearEvents = []`.
- **`declareVictory`**는 지금처럼 정밀도 보너스를 정산한다(시퀀스 뒤에 호출되므로 정밀도 보너스가 연출 뒤에 반영된다).
- **함정**: `update`가 `phaseChanged: true`를 돌려줘야 PC 페이지가 결과 화면으로 넘어가는 기존 흐름(`PCGamePage`가 `gamePhase`를 폴링하는지 확인)이 동작한다. `GAMEOVER`(방어선 돌파)는 시퀀스 중 일어나지 않는다(몬스터가 멈춰 있고 이동 코드를 건너뛴다). `boss-encounters.test.ts`처럼 보스 처치 직후 `VICTORY`를 기대하는 테스트는 시퀀스 길이만큼 `update`를 더 돌려야 한다.

### I03. 테스트
- Related Files:
  - `tests/boss-clear-sequence.test.ts` — 새 테스트; new
  - `tests/boss-encounters.test.ts`, `tests/skill-blade.test.ts`, `tests/skill-foam.test.ts`, `tests/boss-minion-drop.test.ts`, `tests/monster-traits.test.ts`; modify (처치 직후 VICTORY·카드 기대 부분)

#### Details
- 헬퍼 `finishBossFight(engine, now)`: 시퀀스 길이(`durationMs + 200`)만큼 16ms 간격으로 `update`한다. 기존 테스트에서 보스를 죽인 뒤 곧바로 결과를 검사하던 곳에 이 헬퍼를 끼운다.
- 새 케이스:
  - 3웨이브 보스를 죽이면 `isBossClearSequence()`가 true이고, 아직 카드(`isRewardCardPending`)는 없다. 필드의 몬스터는 남아 있다.
  - `update`를 100ms 간격으로 돌리면 몬스터가 한 마리씩 줄고, `drainBossClearEvents()`가 `defeated` 1개와 `cascade` N개를 돌려준다. 점수는 연쇄로 오르지 않는다.
  - 시퀀스 중 `shootAt`은 `fired: false`, `triggerWeaponSkill`은 `activated: false`이고 스킬 재고를 소모하지 않는다.
  - 1.5초 뒤 3웨이브는 다음 `update`에서 카드가 뜬다(`isRewardCardPending`).
  - 7웨이브(냉각기 2대 + 대왕)에서 마지막 한 마리를 죽이면 시퀀스 뒤 `gamePhase === 'VICTORY'`이고 그 전에는 `PLAYING`이다. 정밀도 보너스는 승리 뒤에 정산된다.
  - 냉각기 두 대 중 하나가 죽어도 시퀀스는 시작되지 않는다.
  - `setPaused`로 일시 정지했다가 풀면 시퀀스 남은 시간이 유지된다.
  - 시퀀스 중 쿨다운이 줄어든다(`skillCooldownRemainingMs` 감소).
  - 웨이브 클리어 시간 보너스가 보스 처치 시각 기준이다(`lastWaveClear.atMs`가 처치 시각).

## Acceptance Criteria
- [ ] 마지막 보스를 잡으면 남은 몬스터가 연쇄로 사라지고, 1.5초 뒤 카드 또는 승리가 된다.
- [ ] 시퀀스 중 사격·스킬이 막히고 점수가 오르지 않는다.
- [ ] 일시 정지·초기화·모드 전환 후 상태가 남지 않는다.

## Validation
- `npx vitest run tests/boss-clear-sequence.test.ts tests/boss-encounters.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
feat(boss): add an engine-owned boss clear sequence

Plan: 2026-11-05-boss-summon-shell-and-speed
Phase: P02-boss-clear-effect
Task: T01-boss-clear-sequence-engine

- the last boss starts a 1.5s sequence instead of wiping the field at once
- leftover monsters pop in a cascade without score, drops or splits
- shots, skills and fever are blocked during it; the clock keeps running
- cards or victory follow the sequence
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
