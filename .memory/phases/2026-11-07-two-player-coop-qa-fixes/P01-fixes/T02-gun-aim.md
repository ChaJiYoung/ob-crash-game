# Task: T02 총구가 십자선 지점을 겨누게

## Status: pending

## Goal
3D 총이 자기 위치에서 자기 플레이어 십자선 아래의 3D 지점을 실제로 겨누게 한다. 1인(가운데 총)과 2인(좌우 총)이 같은 계산을 쓴다(D24). 지금은 총이 "조준값 × 고정 비율"(좌우 −0.58, 상하 0.36)로만 돌고, 좌우로 옮긴 총에는 고정 안쪽 보정(`GUN_YAW_COMP = 0.35`)이 더해져 늘 화면 가운데 쪽을 본다(`B-10-guns-3d.png`).

## Decision Summary
- **모듈 위치(계층을 깨지 않게)**:
  1. 조준 좌표 ↔ 화면 좌표 변환(`aimToViewportPercent`, `aimToNdc`, `viewportRatioToAim`)은 React와 three 어느 쪽 것도 아닌 순수 함수인데 지금 React 컴포넌트 파일 `src/pc/components/CrosshairOverlay.tsx`에 있다. 3D 모듈이 이걸 쓰려면 컴포넌트 파일을 import해야 해서 계층이 거꾸로 된다. → 새 파일 `src/pc/aimMapping.ts`로 **옮기고**, `CrosshairOverlay.tsx`는 기존 import 호환을 위해 `export { aimToViewportPercent, aimToNdc, viewportRatioToAim } from '../aimMapping';`로 다시 내보낸다.
  2. 조준 좌표 → 3D 월드 지점(`computeAimWorldPoint`)은 지금 `GameCanvas3D.tsx`(컴포넌트) 안에 있다. 카메라 투영이라 three 계층 것이다. → `src/pc/three/aimProjection.ts`로 옮기고(`../aimMapping` import), `GameCanvas3D.tsx`는 거기서 import한다.
  3. "총 위치에서 목표 지점을 겨누는 각도"는 three 수학이지만 총 모델과 무관한 순수 계산이다. → 새 파일 `src/pc/three/gunAim.ts`. 단위 테스트가 쉽도록 THREE 객체를 바꾸지 않는 순수 함수로.
  4. `DraftTapGun3D`는 각도를 **받아서** 반동·흔들림과 함께 적용만 한다(모델 클래스가 카메라·조준 규칙을 몰라도 됨).
  5. `GameCanvas3D`는 플레이어별로 "조준 → 카메라 공간 목표 지점 → 각도"를 이어 붙이는 조율만 한다.
- 총은 카메라의 자식(`camera.add(tapGun.group)`)이므로 목표 지점도 **카메라 로컬 좌표**로 바꿔 계산한다.
- `GUN_YAW_COMP`와 선형 근사식은 삭제한다. 1인 손맛이 조금 바뀔 수 있으므로 1인 캡처를 수정 전후로 비교한다(P02).

## Implementation

### I01. 순수 조준 좌표 모듈

- Related Files:
  - `src/pc/aimMapping.ts` :: `aimToViewportPercent`, `aimToNdc`, `viewportRatioToAim`; new (CrosshairOverlay.tsx 4~32행 본문 그대로 이동)
  - `src/pc/components/CrosshairOverlay.tsx` :: 세 함수 정의 삭제, 재수출 한 줄; modify

### I02. 투영과 총 각도

- Related Files:
  - `src/pc/three/aimProjection.ts` :: `computeAimWorldPoint`, `AIM_TARGET_DISTANCE_M`; new
  - `src/pc/three/gunAim.ts` :: `computeGunAimAngles`; new

#### Details
- **Signatures & Types**:
  ```typescript
  // aimProjection.ts — GameCanvas3D.tsx 88~98행 본문 그대로 이동
  export const AIM_TARGET_DISTANCE_M = 14;
  export function computeAimWorldPoint(camera: THREE.PerspectiveCamera, aimX: number, aimY: number, distanceM = AIM_TARGET_DISTANCE_M): THREE.Vector3;

  // gunAim.ts
  /**
   * 총(카메라 로컬 좌표 gunPos)이 목표(카메라 로컬 좌표 target)를 겨누는 회전.
   * 총 모델의 앞은 로컬 -Z. rotation.order는 'YXZ'(먼저 좌우 yaw, 그다음 상하 pitch)로 적용한다.
   */
  export function computeGunAimAngles(
    gunPos: { x: number; y: number; z: number },
    target: { x: number; y: number; z: number }
  ): { yaw: number; pitch: number };
  ```
