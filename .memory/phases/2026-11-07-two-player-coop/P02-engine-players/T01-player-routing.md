# Task: T01 사격·스킬·피버·처치 점수를 playerIndex로 라우팅

## Status: pending

## Goal
엔진의 모든 입력 진입점이 `playerIndex`(기본 0)를 받고, 그 플레이어의 무기·피버·버프로 판정하며, 처치·명중 점수·사격 통계·처치 수가 "쏜 사람"에게 쌓이게 한다. 지연 처치(리볼버 관통, 칼날, 거품, 한맥 폭발)도 원래 쏜 사람에게 귀속된다. 2인 판에서 점수·콤보가 개인별로 집계되는 핵심(D02, D03)이다.

## Decision Summary
- 시그니처 끝에 `playerIndex: PlayerIndex = 0`을 추가해 1인 호출부(PC 페이지·튜토리얼·샌드박스·봇 스크립트)는 그대로 동작한다.
- D17: 파워샷·와이드 스코프는 아이템을 맞힌 사람 맵에만, 아이스 프리즈는 모든 플레이어 맵에 넣는다. 바 수리 아이템은 팀 목숨.
- 행운 카드(`luckyDropStacks`)는 개인 스택이고, 드롭 확률은 **처치한 사람**의 배율을 쓴다.
- 웨이브 시간 보너스는 팀 결과이지만 점수가 개인별이므로 **활성 플레이어 모두에게 같은 금액**을 더한다(P02-T04 이후 이탈자 포함, 판에 참여한 전원).

## Implementation

### I01. 진입점 시그니처

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `shootAt`, `shootAtInner`, `shootCardSelect`, `triggerWeaponSkill`, `runWeaponSkill`, `activateFever`, `triggerSandboxFever`, `isBuffActive`, `getActiveBuffs`, `activateItemBuff`, `applyRewardCard`, `buildRewardCardPool`, `drawRewardCards`, `computeTargetAimCoords`, `getLuckyDropMultiplier`, `getNextLuckyDropMultiplier`, `getScoreBreakdown`, `getPrecisionStats`, `getPassiveCardStacks`; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `EngineShootResult`, `SkillExecuteResult`, `SkillBlade`, `SkillFoamWave`, `SkillHitEvent` — 결과에 주인 표시; modify

#### Details
- **Signatures & Types**:
  ```typescript
  public shootAt(aimX: number, aimY: number, nowMs: number, source: ShotSource = 'press', playerIndex: PlayerIndex = 0): EngineShootResult;
  public triggerWeaponSkill(nowMs: number, playerIndex: PlayerIndex = 0): SkillExecuteResult;
  public activateFever(nowMs: number, playerIndex: PlayerIndex = 0): boolean;
  public triggerSandboxFever(nowMs: number, playerIndex: PlayerIndex = 0): boolean;
  public isBuffActive(kind: ItemBuffKind, nowMs?: number, playerIndex: PlayerIndex = 0): boolean;
  public getActiveBuffs(nowMs?: number, playerIndex: PlayerIndex = 0): ActiveBuffState[];
  public activateItemBuff(kind: ItemBuffKind, nowMs: number, playerIndex: PlayerIndex = 0): void;
  public applyRewardCard(cardKind: RewardCardKind, nowMs: number, playerIndex: PlayerIndex = 0): void;
  public buildRewardCardPool(playerIndex: PlayerIndex = 0): RewardCardKind[];
  public computeTargetAimCoords(target: ActiveTargetEntity, wideScopeMult = 1.0, playerIndex: PlayerIndex = 0): TargetAimProjection; // hit_zone_up 스택을 그 플레이어 것으로
  public getLuckyDropMultiplier(playerIndex: PlayerIndex = 0): number;
  public getNextLuckyDropMultiplier(playerIndex: PlayerIndex = 0): number;
  public getScoreBreakdown(playerIndex: PlayerIndex = 0): { total; timeBonus; precisionBonus; levelBonus; base };
  public getPrecisionStats(playerIndex: PlayerIndex = 0): { shots; ratio; bonus; applied };
  public getPassiveCardStacks(playerIndex: PlayerIndex = 0): PassiveCardStack[];

  // 결과·투사체에 주인 추가
  interface EngineShootResult { /* 기존 필드 */ playerIndex: PlayerIndex; }
  interface SkillExecuteResult { /* 기존 필드 */ playerIndex: PlayerIndex; }
  interface SkillBlade { /* 기존 */ ownerIndex: PlayerIndex; }
  interface SkillFoamWave { /* 기존 */ ownerIndex: PlayerIndex; }
  interface SkillHitEvent { /* 기존 */ ownerIndex: PlayerIndex; }
  // pendingHanmacBlasts 원소: { x: number; z: number; ownerIndex: PlayerIndex }
  ```
  `EngineShootResult`를 만드는 모든 `return { … }`(fired:false 포함)에 `playerIndex`를 넣는다. 타입을 필수로 두면 tsc가 빠진 곳을 모두 알려 준다.

