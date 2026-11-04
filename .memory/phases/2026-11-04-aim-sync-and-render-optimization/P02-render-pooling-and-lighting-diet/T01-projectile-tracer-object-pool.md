# Task 01: `ParticleEffects3D` 트레이서 단위 실린더 스케일링 및 무기 발사체·파편 지오메트리/머티리얼 캐싱·오브젝트 풀링 구현

- **Status**: done
- **Phase**: `P02-render-pooling-and-lighting-diet`
- **Plan**: `.memory/plans/2026-11-04-aim-sync-and-render-optimization.md`

## Goal
사격할 때마다(`spawnTracerBeam`, `spawnWeaponProjectile`) 및 타겟 피격/파괴 시마다(`triggerBottleCrash`) 매번 `new THREE.CylinderGeometry`, `new THREE.SphereGeometry`, `new THREE.MeshBasicMaterial` 등을 할당·해제하던 구조를 공유 지오메트리/머티리얼 캐시 및 오브젝트 풀링 방식으로 전환하여 사격 시 WebGL 버퍼 재할당과 GC 스파이크를 제거한다.

## Decision Summary
- **D01 (`2026-11-04-render-perf-optimization.md`)**:
  1. `spawnTracerBeam`: 매번 길이에 맞춰 `new THREE.CylinderGeometry(radius, radius, distance, 8)`를 생성하는 대신, 길이 `1`짜리 단위 실린더 지오메트리(`height = 1`, X축 `Math.PI / 2` 회전 적용) 1개를 클래스에서 공유하고 `beam.scale.set(radius, radius, distance)`로 스케일링하며, 트레이서 메쉬와 머티리얼을 풀링(`tracerPool`)하여 재사용한다.
  2. `spawnWeaponProjectile`: 샷건 플런저(`createRealisticPlungerMesh`), 리볼버 에너지 볼트, 개틀링 버블 발사체 그룹을 무기별 오브젝트 풀(`projectilePools`)에서 꺼내 재사용하고, 수명이 끝나면(`life >= maxLife`) `.dispose()` 대신 `visible = false` 및 부모 씬에서 분리하여 풀로 반납한다. 풀 한도 초과 시 가장 오래된 활성 발사체를 회수해 재사용한다.
  3. `triggerBottleCrash`: 맥주 파편(`shatterGeo`), 거품(`foamGeo`), 충격파 링(`ringGeo`), 맥주 방울(`dropletGeo`), 플로팅 텍스트 평면(`textPlaneGeo`) 지오메트리를 인스턴스 공유 리소스(`userData.isShared = true`)로 캐싱하고, 정리(`disposeObject3D`) 시 공유 지오메트리는 절대 `.dispose()`하지 않도록 보호한다.

## Implementation
- [x] **I01**: `src/pc/three/DraftTapGun3D.ts`의 `createRealisticPlungerMesh`에서 사용하는 플런저 지오메트리/머티리얼을 모듈 캐시(`userData.isShared = true`)로 전환하여 복제 생성 비용을 줄인다.
- [x] **I02**: `src/pc/three/ParticleEffects3D.ts`에서 공유 지오메트리(`unitTracerGeo`, `revolverCoreGeo`, `revolverHaloGeo`, `revolverTailGeo`, `gatlingOuterGeo`, `gatlingHighlightGeo`, `shatterGeo`, `foamGeo`, `ringGeo`, `dropletGeo`, `textPlaneGeo`)를 생성자에서 1회 초기화하고 `userData.isShared = true`로 마킹한다.
- [x] **I03**: `ParticleEffects3D.ts`에 트레이서 풀(`tracerPool`, 최대 24개)과 무기별 발사체 풀(`projectilePools`, 무기당 최대 24개)을 구현하여 `spawnTracerBeam` 및 `spawnWeaponProjectile` 호출 시 `new THREE.BufferGeometry` 할당이 0건이 되도록 한다.
- [x] **I04**: `ParticleEffects3D.update(dt)` 및 `clear()`에서 수명이 다한 트레이서·발사체를 풀로 반납하고, `disposeObject3D` 헬퍼가 `userData.isShared` 지오메트리/머티리얼을 파괴하지 않도록 수정한다.

## Related Files
- `src/pc/three/DraftTapGun3D.ts` (modify)
- `src/pc/three/ParticleEffects3D.ts` (modify)