- **Execution Flow / Logic**:
  1. `d = target - gunPos`.
  2. `yaw = Math.atan2(-d.x, -d.z)` (목표가 오른쪽이면 음수: Y축 +회전은 -Z를 왼쪽으로 돌리므로).
  3. `pitch = Math.atan2(d.y, Math.hypot(d.x, d.z))` (목표가 위면 양수).

### I03. 총 모델이 각도를 적용

- Related Files:
  - `src/pc/three/DraftTapGun3D.ts` :: `updateAimAndRecoil` → `updateAim`, `GUN_YAW_COMP`(삭제), 생성자(`group.rotation.order = 'YXZ'`); modify

#### Details
- **Signatures & Types**:
  ```typescript
  /** 겨눌 각도(computeGunAimAngles 결과)와 화면 흔들림용 조준값을 받아 반동과 함께 적용한다. */
  public updateAim(angles: { yaw: number; pitch: number }, swayAim: { aimX: number; aimY: number }, dtSec: number, isFeverActive: boolean): void;
  /** 카메라 로컬 좌표에서 총의 회전 중심(기본 위치). GameCanvas3D가 gunAim 계산에 쓴다. */
  public getAimPivot(): THREE.Vector3; // basePosition의 복사본
  ```
- 본문: `targetRotX = angles.pitch + this.currentRecoilPitch`, `targetRotY = angles.yaw`. 위치 흔들림(`aimX * 0.04`, `aimY * 0.03`)·반동 감쇠·개틀링 회전은 지금 코드 그대로(`swayAim` 사용).

### I04. 캔버스 조율

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: 총 갱신 루프(770~800행 부근), `computeAimWorldPoint` 정의(삭제, import로); modify

#### Details
- 루프 안 플레이어 i마다:
  ```typescript
  const world = computeAimWorldPoint(camera, aimState.current.aimX, aimState.current.aimY);
  const local = camera.worldToLocal(world.clone());
  const angles = computeGunAimAngles(gun.getAimPivot(), local);
  gun.updateAim(angles, aimState.current, dtSec, pScore.isFeverActive);
  ```
  카메라 행렬이 갱신된 뒤(`camera.updateMatrixWorld()` 이후) 계산한다.

### I05. 테스트

- Related Files:
  - `tests/gun-aim.test.ts`; new
  - `tests/three-stage-and-models.test.ts`; modify(`updateAimAndRecoil`·`GUN_YAW_COMP`를 쓰던 곳만)

#### Details
- `computeGunAimAngles({0,0,0}, {0,0,-10})` → yaw 0, pitch 0.
- 목표가 오른쪽(`{5,0,-10}`) → yaw < 0, 위(`{0,5,-10}`) → pitch > 0.
- 정확도: 임의의 gunPos·target 5쌍에서 `new THREE.Euler(pitch, yaw, 0, 'YXZ')`로 `(0,0,-1)`을 돌린 벡터와 `normalize(target - gunPos)`의 각도 차가 1e-6 rad 이하.
- 2인 배치 재현: 카메라를 게임과 같은 위치·FOV로 만들고, 왼쪽 총(오프셋 −0.32)·오른쪽 총(+0.32)이 각각 조준(−0.6, 0.3)·(0.5, −0.2)의 월드 지점을 겨눌 때, 총 앞 방향 직선이 그 월드 지점을 0.05m 이내로 지난다.

## Acceptance Criteria
- [ ] three 계층 파일이 `src/pc/components/**`를 import하지 않는다(`grep -rn "from '../components" src/pc/three` → 0).
- [ ] `GUN_YAW_COMP`가 소스에 없다.
- [ ] 1인·2인 모두 같은 각도 계산을 쓴다.

## Validation
- `npx vitest run tests/gun-aim.test.ts tests/three-stage-and-models.test.ts` — 통과
- `grep -rn "from '../components" src/pc/three | wc -l` — `0`
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과

## Commit Message
```text
fix(stage): guns aim at their own crosshair point

Plan: 2026-11-07-two-player-coop-qa-fixes
Phase: P01-fixes
Task: T02-gun-aim

- Move aim/screen mapping to src/pc/aimMapping.ts and the aim projection to three/aimProjection.ts
- computeGunAimAngles points each gun from its pivot at the 3D point under its crosshair (same math for solo and coop)
- Drop the linear yaw gain and GUN_YAW_COMP inward offset

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
