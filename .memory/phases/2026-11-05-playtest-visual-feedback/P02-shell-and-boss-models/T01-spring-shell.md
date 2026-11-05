# Task: T01 똥을 바닥으로 내리고 스프링 동작과 판정을 맞춘다

## Status: pending

## Goal
한맥·보스의 똥이 떠다니지 않고 바닥에 붙어 위아래로 늘고 줄며 다가오고, 보이는 곳을 쏘면 맞는다.

## Decision Summary
- 결정 D02. 이동 속도 3.2 m/s, 요격 규칙, 발사 간격은 그대로다. 회전을 없애 눈이 항상 보이게 한다. 튈 때 소리는 없다.

## Implementation

### I00. 변경 전 기준값 기록 (코드를 고치기 전에 먼저)
- 실행: `npx tsx .memory/references/scripts/simulate-current-decisions.ts 40 all "보통(탭)"`
- 클리어율을 메모해 둔다. I05에서 비교한다.

### I01. 엔진 스폰
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.shell`; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `spawnMonsterProjectile`; modify

#### Details
- `GAME_TUNING`에 `shell: { baseY: 0.28, springHz: 2.5, springAmount: 0.28 }`를 추가한다. 0.28은 모델 아래 단이 바닥에 닿는 높이다(반지름 0.34 × y배율 0.7 × 모델 배율 1.15 = 0.274).
- 엔티티에서 **`customNormY: 0.1`을 지우고** `customBaseY: GAME_TUNING.shell.baseY`로 바꾼다.
- 함정: `customNormY`가 남으면 `computeTargetAimCoords`(약 1587행)가 화면 높이를 고정값으로 써서, 바닥의 모델을 쏴도 빗나간다.
- 발사 사건의 `y: 1.45`를 `y: GAME_TUNING.shell.baseY + 0.35`로 바꾼다.

### I02. 스프링 계산과 모델
- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `computeShellSpring`, `updateProjectileAnimation3D`, `createProjectileMesh3D`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  /** 부피를 유지하며 위아래로 늘고 준다. liftY는 아래 단이 바닥에서 뜨지 않게 올리는 값. */
  export function computeShellSpring(elapsedSec: number, phase = 0): { scaleY: number; scaleXZ: number; liftY: number };
  export function updateProjectileAnimation3D(root: THREE.Group, elapsedSec: number): void;
  ```
- 계산:
  ```typescript
  const { springHz, springAmount } = GAME_TUNING.shell;
  const scaleY = 1 + springAmount * Math.sin(elapsedSec * springHz * Math.PI * 2 + phase);
  const scaleXZ = 1 / Math.sqrt(scaleY);
  const liftY = (scaleY - 1) * SHELL_BOTTOM_OFFSET; // SHELL_BOTTOM_OFFSET = 0.238
  ```
- `updateProjectileAnimation3D`: `inner.scale.set(base * scaleXZ, base * scaleY, base * scaleXZ)`, `inner.position.y = liftY * base`. `base`는 `root.userData.baseScale`(1.15). `phase`는 `root.id * 0.7`로 줘서 여러 개가 같이 움직이지 않게 한다.
- `createProjectileMesh3D`: `createFloorShadowMesh(0.42)`를 추가해 `shadowMesh.position.y = -GAME_TUNING.shell.baseY + 0.01`로 root에 붙인다. `userData.shadowMesh`도 넣는다.
- `TargetModels3D.ts`에 `GAME_TUNING` import가 없으면 추가한다.

### I03. 렌더 루프
- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `target.isProjectile` 분기(약 651행), import; modify

#### Details
- 분기를 다음으로 바꾼다.
  ```typescript
  } else if (target.isProjectile) {
    mesh.rotation.y = Math.atan2(-target.x, -target.z); // 몬스터와 같이 플레이어를 본다
    updateProjectileAnimation3D(mesh, time / 1000);
  ```
- 기존 `rotation.y += ...`, `rotation.z = ...`는 지운다.

### I04. 테스트
- Related Files:
  - `tests/monster-traits.test.ts` :: 약 87행 `customBaseY` 기대값; modify
  - `tests/poop-shell.test.ts`; modify

#### Details
- `monster-traits`: `expect(projectile.customBaseY).toBe(GAME_TUNING.shell.baseY)`, `customNormY`는 `undefined`.
- `poop-shell`에 추가:
  - 여러 시각에서 `scaleY`가 0보다 크고 `scaleY * scaleXZ * scaleXZ`가 1에 가깝다(부피 유지).
  - 아래 단 높이 `liftY - 0.238 * (scaleY - 1)`이 항상 0(바닥에서 뜨지 않음).
  - 스폰한 똥의 `computeTargetAimCoords` 좌표에 쏘면 `interceptedProjectile: true`이고, 옛 고정 위치(화면 높이 0.1)와 다른 곳이다.
  - 그림자가 `userData.shadowMesh`로 있고, 기존 "빛·고리 없음" 검사가 그대로 통과한다.

### I05. 시뮬레이션 비교
- I00과 같은 명령을 다시 실행해 결과를 `.memory/references/playtest-2026-11-05-skill-guard-ammo.md` 끝에 적는다.
- 판정 범위가 10m에서 계산상 약 19% 작아진다. 클리어율이 무기별 10%p 넘게 떨어지면 `spawnMonsterProjectile`의 `hitRadiusM`을 0.95에서 1.15로 올려 다시 재고, 고친 값과 결과를 함께 적는다. 다른 난이도 값은 건드리지 않는다.

## Acceptance Criteria
- [ ] 똥이 공중으로 뜨지 않고 바닥에서 늘고 줄며 다가오며, 눈이 항상 보인다.
- [ ] 화면에 보이는 똥을 조준해 쏘면 요격된다.
- [ ] 변경 전후 시뮬레이션 결과가 기록되어 있다.

## Validation
- `npx vitest run tests/poop-shell.test.ts tests/monster-traits.test.ts tests/three-stage-and-models.test.ts tests/boss-encounters.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(shell): keep poop shells on the floor and squash them like a spring

Plan: 2026-11-05-playtest-visual-feedback
Phase: P02-shell-and-boss-models
Task: T01-spring-shell

- Remove the fixed screen height so the hit zone follows the floor model
- Replace the spin with a volume-keeping squash and a floor shadow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
