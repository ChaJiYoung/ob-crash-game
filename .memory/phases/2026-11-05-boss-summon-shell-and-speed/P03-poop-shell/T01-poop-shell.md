# Task: T01 똥 모양 포탄과 발사 연출

## Status: done

## Goal
한맥·보스가 쏘는 포탄을 아이템과 확실히 구분되는 갈색 똥 모양으로 바꾸고, 발사 순간 분출 연출과 갈색 요격 파편을 넣는다.

## Decision Summary
- 결정 D08. 포탄의 `kind`는 계속 `'pilgood'`, 판정·점수·요격 규칙은 바꾸지 않는다. 날아오는 동안 꼬리·경고는 넣지 않는다.

## Implementation

### I01. 모델
- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `createProjectileMesh3D`; modify
  - `src/pc/components/GameCanvas3D.tsx` :: `resolveHitFxColor`, 포탄 애니메이션(`else if (target.isProjectile)` 두 곳); modify

#### Details
- **Execution Flow / Logic**: `createProjectileMesh3D`의 구체와 고리를 지우고 세 단 소프트아이스를 만든다. 재질은 `getCachedMaterial('projectile-poop-mat', ...)` `MeshStandardMaterial({ color: 0x7a4a21, roughness: 0.85, metalness: 0 })`(emissive 없음), 얼굴 점 두 개는 `MeshBasicMaterial({ color: 0x1c1917 })`. 지오메트리는 `getCachedGeometry`로 캐시한다.
  - 아래 단: `SphereGeometry(0.34, 14, 10)`을 `scale(1.25, 0.7, 1.25)`로 눌러 `y = 0`
  - 가운데 단: `SphereGeometry(0.26, 14, 10)`을 `scale(1.2, 0.7, 1.2)`, `y = 0.2`
  - 윗단: `SphereGeometry(0.18, 12, 8)`을 `scale(1.1, 0.7, 1.1)`, `y = 0.38`
  - 꼭대기 뿔: `ConeGeometry(0.1, 0.22, 10)`, `y = 0.58`, `rotation.z = 0.35`(살짝 휜다)
  - 눈: `SphereGeometry(0.035, 8, 8)` 두 개를 아래 단 앞면(`z = 0.3`)에 `x = ±0.1`, `y = 0.05`
  - 전체를 `inner`에 넣고 `inner.scale.setScalar(1.15)`.
  - `root.userData`는 지금처럼 `{ isProjectile: true, inner, baseScale: 1.15, hitRadiusM: 0.95 }`.
- **`resolveHitFxColor`**: `if (target.isProjectile) return '#7a4a21';`
- **굴러오는 움직임**: `GameCanvas3D.tsx`의 포탄 분기 두 곳(`mesh.rotation.x += dtSec * 10; mesh.rotation.y += dtSec * 14;`)을 `mesh.rotation.y += dtSec * 6; mesh.rotation.z = Math.sin(time / 120) * 0.25;`로 바꾼다(위아래가 뒤집히지 않고 뱅글뱅글 흔들리며 온다). 첫 번째(생성 직후)와 두 번째(업데이트) 중 한쪽이 생성 때 한 번만 쓰이는지 `grep -n "isProjectile" src/pc/components/GameCanvas3D.tsx`로 확인하고 둘 다 같은 식으로 맞춘다.
- **함정**: 포탄 메시는 셰이더 예열 목록(`ShaderWarmup.ts`의 `createProjectileMesh3D()`)에 들어 있어 새 재질 종류(`MeshStandardMaterial` 갈색, `MeshBasicMaterial`)가 예열된다. 이미 `MeshStandardMaterial`과 `MeshBasicMaterial`이 다른 곳에서 예열되므로 새 셰이더 변종은 늘지 않는다.

