# Task: T01 칼날 수치와 엔진 판정

## Status: done

## Goal
리볼버 스킬이 필드 전체 즉시 피해 + 둔화 대신, 엔진이 관리하는 칼날을 부채꼴로 날려 닿은 대상만 맞히게 한다. 화면 연출은 다음 Task에서 얹으므로, 이 Task 완료 시점에는 기존 부메랑이 그대로 보인다.

## Decision Summary
- 결정 D01~D04, D06, D11, D12. 칼날 3 / 3 / 5 / 7개, 관통 0 / 1 / 1 / 2, 피해는 평타 GREAT와 같게, 보스 2 / 2.5 / 3 / 3.5.
- 위치는 `dtSec`로 전진시킨다. 카드 선택과 일시 정지 때 `update`가 일찍 끝나므로 칼날도 자동으로 멈추고, `freezeTimers`에 넣을 게 없다.

## Implementation

### I01. 수치와 타입
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.skills`(new); modify
  - `src/shared/types.ts` :: `WeaponLevelSpec`; modify
  - `src/shared/constants.ts` :: `BASE_WEAPON_ARCHETYPE_SPECS`, `applyWeaponTuning`, 리볼버 `descriptionKo`·`skillNameKo`·둔화 값; modify

#### Details
- **`gameTuning.ts`** (`weaponDamageScale` 아래에 추가):
  ```typescript
  /** 리볼버 '오프너 참격' 수치. 칼날 피해는 평타 GREAT 한 발과 같아 무기 표에서 자동으로 맞춘다. */
  skills: {
    blade: {
      countByLevel: { 1: 3, 2: 3, 3: 5, 4: 7 },
      pierceByLevel: { 1: 0, 2: 1, 3: 1, 4: 2 },
      bossDamageByLevel: { 1: 2, 2: 2.5, 3: 3, 4: 3.5 },
      /** 칼날 좌우 절반 폭. 맞는 조건은 횡거리 <= halfWidthM + hitRadiusM. 화면 폭도 이 값으로 그린다. */
      halfWidthM: 0.7,
      speedMps: 40,
      startRadiusM: 3,
    },
  },
  ```
- **`types.ts`**: `WeaponLevelSpec`에 `skillBladeCount: number;`, `skillBladePierce: number;`를 추가한다.
- **`constants.ts`**:
  ```typescript
  type BaseWeaponLevelSpec = Omit<WeaponLevelSpec, 'skillBladeCount' | 'skillBladePierce'>;
  type BaseWeaponArchetypeSpec = Omit<WeaponArchetypeSpec, 'levels'> & { levels: Record<WeaponLevel, BaseWeaponLevelSpec> };
  const BASE_WEAPON_ARCHETYPE_SPECS: Record<WeaponKind, BaseWeaponArchetypeSpec> = { ... };
  function applyWeaponTuning(base: Record<WeaponKind, BaseWeaponArchetypeSpec>): Record<WeaponKind, WeaponArchetypeSpec>
  ```
  `applyWeaponTuning`의 레벨 객체를 아래처럼 바꾼다.
  ```typescript
  const damagePerHit = Number((b.damagePerHit * GAME_TUNING.weaponDamageScale[kind]).toFixed(3));
  const blade = GAME_TUNING.skills.blade;
  levels[lv] = {
    ...b,
    skillCooldownMs: GAME_TUNING.skillCooldownMsByLevel[lv],
    fireIntervalMs: Math.round(b.fireIntervalMs * GAME_TUNING.fire.intervalScale),
    reloadDurationMs: Math.round(b.reloadDurationMs * GAME_TUNING.fire.reloadScale),
    damagePerHit,
    maxAmmo: GAME_TUNING.maxAmmoByWeapon[kind][lv],
    skillBladeCount: kind === 'revolver' ? blade.countByLevel[lv] : 0,
    skillBladePierce: kind === 'revolver' ? blade.pierceByLevel[lv] : 0,
    ...(kind === 'revolver' ? { skillDamage: damagePerHit, skillBossDamage: blade.bossDamageByLevel[lv] } : {}),
  };
  ```
  표 머리 주석(188행)에 "리볼버 skillDamage·skillBossDamage도 덮어쓴다"를 덧붙인다.
- 리볼버 4개 레벨: `skillNameKo: '오프너 참격'`, `skillSlowRatio: 0`, `skillSlowMs: 0`. 리볼버 `descriptionKo: '초정밀 일직선 관통 탄환과 부채꼴 칼날'`.

### I02. 엔진 칼날
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `SkillBlade`(new), `SkillHitEvent`(new), `SkillExecuteResult`, `activeSkillBlades`(new), `drainSkillHitEvents`(new), `getSkillFanHalfRangeRad`(new), `clearSkillProjectiles`(new), `advanceSkillBlades`(new), `update`, `triggerWeaponSkill`, `startGame`, `startWave`, `startTutorialMode`, `startSandboxMode`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface SkillBlade {
    id: string;
    thetaRad: number;
    /** 칼날 앞면의 거리. */
    radiusM: number;
    /** 남은 타격 수(관통 + 1). 포탄은 줄이지 않는다. */
    hitsLeft: number;
    hitTargetIds: Set<string>;
    /** 시전 시점에 고정한 피해. 날아가는 도중 카드를 받아도 이 칼날의 피해는 바뀌지 않는다. */
    damage: number;
    bossDamage: number;
  }

  export type SkillHitSource = 'blade' | 'foam';

  export interface SkillHitEvent {
    source: SkillHitSource;
    target: ActiveTargetEntity;
    killed: boolean;
    /** 대왕 쉴드에 막혔다. */
    blocked: boolean;
  }

  // SkillExecuteResult에 bladeCount?: number 추가
  public activeSkillBlades: SkillBlade[] = [];
  private skillHitEvents: SkillHitEvent[] = [];
  private skillEntityCounter = 0;
  public drainSkillHitEvents(): SkillHitEvent[]; // 돌려주고 비운다
  public getSkillFanHalfRangeRad(): number; // computeHorizontalHalfFovRad(this.vFovDeg, this.aspect) * STAGE_CONSTANTS.FAN_MARGIN_RATIO
  private clearSkillProjectiles(): void; // activeSkillBlades, skillHitEvents 비움
  private pushSkillHitEvent(event: SkillHitEvent): void; // 길이 128을 넘으면 앞에서 버린다
  ```
