# Task: T01 밀어내기 끌어당김 버그 수정

## Status: done

## Goal
샷건 평타와 개틀링 스킬의 밀어내기가 16m 밖 몬스터를 앞으로 끌어오지 않게 한다. 지금은 `min(16, r + 밀기)`라서 24m 몬스터가 16m로 끌려온다.

## Decision Summary
- 결정 D09. 공용 함수 하나로 합친다. 새 거리 = `min(STAGE_CONSTANTS.SPAWN_RADIUS_M, 현재 거리 + 밀기)`이며 절대 앞으로 오지 않는다.
- 이 Task에서는 밀기 값(샷건 0.3m, 개틀링 1~1.4m)을 바꾸지 않는다. 개틀링 값은 P03에서 바꾼다.

## Implementation

### I01. 공용 함수와 호출부
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `ActiveTargetEntity`, `pushTargetBack`(new), `shootAt` 경로의 샷건 분기(현재 1959행), `triggerWeaponSkill` 개틀링 분기(현재 2161행), `update`의 카스 라이트 흔들림 2곳(현재 약 1104행, 1147행); modify

#### Details
- **Signatures & Types**:
  ```typescript
  // ActiveTargetEntity에 추가
  /** 밀려난 거리만큼 흔들림 위상을 되돌려, 밀어내기가 카스 라이트 좌우 위치를 튀게 하지 않는다. */
  swayPhaseOffsetRad?: number;

  /** 몬스터를 뒤로 민다. 등장 거리를 넘지 않고, 앞으로 끌어오지 않는다. */
  private pushTargetBack(target: ActiveTargetEntity, meters: number): void {
    if (meters <= 0) return;
    const next = Math.min(STAGE_CONSTANTS.SPAWN_RADIUS_M, target.radiusM + meters);
    const moved = next - target.radiusM;
    if (moved <= 0) return;
    target.radiusM = next;
    target.x = Math.sin(target.thetaRad) * next;
    target.z = -Math.cos(target.thetaRad) * next;
    target.swayPhaseOffsetRad = (target.swayPhaseOffsetRad ?? 0) - moved * 0.7;
  }
  ```
- **Execution Flow / Logic**:
  1. 샷건 분기의 `target.radiusM = Math.min(16.0, target.radiusM + levelSpec.knockbackM);`를 `this.pushTargetBack(target, levelSpec.knockbackM);`로 바꾼다. 바깥 조건 `levelSpec.knockbackM > 0 && target.kind !== 'boss'`는 유지한다.
  2. 개틀링 분기의 `monster.radiusM = Math.min(16.0, monster.radiusM + levelSpec.skillKnockbackM);`를 `this.pushTargetBack(monster, levelSpec.skillKnockbackM);`로 바꾼다. 바깥 조건 `monster.kind !== 'boss'`는 유지한다.
  3. `update`의 카스 라이트 흔들림 수식 2곳을 같은 모양으로 바꾼다.
     `Math.sin(nowMs * swayFrequency + target.radiusM * 0.7 + (target.swayPhaseOffsetRad ?? 0)) * swayAmplitudeRad`
- **함정**: 카스 라이트의 흔들림 위상에 `radiusM * 0.7`이 들어 있어서, 거리만 바꾸면 좌우 위치가 튄다. 3~5m를 미는 P03에서는 위상이 크게 뛰므로 오프셋을 여기서 미리 넣는다. 수식 2곳 중 하나만 고치면 착지 순간에 튄다.
- **건드리지 않는 곳**: `Math.max(6.5, Math.min(16.0, radiusM))`(아이템 스폰, 약 921행)와 샌드박스의 `16.0` 복귀는 밀어내기가 아니므로 그대로 둔다.

### I02. 테스트
- Related Files:
  - `tests/knockback-no-pull.test.ts` — 새 테스트; new

#### Details
테스트 공통: `new BeerCrusherEngine()`, `startGame({ withWeaponSelect: false })`, `startWave(6)`, `(engine as any).spawnedInWave = 999`. 체력 99인 `hanmac`을 손으로 만들어 `activeTargets`에 넣는다.
- 개틀링 Lv.1 스킬: 10m → 11m, 15m → 16m, **18m → 19m, 22m → 23m**, 24m → 24m(상한).
- 샷건 Lv.2 평타 명중(`computeTargetAimCoords`로 조준, `shootAt(x, y, 2000, 'press')`): 10m → 10.3m, **22m → 22.3m**.
- 등장 거리를 넘은 대상(24.5m)은 줄어들지 않는다.
- 밀린 뒤에도 `x`, `z`가 `radiusM`, `thetaRad`와 일치한다.
- 카스 라이트: 밀기 전후 다음 `update`의 `thetaRad` 차이가 0.02rad 미만이다(`initialThetaRad: 0`, `thetaRad: 0`, `radiusM: 12`).

## Acceptance Criteria
- [ ] 16m 밖 몬스터가 밀어내기로 앞으로 오지 않는다.
- [ ] 기존 테스트(`sgTarget.radiusM` 8.3, 보스 넉백 면역)가 그대로 통과한다.
- [ ] 카스 라이트가 밀릴 때 좌우로 튀지 않는다.

## Validation
- `npx vitest run tests/knockback-no-pull.test.ts tests/engine-judgment-and-spawn.test.ts tests/boss-encounters.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
fix(engine): stop knockback from pulling far monsters toward the player

Plan: 2026-11-05-weapon-skill-rework
Phase: P01-shared-rules
Task: T01-knockback-no-pull

- shared pushTargetBack caps at the spawn radius and never moves a target forward
- shotgun hits and the gatling skill use it
- keep the caslight sway phase continuous when it is pushed
```
커밋할 때 아직 커밋되지 않은 `.memory/decisions/2026-11-05-weapon-skill-rework.md`, `.memory/plans/2026-11-05-weapon-skill-rework.md`, `.memory/phases/2026-11-05-weapon-skill-rework/`, `.memory/current.md`도 함께 넣는다. `.claude/`는 넣지 않는다.

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
