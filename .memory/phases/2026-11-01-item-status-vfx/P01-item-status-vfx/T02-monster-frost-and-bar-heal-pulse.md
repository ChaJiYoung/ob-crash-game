# Task: T02 아이스프리즈 몬스터 서리 결빙 쉐이더·빅스코프 록온 마커·바수리 에메랄드 방어선 치유 펄스 구현 및 검증

## Status: pending

## Goal
아이스 프리즈 활성 시 전장의 모든 몬스터에게 푸른 서리 결빙 틴트와 냉기 이펙트를 씌우고, 빅 스코프 활성 시 몬스터 상단에 록온 마커를 표시하며, 바 수리 획득 시 1.8m 바 카운터 방어선에 에메랄드빛 치유 펄스 파동이 확산되도록 구현하고, 전체 테스트 및 빌드를 검증한다.

## Decision Summary
- `2026-11-01-intuitive-items.md` (D03):
  - 아이스 프리즈(8초): 전장 모든 몬스터 서리 틴트(`0x93c5fd`) 및 냉기 연기/얼음 링.
  - 빅 스코프(8초): 몬스터 상단 홀로그램 록온(Lock-On) 타겟팅 마커.
  - 바 수리(즉시): 1.8m 방어선 에메랄드빛 치유 펄스 파동 확산.

## Implementation

### I01. 몬스터 서리 결빙 틴트 & 록온 마커 시스템 (`TargetModels3D.ts`)

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `updateTargetAnimation3D`, `TargetAnimationOptions` — 서리 결빙 오버레이 및 록온 마커 추가; modify
  - `src/pc/components/GameCanvas3D.tsx` — `isIceFreeze` 및 `isWideScope` 상태를 애니메이션 루프에 전달; modify

#### Details
- **Signatures & Types (`src/pc/three/TargetModels3D.ts`)**:
  ```typescript
  export interface TargetAnimationOptions {
    isIceFreeze?: boolean;
    isWideScope?: boolean;
  }

  export function updateTargetAnimation3D(
    root: THREE.Group,
    kind: TargetKind,
    elapsedSec: number,
    hpRatio: number,
    options?: TargetAnimationOptions
  ): void;
  ```
- **Execution Flow / Logic**:
  1. `createTargetMesh3D(kind)` 확장:
     - 몬스터 `root` 상단(고도 `+0.9m`)에 록온 마커(`lockOnMarker`) 추가:
       `TorusGeometry(0.35, 0.02, 8, 24)` with `MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })`.
       기본 `visible = false`.
     - 몬스터 하단에 얼음 서리 링(`frostRing`) 추가:
       `RingGeometry(r * 0.9, r * 1.3, 24)` with `MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.65 })`.
       기본 `visible = false`.
  2. `updateTargetAnimation3D(root, kind, elapsedSec, hpRatio, options)`:
     - `isIceFreeze = Boolean(options?.isIceFreeze);`
     - `isWideScope = Boolean(options?.isWideScope);`
     - 서리 효과:
       - `frostRing.visible = isIceFreeze`.
       - `isIceFreeze`일 때 `frostRing.rotation.z = elapsedSec * 2.0;`
       - 몬스터 바디 메쉬 머티리얼의 색상을 아이스 블루로 보간:
         `mat.color.lerp(new THREE.Color(0x93c5fd), isIceFreeze ? 0.65 : 0.0);`
     - 록온 마커 효과:
       - `lockOnMarker.visible = isWideScope && !isGroundBoss;`
       - `isWideScope`일 때 `lockOnMarker.rotation.z = elapsedSec * 3.0;`
       - 펄스 스케일: `1.0 + Math.sin(elapsedSec * 6.0) * 0.08;`

### I02. 바 수리 에메랄드 방어선 치유 펄스 (`BreweryStage3D.ts`)

- Related Files:
  - `src/pc/three/BreweryStage3D.ts` :: `BreweryStageRig.triggerHealPulse` — 1.8m 방어선 펄스 충격파 연출 추가; modify
  - `src/pc/components/GameCanvas3D.tsx` — 바 수리 아이템 피격 시 `stageRig.triggerHealPulse()` 호출; modify
  - `docs/몬스터_도감_설명서.md` 및 `README.md` — 4종 3D 상태 효과 설명 갱신; modify
  - `tests/three-stage-and-models.test.ts` — 서리 틴트, 록온 마커, 치유 펄스 단위 테스트 추가; modify

#### Details
- **Signatures & Logic (`src/pc/three/BreweryStage3D.ts`)**:
  ```typescript
  export interface BreweryStageRig {
    // ...
    triggerHealPulse: () => void;
  }
  ```
  - `healPulseMesh`: 방어선 아크와 동일한 형태의 반투명 에메랄드 링(`RingGeometry(1.72, 1.88, 48, 1, 0, Math.PI)` with `MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.95, side: THREE.DoubleSide })`). 기본 `visible = false`.
  - `triggerHealPulse()`:
    - `healPulseUntilSec = performance.now() / 1000 + 0.5`.
    - `healPulseMesh.visible = true`.
  - `updateStageAnimation`:
    - 펄스 진행 동안 `healPulseMesh`의 스케일을 `1.0` ➔ `1.22`로 방사형 팽창시키고 투명도를 `0.95` ➔ `0`으로 페이드아웃.
    - 0.5초 경과 시 `healPulseMesh.visible = false` 복귀.
- **`GameCanvas3D.tsx` 연동**:
  - `lastShootResult` 피격 처리 시 `result.activatedItem === 'bar_repair'`이면:
    `stageRig.triggerHealPulse();`
  - 애니메이션 루프 내:
    `engine.activeTargets.forEach((t) => updateTargetAnimation3D(mesh, t.kind, time / 1000, t.hp / t.maxHp, { isIceFreeze, isWideScope }))`

## Acceptance Criteria
- [ ] 아이스 프리즈 활성 시 몬스터 몸체에 서리 틴트 및 발밑 얼음 링이 표시되고, 비활성 시 정상 복구된다.
- [ ] 빅 스코프 활성 시 몬스터 머리 위에 회전하는 록온 마커가 표시된다.
- [ ] 바 수리 아이템 획득 시 1.8m 바 카운터 방어선에 에메랄드빛 치유 펄스가 팽창하며 번쩍인다.
- [ ] 전체 테스트(`npm test`) 및 번들 빌드(`npm run build`)가 성공한다.

## Validation
- `npm test && npm run build` — 32개 이상 모든 테스트 통과 및 프로덕션 빌드 성공.

## Commit Message
```text
feat(3d): add monster frost overlay, scope lock-on markers, and defense line heal pulse

Plan: 2026-11-01-item-status-vfx
Phase: P01-item-status-vfx
Task: T02-monster-frost-and-bar-heal-pulse

- Add frost freeze tint and ice ground ring to monsters during ice_freeze
- Add animated holographic lock-on markers to monsters during wide_scope
- Implement emerald shockwave heal pulse on defense line in BreweryStage3D
- Update monster codex and game manual with visual status effects
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