- **Execution Flow / Logic**:
  1. `triggerWeaponSkill` 리볼버 분기 전체를 교체한다. 활성 몬스터를 순회하지 않고 칼날만 만든다.
     ```typescript
     const range = this.getSkillFanHalfRangeRad();
     const count = levelSpec.skillBladeCount;
     const bonus = this.weaponSystem.getDamageBonusMultiplier();
     for (let i = 0; i < count; i++) {
       this.skillEntityCounter += 1;
       this.activeSkillBlades.push({
         id: `blade_${this.skillEntityCounter}`,
         thetaRad: -range + ((2 * i + 1) * range) / count,
         radiusM: GAME_TUNING.skills.blade.startRadiusM,
         hitsLeft: levelSpec.skillBladePierce + 1,
         hitTargetIds: new Set(),
         damage: Number((levelSpec.skillDamage * bonus).toFixed(3)),
         bossDamage: Number((levelSpec.skillBossDamage * bonus).toFixed(3)),
       });
     }
     return { activated: true, weaponKind, weaponLevel, affectedTargets: [], bladeCount: count };
     ```
  2. `advanceSkillBlades(nowMs, dtSec)`:
     ```typescript
     const { speedMps, halfWidthM } = GAME_TUNING.skills.blade;
     const maxRadiusM = STAGE_CONSTANTS.SPAWN_RADIUS_M + 1;
     for (let b = this.activeSkillBlades.length - 1; b >= 0; b--) {
       const blade = this.activeSkillBlades[b];
       blade.radiusM += speedMps * dtSec;
       const candidates = this.activeTargets
         .filter((t) =>
           !t.isItem && !t.weaponSelectKind && !t.rewardCardKind && !t.isGoldenCan &&
           this.isTargetLanded(t, nowMs) &&
           !blade.hitTargetIds.has(t.id) &&
           t.radiusM <= blade.radiusM &&
           Math.cos(t.thetaRad - blade.thetaRad) > 0 &&
           Math.abs(t.radiusM * Math.sin(t.thetaRad - blade.thetaRad)) <= halfWidthM + t.hitRadiusM)
         .sort((a, c) => a.radiusM - c.radiusM);
       for (const t of candidates) {
         if (!this.activeTargets.includes(t)) continue; // 보스 처치가 필드를 비울 수 있다
         if (t.isProjectile) {
           this.activeTargets.splice(this.activeTargets.indexOf(t), 1);
           this.scoreManager.registerHit('PERFECT', t.killBonusScore, true);
           this.pushSkillHitEvent({ source: 'blade', target: t, killed: true, blocked: false });
           continue;
         }
         if (blade.hitsLeft <= 0) continue; // 남은 포탄은 계속 벤다
         blade.hitsLeft -= 1;
         blade.hitTargetIds.add(t.id);
         const blocked = Boolean(t.isShielded);
         const killed = this.applySkillDamage(t, t.kind === 'boss' ? blade.bossDamage : blade.damage, nowMs);
         this.pushSkillHitEvent({ source: 'blade', target: t, killed, blocked });
         if (this.gamePhase === 'VICTORY') { this.activeSkillBlades.length = 0; return; }
       }
       if (blade.hitsLeft <= 0 || blade.radiusM > maxRadiusM) this.activeSkillBlades.splice(b, 1);
     }
     ```
  3. `update`에서 `this.updateKingShield();` 바로 뒤에 넣는다.
     ```typescript
     this.advanceSkillBlades(nowMs, dtSec);
     if (this.gamePhase === 'VICTORY') {
       return { breaches: [], phaseChanged: true, reloadedJustNow: false };
     }
     ```
  4. `startGame`, `startWave`, `startTutorialMode`, `startSandboxMode`에서 `this.clearSkillProjectiles()`를 호출한다.
