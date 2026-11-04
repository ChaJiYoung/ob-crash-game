# Task: T04 Replace Point Lights with Neon Strips

## Status: pending

## Goal
장식용 포인트 라이트 3개를 없애 PBR 재질의 픽셀 연산을 줄인다. 피버 전환과 위험 표시는 유지한다.

## Decision Summary
- D16: `amberNeon`, `cyanNeon`, `alertLight`를 제거하고 발광 메시와 `HemisphereLight` 변화로 대체한다.
- 효과는 약 8%로 작다. 분위기가 크게 달라지면 사용자에게 알리고 조정한다.

## Implementation

### I01. 변경 전 화면 저장

- Related Files:
  - `.memory/references/scripts/capture-start-state.mjs` — 스크린샷; read-only

#### Details
- **코드를 고치기 전에** `npm run dev`를 켠 상태에서 `node .memory/references/scripts/capture-start-state.mjs`를 실행하고, `out/start-state.png`를 `out/lights-before.png`로 복사한다.

### I02. 조명 교체

- Related Files:
  - `src/pc/three/BreweryStage3D.ts` :: `BreweryStageRig`, `buildBreweryStage3D`, `updateStageAnimation` — 라이트 제거; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface BreweryStageRig {
    root: THREE.Group;
    neonStrips: THREE.Mesh[]; // neonLights 대체
    defenseArcMesh: THREE.Mesh;
    healPulseMesh: THREE.Mesh;
    triggerHealPulse: () => void;
    updateStageAnimation: (elapsedSec: number, isFeverActive: boolean, dangerAlert: boolean) => void;
  }
  ```
- **Execution Flow / Logic**:
  1. `amberNeon`, `cyanNeon`, `alertLight`, `neonLights`를 지운다. `hemiLight`, `ambientLight`, `mainDirLight`는 유지한다.
  2. 메시를 추가한다.
     - `amberStrip`: `BoxGeometry(6, 0.12, 0.12)`, `MeshBasicMaterial({ color: 0xf59e0b })`, 위치 `(0, 6, -14)`
     - `cyanTubeMesh`: 기존 메시를 그대로 쓰고 머티리얼 변수를 `cyanTubeMat`로 뺀다.
     - `neonStrips = [amberStrip, cyanTubeMesh]`
  3. `updateStageAnimation`:
     ```typescript
     if (isFeverActive) {
       amberStripMat.color.setHex(0xffd700);
       cyanTubeMat.color.setHex(0xf59e0b);
       hemiLight.color.setHex(0xffe08a);
       hemiLight.intensity = 1.05 + Math.sin(elapsedSec * 4) * 0.1;
     } else {
       amberStripMat.color.setHex(0xf59e0b);
       cyanTubeMat.color.setHex(0x06b6d4);
       hemiLight.color.setHex(0xfff0d8);
       hemiLight.intensity = 0.85 + Math.sin(elapsedSec * 2) * 0.05;
     }
     hemiLight.groundColor.setHex(dangerAlert ? 0x7f1d1d : 0x1e293b);
     ```
     `neonRimMat` 처리와 힐 펄스 코드는 유지한다.

### I03. 테스트 갱신

- Related Files:
  - `tests/three-stage-and-models.test.ts` :: `:142`, `:173` — 새 인터페이스 반영; modify

#### Details
- `:142` `rig.neonLights.length >= 3` → `rig.neonStrips.length >= 2`
- `:173` 앰버 라이트 검사 → `neonStrips`에 색상이 `0xf59e0b`인 메시가 있는지 확인
- 추가: 스테이지 `root.traverse`로 `isPointLight`가 하나도 없는지 확인
- 추가: `updateStageAnimation(1, true, false)` 뒤 스트립 색이 `0xffd700`인지 확인

### I04. 변경 후 화면 비교

#### Details
- 같은 스크립트로 `out/lights-after.png`를 만든다. 두 이미지를 직접 보고, 분위기가 크게 다르면 `hemiLight`·`ambientLight` 세기를 ±0.2 범위에서 맞춘다.
- 조정 후에도 크게 다르면 커밋 전에 사용자에게 비교 이미지를 보여 주고 판단을 받는다.

## Acceptance Criteria
- [ ] 스테이지에 포인트 라이트가 없다.
- [ ] 피버 때 조명 색이 황금색으로 바뀐다.
- [ ] 위험할 때 바닥 쪽 빛이 붉어지고 바닥선이 깜빡인다.
- [ ] 전후 스크린샷의 분위기가 비슷하다.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
perf(stage): replace decorative point lights with neon strips

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P01-render-and-stutter
Task: T04-replace-point-lights-with-neon-strips

- Remove amber, cyan, and alert point lights
- Drive fever and danger mood with neon meshes and hemisphere light
- Update stage rig tests
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