## Signatures & Types
```typescript
// src/pc/three/ParticleEffects3D.ts
export interface ParticlePoolStats {
  activeProjectiles: number;
  pooledProjectiles: number;
  activeTracers: number;
  pooledTracers: number;
}

export class ParticleEffects3D {
  // 기존 public 메서드 시그니처 100% 유지:
  public triggerBottleCrash(position: THREE.Vector3, scoreText?: string, isCrit?: boolean): void;
  public spawnWeaponProjectile(startPos: THREE.Vector3, endPos: THREE.Vector3, weaponType: WeaponType): void;
  public spawnTracerBeam(startPos: THREE.Vector3, endPos: THREE.Vector3, colorHex?: number, thickness?: number): void;
  public triggerSkillShockwave(colorHex?: number): void;
  public update(dt: number): void;
  public clear(): void;
  public getPoolStats(): ParticlePoolStats;
}
```

## Data & Schema Fields
- `geometry.userData.isShared`: `boolean` (`true`일 경우 개별 이펙트/발사체 수명 종료 시 `.dispose()` 금지)
- `material.userData.isShared`: `boolean` (`true`일 경우 개별 이펙트/발사체 수명 종료 시 `.dispose()` 금지)

## Execution Flow / Logic
1. **단위 트레이서 지오메트리(`unitTracerGeo`)**:
   - `new THREE.CylinderGeometry(1, 1, 1, 8)` 생성 후 `unitTracerGeo.rotateX(Math.PI / 2)` 및 `unitTracerGeo.userData.isShared = true` 설정.
   - `spawnTracerBeam(startPos, endPos, colorHex, thickness)` 호출 시:
     - `tracerPool`에서 유휴 `THREE.Mesh`를 꺼내거나(없으면 생성, 활성 트레이서가 24개 이상이면 가장 오래된 트레이서를 회수),
     - `const radius = Math.max(0.014, thickness * 0.45);`
     - `beam.scale.set(radius, radius, distance);`
     - `beam.position.copy(midPoint); beam.lookAt(endPos);`
     - `material.color.setHex(colorHex); material.opacity = 0.92; beam.visible = true;`로 재설정한다.
2. **무기 발사체 풀(`projectilePools`)**:
   - `SHOTGUN`, `REVOLVER`, `GATLING` 각 무기 타입별로 `THREE.Group[]` 풀을 유지한다.
   - `acquireWeaponProjectile(weaponType)`:
     - 풀에 유휴 그룹이 있으면 꺼내고, 활성 발사체가 32개 이상이면 가장 오래된 활성 발사체를 즉시 회수하여 재사용한다.
     - 그룹 내부 메쉬들의 머티리얼 `opacity`를 초기값으로 복원하고 `group.scale.setScalar(1)`(또는 샷건 `1.45`)로 리셋한다.
   - `update(dt)`에서 `proj.life >= proj.maxLife`가 되면 `this.effectGroup.remove(proj.mesh); proj.mesh.visible = false;` 후 해당 무기 풀(`projectilePools.get(weaponType)`)에 push한다.

## Acceptance Criteria
- `spawnTracerBeam`과 `spawnWeaponProjectile`을 100회 반복 호출하고 `update(dt)`로 수명을 경과시켜도 추가 지오메트리가 생성되지 않고 풀에서 재사용된다.
- `getPoolStats()`가 현재 활성/풀링된 발사체 및 트레이서 개수를 정확히 반환한다.
- 기존 `tests/three-stage-and-models.test.ts`가 깨지지 않고 통과한다.

## Validation
```bash
npx vitest run tests/three-stage-and-models.test.ts
```

## Commit Message
```text
perf(three): pool weapon projectiles and tracer beams in ParticleEffects3D

Plan: 2026-11-04-aim-sync-and-render-optimization
Phase: P02
Task: T01
```

## Progress
- 2026-11-04: I01~I04 구현 완료. DraftTapGun3D 플런저 단위 지오메트리/머티리얼 캐싱(userData.isShared), ParticleEffects3D 단위 트레이서 실린더 스케일링, 트레이서 풀(최대 24) 및 무기별 발사체 풀(샷건/리볼버/개틀링) 구현, 안전 dispose 및 getPoolStats 추가. Vitest 14개 테스트 통과.