- **함정**:
  - 맞는 조건은 `t.radiusM <= blade.radiusM`이다. 프레임마다 앞면이 약 0.67m 움직이고 긴 프레임은 더 움직이므로, "이번 프레임에 지나갔는지"로 판정하면 놓칠 수 있다. 출발 지점(3m)보다 가까운 몬스터도 이 조건으로 첫 프레임에 맞는다.
  - `hitTargetIds`에 포탄은 넣지 않는다. 포탄은 맞으면 바로 사라지므로 필요 없다.
  - `applySkillDamage`는 P01-T03에서 만든 함수다. 대왕 쉴드면 false를 돌려주며, 그 타격도 관통 수를 쓴다(D11).
  - `handleMonsterKilled`가 `activeTargets = []`로 필드를 비울 수 있으므로 `includes` 검사를 뺄 수 없다.
  - 스킬 처치는 정밀도 보너스 발사 수에 넣지 않는다(`shotStats`를 건드리지 않는다).

### I03. 테스트
- Related Files:
  - `tests/skill-blade.test.ts` — 새 테스트; new
  - `tests/engine-judgment-and-spawn.test.ts` :: 3종 스킬 테스트 리볼버 부분(626~631행); modify

#### Details
- 공통 준비: `startGame({ withWeaponSelect: false })`, `startWave(6)`, `(engine as any).spawnedInWave = 999`, `(engine as any).goldenCanSpawnedInWave = true`. 대상은 `speedMps: 0`, `hp: 99`로 만들고 `hitRadiusM`은 `TARGET_SPECS`에서 읽는다. `tick(n)`은 `engine.update(now += 16, 0.016)`를 n번 부른다. 한맥은 거리 12m 이상으로 두어 발사를 피한다.
- 케이스:
  - Lv.1 시전 직후 칼날 3개, 방향은 `-2/3 × 범위`, `0`, `+2/3 × 범위`이고 대상 체력은 그대로다.
  - 정면 12m 대상: 10틱 뒤 체력 그대로, 20틱 뒤 1.0 감소. `slowUntilMs`는 undefined.
  - 칼날 사이 대상(`thetaRad: 0.19`, 16m)은 맞지 않는다.
  - 관통: 정면 8·10·12m에 세 마리. Lv.1은 8m만, Lv.2는 8·10m, Lv.4는 세 마리 모두.
  - 여러 칼날: Lv.4 정면 5m 대상은 칼날 3개에 맞아 체력이 `3 × 2.2` 줄어든다.
  - 보스 피해: 정면 보스 Lv.1 체력 2 감소. `addDamageBonus(0.3)` 후 시전하면 2.6, 일반 몬스터는 1.3.
  - 포탄: `spawnMonsterProjectile(now, 'hanmac', { thetaRad: 0, radiusM: 8 })`와 정면 10m 몬스터, Lv.1. 포탄이 사라지고 점수가 오르며 몬스터도 맞는다.
  - 올린 오비 방패를 뚫는다. 대왕 쉴드(`isShielded: true`)는 피해가 없고 뒤 몬스터도 안 맞으며(Lv.1), 이벤트 `blocked: true`.
  - 아이템, 황금 캔, 카드, 착지 전 부하(`dropLandAtMs`)는 맞지 않는다.
  - `isRewardCardPending = true`면 `update` 후 칼날 거리가 그대로다.
  - 큰 병맥주를 죽이면 분열한다.
  - 마지막 보스 처치(`startWave(7)`, `isBossEncounterActive = true`, 체력 1)로 `VICTORY`가 되고 칼날이 비워진다.
  - `drainSkillHitEvents`가 이벤트를 돌려주고 비운다. `startWave`가 칼날을 비운다.