### I02. 귀속 규칙(내부 로직)

- **Execution Flow / Logic**:
  1. `shootAt`: `const p = this.getPlayer(playerIndex)`. 통계는 `p.shotStats[...] += 1`.
  2. `shootAtInner`/`shootCardSelect`: `this.scoreManager`·`this.weaponSystem`·`this.cardStacks`·`isBuffActive(...)` 사용처를 전부 `p.scoreManager`·`p.weaponSystem`·`p.cardStacks`·`isBuffActive(kind, nowMs, playerIndex)`로 바꾼다. `computeTargetAimCoords(target, wideScopeMult, playerIndex)`.
  3. 처치 귀속: `handleMonsterKilled(target, nowMs, killerIndex: PlayerIndex)`로 시그니처 변경. 내부 드롭 확률은 `this.getLuckyDropMultiplier(killerIndex)`. `cardKillCount`는 팀 공용 그대로.
  4. `applySkillDamage(monster, damage, nowMs, ownerIndex: PlayerIndex)`: `registerHit`·`totalKills`를 `getPlayer(ownerIndex)`에, `handleMonsterKilled(..., ownerIndex)`.
  5. 리볼버 관통 처치: 쏜 사람 `p`에게 `totalKills`, `registerHit`, `handleMonsterKilled(rear, nowMs, playerIndex)`.
  6. `runWeaponSkill(nowMs, playerIndex)`: 블레이드·거품 생성 시 `ownerIndex: playerIndex`, 샷건 즉발 피해는 `applySkillDamage(..., playerIndex)`. `advanceSkillBlades`/`advanceSkillFoam`은 `blade.ownerIndex`/`wave.ownerIndex`로 `applySkillDamage`와 투사체 요격 점수(`registerHit('PERFECT', t.killBonusScore, true)`가 있는 줄)를 그 플레이어에게. `pushSkillHitEvent`에 `ownerIndex`.
  7. 한맥: `handleMonsterKilled`에서 `pendingHanmacBlasts.push({ x, z, ownerIndex: killerIndex })`; `processHanmacBlasts`는 `applySkillDamage(t, blastDamage, nowMs, blast.ownerIndex)`, 이벤트 `ownerIndex: blast.ownerIndex`.
  8. 아이템: 처치한 사람 `p.itemsCollected += 1; this.activateItemBuff(kind, nowMs, playerIndex)`. `activateItemBuff`: `bar_repair` → 팀 `healLives(1)`; `ice_freeze` → `for p of players: p.buffUntilMs.set(...)`; 나머지 → 그 플레이어 맵만.
  9. 황금 캔: 쏜 사람의 `weaponSystem.addSkillStock`, `scoreManager.addFeverGauge`, `registerHit`.
  10. `update()`: 만료 버프 정리, `weaponSystem.update(nowMs, p.scoreManager.getState().isFeverActive, dtMs)`, `scoreManager.updateFeverTimer(nowMs)`를 `for (const p of this.players)` 루프로. 반환 `reloadedJustNow`는 `reloadedByPlayer: boolean[]`도 함께 돌려주고(`reloadedJustNow`는 any-of로 유지) 화면이 플레이어별 장전음을 낼 수 있게 한다.
  11. `isBuffActive('ice_freeze', nowMs)`를 몬스터 감속에 쓰는 곳(`update` 내 `isIceFreeze`, `GameCanvas3D`)은 `players.some(p => …)` 의미가 되도록 `isTeamBuffActive(kind, nowMs): boolean`(아무 플레이어 맵에서 유효하면 true)을 추가해 그쪽으로 바꾼다.
  12. 웨이브 시간 보너스 `awardWaveTimeBonus`: 금액 계산 1회 → `for p of players: const paid = p.scoreManager.addBonusScore(amount); p.waveTimeBonusTotal += paid; p.waveClears.push({ wave, seconds, bonus: paid })`. `lastWaveClear`(팀)는 `bonus: amount`.
  13. `declareVictory`: 정밀·레벨 보너스를 `for p of players`로 각자 계산(`getScoreBreakdown(p.index)`, 그 플레이어 무기 레벨).
  14. `applyRewardCard(card, nowMs, playerIndex)`: 모든 효과를 그 플레이어에게. `bar_repair`만 팀 `healLives`.
  15. 엔진 사건(P01-T03 `targetKilled`·`skillUsed`·`feverStarted`·`feverEnded`)에 실제 `playerIndex`를 담는다.
  16. P01-T05 처리부의 엔진 호출(`shootAt`, `triggerWeaponSkill`, `activateFever`)에 `ctx.playerIndex`를 넘긴다(그 Task 시점엔 인자가 없어 생략했던 부분).

