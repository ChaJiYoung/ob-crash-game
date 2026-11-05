# Task: T03 리볼버 평타 관통 표시

## Status: done

## Goal
리볼버 평타가 뒤쪽 몬스터를 관통했을 때 그 몬스터에도 타격 연출(찌그러짐과 파편)이 보이게 한다. 지금은 엔진의 `hitTargets`를 화면이 읽지 않아 관통이 터져도 보이지 않고, 관통으로 죽은 몬스터는 그냥 사라진다.

## Decision Summary
- 결정 D13. 관통 범위 ±0.16rad, 관통 수, 피해율은 바꾸지 않는다. 표시만 추가한다.

## Implementation

### I01. 관통 대상 표시
- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `getPiercedTargets`(new), `playShotFx`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  /** 주 대상을 뺀 관통 대상. */
  export function getPiercedTargets(result: EngineShootResult): ActiveTargetEntity[] {
    return (result.hitTargets ?? []).filter((t) => t !== result.target);
  }
  ```
- **Execution Flow / Logic**: `playShotFx`에서 주 대상 처리(`if (mesh) { ... }`) 뒤, 무기 투사체를 만들기 전에 넣는다. `result.grade !== 'MISS' && result.target` 분기 안이다.
  ```typescript
  getPiercedTargets(result).forEach((rear, i) => {
    const rearPos = computeSkillHitFxPosition(rear);
    const killed = rear.hp <= 0;
    const rearMesh = targetMeshMapRef.current.get(rear.id);
    if (rearMesh && !killed) applyTargetHitFlash3D(rearMesh, performance.now() / 1000);
    playTargetBurst(rear, rearPos, killed, false);
  });
  ```
  소리는 주 대상 한 번으로 충분하므로 `withSound: false`로 둔다.
- **함정**: 방패에 막힌 사격의 `hitTargets`는 `[target]`이라 `getPiercedTargets`가 빈 배열을 돌려준다. 엔진의 관통 분기는 방패를 든 뒤쪽 몬스터를 이미 빼므로(`!t.isGuarding && !t.isShielded`) 여기서 다시 거르지 않는다.
- `playTargetBurst`와 `computeSkillHitFxPosition`은 P02-T02에서 만들었다.

### I02. 테스트
- Related Files:
  - `tests/engine-judgment-and-spawn.test.ts` — 또는 `three-stage-and-models.test.ts`에 추가; modify

#### Details
- `getPiercedTargets`: `hitTargets` 없음이면 빈 배열, `[a]`에 `target: a`면 빈 배열, `[a, b]`면 `[b]`.
- 엔진의 관통 실제 동작을 함께 검증한다: 리볼버 Lv.1, 정면 8·10m 두 마리를 쏘면 결과의 `getPiercedTargets`가 뒤쪽 한 마리이고, 그 체력이 줄었다(기존 551행 테스트와 같은 준비).

## Acceptance Criteria
- [ ] 관통으로 맞은 뒤쪽 몬스터가 찌그러지고 파편이 튄다.
- [ ] 관통으로 죽은 몬스터가 터진다.
- [ ] 관통 수·범위·피해 수치는 바뀌지 않는다.

## Validation
- `npx vitest run tests/engine-judgment-and-spawn.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
feat(revolver): show hit feedback on pierced targets

Plan: 2026-11-05-weapon-skill-rework
Phase: P02-revolver-blades
Task: T03-pierce-feedback

- read hitTargets in playShotFx so rear targets squash, burst and explode
- pierce rules are unchanged
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