- 기존 테스트 교체:
  ```typescript
  // 2. Revolver skill: 오프너 참격 (fan blades, damage on contact)
  engine.weaponSystem.selectWeapon('revolver', 1);
  const revSkill = engine.triggerWeaponSkill(3000);
  expect(revSkill.activated).toBe(true);
  expect(revSkill.bladeCount).toBe(3);
  expect(engine.activeSkillBlades.length).toBe(3);
  expect(m2.slowUntilMs).toBeUndefined();
  engine.activeSkillBlades = [];
  ```

## Acceptance Criteria
- [ ] 리볼버 스킬 시전 순간에는 체력이 줄지 않고, 칼날이 닿을 때 줄어든다.
- [ ] 칼날 수·관통·피해가 레벨별 표와 일치한다.
- [ ] 칼날이 포탄을 베고 관통 수를 쓰지 않는다.
- [ ] 카드 선택 중 칼날이 멈춘다.

## Validation
- `npx vitest run tests/skill-blade.test.ts tests/engine-judgment-and-spawn.test.ts tests/card-select-gate.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과
- `npx tsx .memory/references/scripts/simulate-current-decisions.ts 40 revolver 보통` — 끝까지 돌고 클리어율이 크게 무너지지 않는다

## Commit Message
```text
feat(revolver): replace the skill with fan blades that hit on contact

Plan: 2026-11-05-weapon-skill-rework
Phase: P02-revolver-blades
Task: T01-blade-engine

- engine-owned blades advance with dtSec and freeze with the game clock
- 3/3/5/7 blades, pierce 0/1/1/2, damage equal to a GREAT shot
- blades cut enemy shells without using pierce
- remove the revolver skill slow
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