### I03. 2인 라우팅 테스트

- Related Files:
  - `tests/coop-player-routing.test.ts` :: `describe('coop routing')`; new

#### Details
테스트 준비: `engine.players = [new PlayerCombatState(0), new PlayerCombatState(1)]`로 직접 2인 구성(P02-T02 전이라 `startGame` 옵션 없음), `engine.startGame()`은 `players` 전체를 reset하므로 이후 `engine.isWeaponSelectPending = false; players.forEach(p => p.weaponSystem.selectWeapon('revolver', 1))`.
- 2P가 쏜 PERFECT 처치 → `players[1].scoreManager.getState().totalScore > 0`, `players[0]` 0. `players[1].shotStats.PERFECT === 1`.
- 2P 리볼버 Lv.3 관통 처치 → 뒤 표적 처치 수도 2P `totalKills`.
- 2P 칼날 스킬(`triggerWeaponSkill(now, 1)`, 스킬 스톡을 `addSkillStock(1)`로 준비) → `update`로 칼날 진행 후 처치 점수 2P.
- 2P가 처치한 한맥 폭발로 죽은 이웃 → 2P `totalKills`.
- 2P가 파워샷 아이템 처치 → `isBuffActive('power_shot', now, 1)` true, `(…, 0)` false. 아이스 프리즈 → 두 플레이어 모두 true.
- 1P 행운 3스택, 2P 0스택, `dropRng = () => 0.05`: 2P 처치는 드롭 없음(0.04×1), 1P 처치는 드롭(0.04×4=0.16).
- 웨이브 시간 보너스: 웨이브 종료 시 두 플레이어 `waveTimeBonusTotal`이 같고 > 0.
- `activateFever(now, 1)`은 2P 게이지만 소모.

## Acceptance Criteria
- [ ] `grep -n "this\.scoreManager\|this\.weaponSystem\|this\.cardStacks\|this\.luckyDropStacks" src/pc/engine/BeerCrusherEngine.ts` 결과가 위임 getter 정의와 튜토리얼·샌드박스 전용 코드뿐이다.
- [ ] 기존 테스트 전부 통과, 새 테스트 통과.

## Validation
- `npx vitest run tests/coop-player-routing.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
feat(engine): route shots, skills and kills to the acting player

Plan: 2026-11-07-two-player-coop
Phase: P02-engine-players
Task: T01-player-routing

- shootAt/triggerWeaponSkill/activateFever/applyRewardCard take playerIndex (default 0)
- Pierce, blade, foam and hanmac-blast kills credit their owner; lucky drop uses the killer's stacks
- Power shot and wide scope are personal, ice freeze is team-wide; wave time bonus goes to every player

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
