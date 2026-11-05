# Task: T01 거품 파도 판정과 미끄러짐

## Status: pending

## Goal
개틀링 스킬이 필드 전체를 쓸고 가는 파도가 되어, 앞면이 닿는 순간 피해와 둔화를 주고 몬스터를 뒤로 미끄러뜨린다. 멀리서도 밀렸다는 것이 보이도록 3~5m를 민다.

## Decision Summary
- 결정 D07, D08, D11. 밀기 3 / 3.5 / 4 / 5m, 피해 0.2 / 0.3 / 0.4 / 0.5, 보스 2 / 2.5 / 3 / 3.5. 둔화는 기존 값 유지. 부채꼴 제한 제거. 이름 "거품 해일".
- 칼날과 같은 방식이다. 위치는 `dtSec`로 전진하고 `SkillHitEvent`를 그대로 쓴다.

## Implementation

### I01. 수치와 타입
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.skills.foam`(new); modify
  - `src/shared/types.ts` :: `WeaponLevelSpec`; modify
  - `src/shared/constants.ts` :: 개틀링 표, `applyWeaponTuning`, 기본 표 타입; modify
  - `src/pc/three/ParticleEffects3D.ts` :: 이전 거품의 `spec.skillArcDeg`(726행); modify

#### Details
- **`gameTuning.ts`** (`skills.blade` 옆):
  ```typescript
  /** 개틀링 '거품 해일' 수치. 밀어내기 전용이라 피해는 낮다. 거품 수는 화면에만 쓰인다. */
  foam: {
    knockbackMByLevel: { 1: 3, 2: 3.5, 3: 4, 4: 5 },
    damageByLevel: { 1: 0.2, 2: 0.3, 3: 0.4, 4: 0.5 },
    bossDamageByLevel: { 1: 2, 2: 2.5, 3: 3, 4: 3.5 },
    countByLevel: { 1: 120, 2: 160, 3: 210, 4: 280 },
    speedMps: 24,
    startRadiusM: 2,
    /** 밀려나는 속도. 3m면 약 0.25초. */
    slideSpeedMps: 12,
  },
  ```
- **`types.ts`**: `skillArcDeg`를 지우고 `skillFoamCount: number;`를 추가한다.
- **`constants.ts`**:
  - 개틀링 4개 레벨의 `skillNameKo: '거품 해일'`. 세 무기 12곳의 `skillArcDeg:` 줄을 지운다.
  - `BaseWeaponLevelSpec`의 Omit에 `'skillFoamCount'`를 더한다.
  - `applyWeaponTuning`에 추가한다.
    ```typescript
    const foam = GAME_TUNING.skills.foam;
    // 레벨 객체 안
    skillFoamCount: kind === 'gatling' ? foam.countByLevel[lv] : 0,
    ...(kind === 'gatling'
      ? { skillDamage: foam.damageByLevel[lv], skillBossDamage: foam.bossDamageByLevel[lv], skillKnockbackM: foam.knockbackMByLevel[lv] }
      : {}),
    ```
  - 표 머리 주석에 "개틀링 skillDamage·skillBossDamage·skillKnockbackM도 덮어쓴다"를 덧붙인다.
- **`ParticleEffects3D.ts` 726행**: `tsc`가 깨지지 않게 이전 거품의 `const halfArc = ((spec.skillArcDeg / 2) * Math.PI) / 180;`를 `const halfArc = Math.PI / 4;`로 바꾼다. 이 분기는 다음 Task에서 지운다.

### I02. 엔진
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `ActiveTargetEntity`, `SkillFoamWave`(new), `SkillExecuteResult`, `activeSkillFoamWaves`(new), `advanceSkillFoam`(new), `clearSkillProjectiles`, `update`, `triggerWeaponSkill`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // ActiveTargetEntity에 추가
  /** 아직 밀려나야 할 거리. 0보다 크면 전진하지 않고 뒤로 미끄러진다. */
  slideRemainingM?: number;

  export interface SkillFoamWave {
    id: string;
    /** 파도 앞면의 거리. */
    radiusM: number;
    hitTargetIds: Set<string>;
    damage: number;
    bossDamage: number;
    knockbackM: number;
    slowRatio: number;
    slowMs: number;
    /** 화면에 그릴 거품 수. */
    count: number;
  }
  // SkillExecuteResult: arcDeg 삭제, foamCount?: number 추가
  public activeSkillFoamWaves: SkillFoamWave[] = [];
  ```
