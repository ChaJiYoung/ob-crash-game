# Task: T02 보스 기절·둔화 면역

## Status: pending

## Goal
보스에게 스킬의 기절·둔화와 샷건 Lv.4 평타의 둔화가 걸리지 않게 하고, 뚫어뻥 부착과 파란 표시도 사라지게 한다. 지금은 표시가 뜨지만 보스의 이동, 소환, 포격은 그대로여서 표시와 실제가 다르다.

## Decision Summary
- 결정 D14. 스킬 피해는 그대로 들어간다. 보스에게 날아간 뚫어뻥은 박히지 않고 맞고 튕긴다. 얼음 아이템(`ice_freeze`)은 스킬이 아니어서 바꾸지 않는다.

## Implementation

### I01. 엔진
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `triggerWeaponSkill`, 샷건 평타 분기(현재 1962행 `// Lv.4 MAX slow`); modify

#### Details
- **Execution Flow / Logic**:
  1. 샷건 스킬: `stunUntilMs`와 `stuckPlungerCount`를 `if (monster.kind !== 'boss') { ... }` 안으로 옮긴다.
  2. 리볼버 스킬: `slowUntilMs`, `slowRatio`를 같은 조건 안으로 옮긴다(P02에서 분기 자체가 바뀌지만, 이 Task의 테스트가 통과하도록 지금 고친다).
  3. 개틀링 스킬: `slowUntilMs`, `slowRatio`를 기존 `if (monster.kind !== 'boss')` 블록 안으로 옮긴다.
  4. 샷건 평타: `if (levelSpec.slowDurationMs > 0)`를 `if (levelSpec.slowDurationMs > 0 && target.kind !== 'boss')`로 바꾼다.
  5. `affectedTargets.push`와 피해 처리는 보스에게도 그대로 둔다.
- 화면의 `isStunned`, `isSlowed`는 엔진 필드에서 계산되므로(`GameCanvas3D.tsx` 약 590행, 670행) 표시는 자동으로 꺼진다. 얼음 아이템의 틴트는 `isBuffActive('ice_freeze')`에서 오므로 유지된다.

### I02. 뚫어뻥이 보스에 맞고 튕김
- Related Files:
  - `src/pc/three/ParticleEffects3D.ts` :: `ProjectileItem`, `spawnSkillEffect`, `update`의 "Check monster sticking hit" 부근; modify
  - `src/pc/components/GameCanvas3D.tsx` :: `triggerSkillEffect`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // ProjectileItem에 추가
  /** 이 위치에 닿으면 박히지 않고 튕겨 나간다(보스). */
  bounceOffPos?: THREE.Vector3;

  public spawnSkillEffect(
    kind: WeaponKind,
    level: WeaponLevel,
    monsterPositions: THREE.Vector3[],
    noStickFlags?: boolean[] // monsterPositions와 같은 순서. true면 그 대상에는 박히지 않는다.
  ): void
  ```
- **Execution Flow / Logic**:
  1. `spawnSkillEffect` 샷건 분기: `const idx = i % Math.max(1, monsterPositions.length)`로 대상을 고르고, `isSticking`이 true인데 `noStickFlags?.[idx]`도 true면 `stuckTargetPos: undefined`, `bounceOffPos: target.clone()`, `isBouncing: true`, `maxLifeSec: 1.2`로 넣는다. 기존 "빗나간 뚫어뻥" 조건(`i >= monsterPositions.length * 2`)은 먼저 검사하고 그대로 둔다.
  2. `update`의 포물선 비행에서 박힘 검사 바로 뒤에 추가한다.
     ```typescript
     if (pj.bounceOffPos && pj.group.position.distanceTo(pj.bounceOffPos) < 1.2) {
       pj.velocity.multiplyScalar(-0.35);
       pj.velocity.y = 4.0;
       pj.bounceOffPos = undefined;
     }
     ```
  3. `GameCanvas3D.tsx`의 `triggerSkillEffect`: 필터한 대상 배열을 먼저 변수에 담고, 위치 배열과 `targets.map((t) => t.kind === 'boss')`를 함께 넘긴다.

### I03. 테스트
- Related Files:
  - `tests/boss-encounters.test.ts` — 보스 면역 케이스 추가; modify
  - `tests/three-stage-and-models.test.ts` — 튕김 케이스 추가; modify

#### Details
- 보스 대상 샷건 스킬 후 `boss.stunUntilMs`, `boss.stuckPlungerCount`가 undefined 또는 0이고 체력은 줄어든다. 일반 몬스터는 기절한다.
- 보스 대상 개틀링·리볼버 스킬 후 `boss.slowUntilMs`가 undefined다. 샷건 Lv.4 평타 후에도 마찬가지이고 일반 몬스터에는 둔화가 걸린다.
- `fx.spawnSkillEffect('shotgun', 1, [pos], [true])` 후 어떤 뚫어뻥도 `isStuck`이 되지 않는다. 60프레임 돌리는 동안 `y`가 -1.20 아래로 내려가지 않는다.
- 기존 `a stunned obi lowers its shield`가 그대로 통과한다.

## Acceptance Criteria
- [ ] 보스에 기절·둔화 필드가 설정되지 않는다.
- [ ] 보스에 뚫어뻥이 박히지 않고, 스킬 피해는 그대로 들어간다.
- [ ] 일반 몬스터의 기절·둔화는 바뀌지 않는다.

## Validation
- `npx vitest run tests/boss-encounters.test.ts tests/three-stage-and-models.test.ts tests/monster-traits.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
fix(engine): make bosses immune to stun and slow

Plan: 2026-11-05-weapon-skill-rework
Phase: P01-shared-rules
Task: T02-boss-status-immunity

- skills and the Lv.4 shotgun shot no longer set stun or slow on bosses
- plungers bounce off bosses instead of sticking
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