### I02. 발사 사건과 연출
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `ProjectileLaunchEvent`, `projectileLaunchEvents`, `drainProjectileLaunchEvents`, `spawnMonsterProjectile`, `clearSkillProjectiles`; modify
  - `src/pc/three/ParticleEffects3D.ts` :: `spawnProjectileLaunchBurst`(new); modify
  - `src/pc/components/GameCanvas3D.tsx` :: `animate`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface ProjectileLaunchEvent { source: 'hanmac' | 'boss'; x: number; z: number; y: number }
  private projectileLaunchEvents: ProjectileLaunchEvent[] = [];
  public drainProjectileLaunchEvents(): ProjectileLaunchEvent[]; // 돌려주고 비운다
  ```
- `spawnMonsterProjectile`에서 `entity`를 만든 뒤 `this.projectileLaunchEvents.push({ source: sourceKind, x: pt.x, z: pt.z, y: 1.45 })`(포탄의 `customBaseY`와 같은 높이). 길이가 32를 넘으면 앞에서 버린다. `clearSkillProjectiles`와 `startGame`·`startWave`에서 비운다.
- **`spawnProjectileLaunchBurst(position)`**: 갈색 덩어리와 연기. `spawnHitEffect(position, '#7a4a21', 14)` + `spawnHitEffect(position, '#d6d3d1', 6)`(연기는 연한 회색). 파티클 풀 용량(foam 96, shard 96)을 한 번에 넘지 않는 수다.
- `animate`에서 보스 처치 사건 처리 바로 뒤에 추가:
  ```typescript
  for (const ev of engine.drainProjectileLaunchEvents()) {
    particles.spawnProjectileLaunchBurst(new THREE.Vector3(ev.x, ev.y, ev.z));
  }
  ```
- **함정**: 한맥이 4초마다 쏘고 보스가 3.5초마다 쏘므로 동시에 많이 나오지 않는다. 필드 밖(보스가 12m 이상)에서 쏠 때도 위치는 그대로 쓴다. 엔진 테스트는 `drainProjectileLaunchEvents`를 읽어 확인한다.

### I03. 테스트
- Related Files:
  - `tests/poop-shell.test.ts` — 새 테스트; new
  - `tests/three-stage-and-models.test.ts`, `tests/monster-traits.test.ts`; modify (포탄 메시 구조를 검사하는 부분)

#### Details
- `createProjectileMesh3D()`의 자식 재질에 emissive 발광이 없고 색이 갈색 계열이다(`MeshStandardMaterial.emissive`가 검정 또는 `emissiveIntensity` 0). 토러스(고리) 지오메트리가 없다. `userData.isProjectile === true`.
- `resolveHitFxColor({ isProjectile: true } as any)`가 `'#7a4a21'`이다.
- `engine.spawnMonsterProjectile(1000, 'hanmac', { thetaRad: 0.1, radiusM: 11 })` 후 `drainProjectileLaunchEvents()`가 `source: 'hanmac'`, `x`, `z`가 그 위치와 같은 이벤트 1개를 돌려주고 두 번째 호출은 빈 배열이다. 보스 포탄도 `source: 'boss'`.
- `ParticleEffects3D.spawnProjectileLaunchBurst`를 부르면 `activeParticleCount`가 늘어난다.
- 기존 `three-stage-and-models.test.ts`의 포탄 메시 검사가 구체/고리를 가정하면 새 구조에 맞게 고친다.

## Acceptance Criteria
- [ ] 포탄이 갈색 3단 똥 모양이고 빛나는 고리가 없다.
- [ ] 한맥·보스가 쏠 때 그 자리에서 갈색 분출이 나온다.
- [ ] 요격 파편이 갈색이다.
- [ ] 판정·점수·요격 규칙은 바뀌지 않는다.

## Validation
- `npx vitest run tests/poop-shell.test.ts tests/three-stage-and-models.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과

## Commit Message
```text
feat(shell): make enemy shells brown poop and show a launch puff

Plan: 2026-11-05-boss-summon-shell-and-speed
Phase: P03-poop-shell
Task: T01-poop-shell

- three-tier brown model without glow or ring so it no longer looks like an item
- engine launch event drives a brown burst at the shooter
- interception sparks are brown
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