- **Execution Flow / Logic**:
  1. `triggerWeaponSkill`의 개틀링 분기(마지막 `else`)를 교체한다. 몬스터를 순회하지 않고 파도만 만든다. `damage`, `bossDamage`는 칼날처럼 `levelSpec` 값에 `getDamageBonusMultiplier()`를 곱해 시전 시점에 고정한다. `radiusM`은 `GAME_TUNING.skills.foam.startRadiusM`, `count`는 `levelSpec.skillFoamCount`다. `{ activated: true, weaponKind, weaponLevel, affectedTargets: [], foamCount: levelSpec.skillFoamCount }`를 돌려준다.
  2. `advanceSkillFoam(nowMs, dtSec)`:
     ```typescript
     const maxRadiusM = STAGE_CONSTANTS.SPAWN_RADIUS_M + 1;
     for (let w = this.activeSkillFoamWaves.length - 1; w >= 0; w--) {
       const wave = this.activeSkillFoamWaves[w];
       wave.radiusM += GAME_TUNING.skills.foam.speedMps * dtSec;
       const candidates = this.activeTargets.filter((t) =>
         !t.isItem && !t.isProjectile && !t.weaponSelectKind && !t.rewardCardKind && !t.isGoldenCan &&
         this.isTargetLanded(t, nowMs) && !wave.hitTargetIds.has(t.id) && t.radiusM <= wave.radiusM);
       for (const t of candidates) {
         if (!this.activeTargets.includes(t)) continue;
         wave.hitTargetIds.add(t.id);
         const blocked = Boolean(t.isShielded);
         const killed = this.applySkillDamage(t, t.kind === 'boss' ? wave.bossDamage : wave.damage, nowMs);
         if (!killed && t.kind !== 'boss') {
           t.slideRemainingM = Math.max(t.slideRemainingM ?? 0, wave.knockbackM);
           t.slowUntilMs = nowMs + wave.slowMs;
           t.slowRatio = wave.slowRatio;
         }
         this.pushSkillHitEvent({ source: 'foam', target: t, killed, blocked });
         if (this.gamePhase === 'VICTORY') { this.activeSkillFoamWaves.length = 0; return; }
       }
       if (wave.radiusM > maxRadiusM) this.activeSkillFoamWaves.splice(w, 1);
     }
     ```
  3. `update`에서 `this.advanceSkillBlades(nowMs, dtSec);` 바로 뒤, `VICTORY` 검사 앞에 `this.advanceSkillFoam(nowMs, dtSec);`를 넣는다. `clearSkillProjectiles`에서 `activeSkillFoamWaves`도 비운다.
  4. `update`의 몬스터 이동에서 `effectiveSpeed` 계산(`if (isStunned) { ... } else { ... }`) 바로 뒤에 넣는다.
     ```typescript
     const slide = target.slideRemainingM ?? 0;
     if (slide > 0) {
       const step = Math.min(slide, GAME_TUNING.skills.foam.slideSpeedMps * dtSec);
       target.slideRemainingM = slide - step;
       this.pushTargetBack(target, step);
       effectiveSpeed = 0;
     }
     ```
- **함정**:
  - 필굿 돌진 배율은 이 뒤에 곱해지지만 0이므로 영향이 없다. `effectiveSpeed`를 `let`으로 두었는지 확인한다.
  - 미끄러지는 동안 `pushTargetBack`이 흔들림 위상을 보정하므로(P01-T01) 카스 라이트 흔들림 코드는 그대로 돌게 둔다. 이 분기에서 `continue`하면 카스 라이트의 좌우 위치가 끊겼다가 튄다.
  - 한맥은 밀려나면 `next.radiusM`이 정지 거리보다 커서 발사 분기로 들어가지 않고, 돌아오면 다시 쏜다. 기존 코드 그대로 동작한다.
  - 파도는 포탄을 건드리지 않는다. 포탄 베기는 칼날만의 효과다(D04).
  - 뚫어뻥 스킬은 바꾸지 않는다.

### I03. 테스트
- Related Files:
  - `tests/skill-foam.test.ts` — 새 테스트; new
  - `tests/engine-judgment-and-spawn.test.ts` :: 3종 스킬 테스트 개틀링 부분(633~638행); modify
  - `tests/shared-protocol.test.ts` :: 129행; modify
  - `tests/knockback-no-pull.test.ts` :: 개틀링 케이스; modify

