# Task: T01 Floor Line and Remove Bar Wall

## Status: done

## Goal
카드와 몬스터를 가리는 벽을 없애고, 방어선을 플레이어 앞쪽 바닥의 굵은 네온 라인으로 보여 준다.

## Decision Summary
- D13: `barCounter`, `brassRail`, 탭 타워를 제거한다. 바닥선은 폭 12cm(R 1.86~1.98) 네온 한 줄이다. 줄무늬 띠와 거리선 3개는 제거한다.
- **벽만 치우면 선이 보이지 않는다.** `rotation.z = Math.PI` 때문에 실측 위치가 z 0~1.98(플레이어 뒤쪽)이다. 몬스터는 -z에서 온다.

## Implementation

### I01. 무대 수정

- Related Files:
  - `src/pc/three/BreweryStage3D.ts` :: `buildBreweryStage3D`, `createHazardStripeTexture` — 메시 정리와 방향 수정; modify
  - `src/pc/components/GameCanvas3D.tsx` :: 카드 `baseY` 주석 — 낡은 설명 수정; modify

#### Details
- **Execution Flow / Logic**:
  1. 지울 코드:
     - `createHazardStripeTexture` 함수, `hazardTex`, 줄무늬 메시(`defArcGeo`, `defArcMat`)
     - `barCounterGeo`, `barCounterMat`, `barCounter`
     - `brassRailGeo`, `brassRailMat`, `brassRail`
     - `towerMat`과 탭 타워 루프
     - `distanceArcRadii`와 거리선 루프 전체
  2. 네온 라인으로 교체한다. `rotation.z = Math.PI`를 **쓰지 않는다.** `RingGeometry(..., 0, Math.PI)`는 +y 반원이고, `rotation.x = -π/2`만 적용하면 -z(몬스터 쪽)로 눕는다.
     ```typescript
     const neonRimGeo = new THREE.RingGeometry(1.86, 1.98, 64, 1, 0, Math.PI);
     const neonRimMat = new THREE.MeshBasicMaterial({
       color: 0xf59e0b,
       side: THREE.DoubleSide,
       transparent: true,
       opacity: 0.85,
       depthWrite: false,
     });
     const neonRimMesh = new THREE.Mesh(neonRimGeo, neonRimMat);
     neonRimMesh.rotation.x = -Math.PI / 2;
     neonRimMesh.position.set(0, 0.022, 0);
     root.add(neonRimMesh);
     ```
  3. 힐 펄스: `healPulseGeo`를 `RingGeometry(1.84, 2.0, 48, 1, 0, Math.PI)`로 바꾸고 `rotation.z = Math.PI`를 지운다.
  4. `BreweryStageRig.defenseArcMesh`는 유지하고 `neonRimMesh`를 반환한다. 다른 코드와 테스트가 이 필드를 쓴다.
  5. `updateStageAnimation`의 `neonRimMat` 처리(평소 황금색, 위험 시 빨강)는 유지한다.
  6. `GameCanvas3D.tsx`의 `baseY = 1.50; // ... 바 카운터에 가려지지 않도록` 주석에서 바 카운터 언급을 지운다. 값은 그대로 둔다.

### I02. 테스트

- Related Files:
  - `tests/three-stage-and-models.test.ts` — 새 `it` 추가; modify

#### Details
- `rig.defenseArcMesh`의 위치 버텍스를 `localToWorld`로 변환했을 때 모든 z가 `0.001` 이하이고, 가장 먼 점이 약 z -1.98이다. **이 테스트가 뒤집힘 재발을 막는다.**
- `rig.healPulseMesh`도 같은 검사를 한다.
- `root.traverse`에서 반지름 1.85 `CylinderGeometry`와 반경 1.86 `TorusGeometry`가 없다.
- `RingGeometry`가 바닥선과 힐 펄스 2개뿐이다.

## Acceptance Criteria
- [x] 카드가 하단 `SHOOT TO SELECT`까지 다 보인다.
- [x] 화면 아래쪽 바닥에 황금색 곡선이 보이고, 위험할 때 빨갛게 깜빡인다.
- [x] 수리 아이템을 먹으면 힐 펄스가 앞쪽 바닥에서 퍼진다.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- `node .memory/references/scripts/capture-start-state.mjs`의 스크린샷으로 카드와 선 확인

## Commit Message
```text
fix(stage): remove bar wall and show defense line in front of the player

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P02-stage-and-input
Task: T01-floor-line-and-remove-bar-wall

- Remove bar counter, brass rail, tap towers, hazard stripes, and distance arcs
- Fix flipped floor rings that were drawn behind the player
- Use a 12cm neon line and add a world position regression test
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: fix(stage): remove bar wall and show defense line in front of the player
