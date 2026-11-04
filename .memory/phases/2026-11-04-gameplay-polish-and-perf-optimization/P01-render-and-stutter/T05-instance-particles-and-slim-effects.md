# Task: T05 Instance Particles and Slim Effects

## Status: pending

## Goal
타격 파티클을 `InstancedMesh`로 묶어 그리고 수를 약 30%로 줄인다. 캔 물방울과 샷건 탄환도 단순화해 프레임당 그리기 요청을 397회에서 200회 안팎으로 낮추고 화면을 깔끔하게 한다.

## Decision Summary
- D05: 피격 18→5, 처치 32→10, 보스 처치 48→15. 병 파편 16→5, 맥주 방울 14→4. 스킬 이펙트 모양은 유지한다.

## Implementation

### I01. 파티클 배치 구조

- Related Files:
  - `src/pc/three/ParticleEffects3D.ts` :: `ParticleItem`, `spawnHitEffect`, `triggerBottleCrash`, `update`, `clear`, `createWarmupObjects` — 인스턴싱으로 교체; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export const HIT_PARTICLE_COUNTS = { hit: 5, kill: 10, boss: 15 } as const;
  const BOTTLE_SHARD_COUNT = 5;
  const BOTTLE_DROP_COUNT = 4;

  interface BatchParticle {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    rotation: THREE.Euler;
    rotSpeed: THREE.Vector3;
    color: THREE.Color;
    lifeSec: number;
    maxLifeSec: number;
  }

  interface ParticleBatch {
    mesh: THREE.InstancedMesh;
    items: BatchParticle[];
    capacity: number;
  }

  public get activeParticleCount(): number;
  public spawnHitEffect(origin: THREE.Vector3, colorHex: string, count = HIT_PARTICLE_COUNTS.hit): void;
  public triggerBottleCrash(origin: THREE.Vector3, count = BOTTLE_SHARD_COUNT): void;
  ```
- **Data & Schema Fields**: 배치 4개를 생성자에서 만들고 `group.add` 한다.
  | 배치 | 지오메트리 | 머티리얼 | 용량 |
  | :--- | :--- | :--- | :--- |
  | foam | `foamGeo` | 흰색 투명 0.95 | 96 |
  | shard | `shardGeo` | 흰색 + 인스턴스 색상, 양면, 투명 0.9 | 96 |
  | cap | `bottleCapGeo` | `bottleCapMat` | 8 |
  | drop | `beerDropGeo` | `beerMat` | 32 |
- 각 메시는 `frustumCulled = false`, `count = 0`, `instanceMatrix.setUsage(THREE.DynamicDrawUsage)`로 만든다.
- **Execution Flow / Logic**:
  1. 스폰: 물리 초기값 계산은 기존 코드를 그대로 쓴다. 절반은 foam, 나머지는 shard에 넣는다. 용량을 넘으면 `items.shift()`로 가장 오래된 것을 지운다.
  2. `update`: 배치별로 수명이 끝난 항목을 지우고, 중력·위치·회전·축소(`1.0 - progress * 0.8`)를 계산한다. 공용 `Object3D`로 `setMatrixAt`을 호출하고, shard는 `setColorAt`도 호출한다. 그 뒤 `mesh.count = items.length`, `instanceMatrix.needsUpdate = true`, shard는 `instanceColor.needsUpdate = true`.
  3. `clear`: 모든 `items`를 비우고 `count = 0`.
  4. `createWarmupObjects`: 배치 메시는 항상 씬에 있으므로 제외한다. 트레이서, 발사체, 라벨 샘플만 반환한다.
  5. `matCache`와 `getMaterial`은 쓰지 않으면 지운다. `spawnHitEffect`의 색상은 인스턴스 색상으로 넣는다.

### I02. 호출부와 스킬 리소스

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: 사격 이펙트 코드 — 파티클 수 상수 사용; modify
  - `src/pc/three/ParticleEffects3D.ts` :: `spawnSkillEffect` — 거품 해일과 부메랑 리소스 공유; modify

#### Details
- `GameCanvas3D`의 `48`, `32`, `18`을 `HIT_PARTICLE_COUNTS.boss`, `.kill`, `.hit`로 바꾼다.
- 거품 해일: 스폰마다 `new SphereGeometry`와 새 재질을 만들지 않는다. 반경 1 공유 구체(8×8)를 `mesh.scale.setScalar(radius)`로 쓰고, 색상 3개 재질을 공유한다(`userData.isShared = true`). 메시 수 50과 움직임은 유지한다.
- 부메랑: 토러스·박스·금색 재질을 클래스 필드로 한 번만 만들고 공유한다. 모양은 유지한다.

### I03. 샷건 탄환과 캔 물방울

- Related Files:
  - `src/pc/three/ParticleEffects3D.ts` :: `acquireProjectileGroup` — 샷건 탄환 단순화; modify
  - `src/pc/three/TargetModels3D.ts` :: `createTargetMesh3D` — 물방울 제거; modify

#### Details
- 샷건 분기: `createRealisticPlungerMesh(0.28)` 대신 메시 1개짜리 그룹을 반환한다. `CylinderGeometry(0.045, 0.07, 0.12, 8)`를 `rotateX(Math.PI / 2)`하고 공유 빨간 `MeshBasicMaterial(0xdc2626)`를 쓴다. 지오메트리·재질 모두 `isShared`로 표시한다.
- 스킬 뚫어뻥(`spawnSkillEffect`)과 몬스터에 꽂히는 뚫어뻥은 기존 모델을 유지한다.
- `TargetModels3D.ts`에서 `dropletGeo`, `dropletMat`, 물방울 8개 생성 루프를 지운다.

### I04. 테스트 갱신

- Related Files:
  - `tests/three-stage-and-models.test.ts` :: `'should manage 3D particle effects pool...'` — 카운트 방식 변경; modify

#### Details
- `fx.group.children.length`가 10인지 확인하던 부분을 `fx.activeParticleCount`로 바꾼다.
- 추가 검증:
  - 파티클을 많이 스폰해도 `fx.group.children` 수가 늘지 않는다.
  - 수명이 지나면 `activeParticleCount`가 0이 된다.
  - 용량을 넘겨도 예외가 없고 용량 이하로 유지된다.
- `createTargetMesh3D('pilgood')` 안에 반경 0.012 구체가 없는지 확인한다.

## Acceptance Criteria
- [ ] 타격감은 남고 화면은 덜 복잡하다.
- [ ] 스킬 이펙트 모양이 그대로다.
- [ ] 파티클 수와 관계없이 파티클 그리기 요청이 고정된다.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
perf(fx): instance hit particles and slim combat effects

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P01-render-and-stutter
Task: T05-instance-particles-and-slim-effects

- Render particles through fixed InstancedMesh batches
- Reduce hit, kill, boss, and bottle particle counts to about 30%
- Simplify shotgun pellets and remove can droplets
- Share skill effect resources
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