#### Details
- 공통 준비는 `tests/skill-blade.test.ts`와 같다.
- 케이스:
  - 시전 직후 대상의 체력과 거리가 그대로다.
  - 앞면이 닿으면 체력 0.2 감소, `slowUntilMs` 설정, `slowRatio` 0.3.
  - 미끄러짐: 10m 대상이 1프레임 뒤 10m보다 크고 13m보다 작으며, 충분히 지난 뒤 13m에 도달한다(`speedMps: 0`). **22m 대상은 24m(상한)로 가고 앞으로 오지 않는다.**
  - 부채꼴 제한 없음: `thetaRad: 0.9` 대상도 맞는다.
  - 보스: 체력 2 감소, 거리 그대로, `slowUntilMs`와 `slideRemainingM` 없음.
  - 대왕 쉴드: 피해 없음, 이벤트 `blocked: true`. 올린 오비 방패는 뚫는다.
  - 포탄, 아이템, 황금 캔, 카드, 착지 전 부하는 영향이 없다.
  - 한 파도가 같은 대상을 두 번 때리지 않는다(체력이 0.2만 감소).
  - `addDamageBonus(0.3)` 후 피해 0.26. Lv.4에서 카드 3장을 받아도 0.65로 체력 1인 몬스터를 한 번에 못 잡는다.
  - 카드 선택 중 파도 거리와 `slideRemainingM`이 그대로다.
  - 카스 라이트가 미끄러지는 동안 프레임 간 `thetaRad` 변화가 0.05rad 미만이다.
- 기존 테스트 교체:
  ```typescript
  // 3. Gatling skill: 거품 해일 (foam wave, push on contact)
  engine.weaponSystem.selectWeapon('gatling', 1);
  const initialRadius = m1.radiusM;
  const gatSkill = engine.triggerWeaponSkill(5000);
  expect(gatSkill.activated).toBe(true);
  expect(gatSkill.foamCount).toBe(120);
  expect(m1.radiusM).toBe(initialRadius); // nothing happens until the wave arrives
  engine.update(5300, 0.3); // front 2 + 24 x 0.3 = 9.2m reaches m1 at 7m; slide 12 x 0.3 = 3.6m >= 3m
  expect(m1.radiusM).toBe(initialRadius + 3.0);
  ```
- `shared-protocol.test.ts` 129행을 교체한다.
  ```typescript
  expect(gat.levels[4].skillKnockbackM).toBe(5);
  expect(gat.levels[4].skillDamage).toBe(0.5);
  expect(gat.levels[4].skillBossDamage).toBe(3.5);
  expect(gat.levels[4].skillFoamCount).toBe(280);
  ```
- `boss-encounters.test.ts`의 넉백 면역 테스트는 그대로 통과해야 한다.
- `tests/knockback-no-pull.test.ts`의 개틀링 케이스(P01-T01에서 즉시 +1m로 썼다)를 새 동작으로 바꾼다. 시전 후 충분히 `update`하면 10m → 13m, 18m → 21m, 22m → 24m, 24m → 24m이다. 앞으로 오지 않는다는 검사는 그대로 유지한다. 샷건 케이스는 바꾸지 않는다.

## Acceptance Criteria
- [ ] 거품이 닿는 순간에만 피해와 밀기가 들어가고, 몬스터가 순간이동이 아니라 미끄러진다.
- [ ] 레벨별 밀기와 피해가 표와 일치한다.
- [ ] `grep -rn skillArcDeg src tests`에 결과가 없다.

## Validation
- `grep -rn "skillArcDeg\|arcDeg" src tests` — 결과 없음
- `npx vitest run tests/skill-foam.test.ts tests/engine-judgment-and-spawn.test.ts tests/shared-protocol.test.ts tests/boss-encounters.test.ts tests/knockback-no-pull.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
feat(gatling): turn the skill into a field-wide foam wave that pushes on contact

Plan: 2026-11-05-weapon-skill-rework
Phase: P03-gatling-foam
Task: T01-foam-engine

- wave advances with dtSec and hits each target once when its front arrives
- push 3 / 3.5 / 4 / 5m with a slide instead of a teleport
- halve foam damage so it stays a push skill
- remove the arc limit
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
