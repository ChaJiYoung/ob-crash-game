# Task: T01 Fix Muzzle Flash and Soften Stage Pulses

## Status: done

## Goal
사격할 때 총구 플래시가 화면 대부분을 덮지 않게 하고, 피버·위기 조명의 빠른 깜빡임을 줄인다. 사용자가 "배경 전체가 번쩍거린다"고 지적한 문제의 직접 원인을 제거한다.

## Decision Summary
- D02: `ParticleEffects3D.ts:765`가 크기를 절대값 1.0~1.5로 덮어쓰는 버그가 원인이다. 카메라 1.63m 앞에 반경 1m 이상의 구체가 생긴다.
- 이전 계획처럼 `flashRadius`만 줄이면 매 프레임 덮어써져 효과가 없다.

## Implementation

### I01. 플래시 크기와 투명도 수정

- Related Files:
  - `src/pc/three/ParticleEffects3D.ts` :: `TracerBeamItem`, `acquireTracerItem`, `spawnTracerBeam`, `update` — 플래시 크기 계산 수정; modify

#### Details
- **Signatures & Types**:
  ```typescript
  interface TracerBeamItem {
    beamMesh: THREE.Mesh;
    flashMesh: THREE.Mesh;
    flashBaseRadius: number; // 추가
    lifeSec: number;
    maxLifeSec: number;
  }

  const FLASH_MAX_OPACITY = 0.55; // 파일 상단 모듈 상수
  ```
- **Execution Flow / Logic**:
  1. `acquireTracerItem`이 새 항목을 만들 때 `flashBaseRadius: 0.07`을 넣는다.
  2. `spawnTracerBeam`:
     - `const flashRadius = isFeverOrPower ? 0.10 : 0.07;` (기존 0.16 / 0.11)
     - `item.flashBaseRadius = flashRadius;`
     - 플래시 초기 투명도를 `FLASH_MAX_OPACITY`로 설정한다. 빔 투명도 0.95는 유지한다.
  3. `update`의 트레이서 루프에서 765행을 아래로 교체한다.
     ```typescript
     (tb.flashMesh.material as THREE.MeshBasicMaterial).opacity = fade * FLASH_MAX_OPACITY;
     tb.flashMesh.scale.setScalar(tb.flashBaseRadius * (1.0 + (1.0 - fade) * 0.5));
     ```

### I02. 무대 조명 깜빡임 완화

- Related Files:
  - `src/pc/three/BreweryStage3D.ts` :: `updateStageAnimation` — 진폭·주파수 축소; modify

#### Details
- **Execution Flow / Logic**: 아래 값으로 바꾼다. 색상 전환은 그대로 둔다.
  | 대상 | 기존 | 변경 |
  | :--- | :--- | :--- |
  | 피버 `amberNeon.intensity` | `4.2 + sin(t*12)*1.8` | `2.8 + sin(t*4)*0.4` |
  | 피버 `cyanNeon.intensity` | `3.6` | `2.8` |
  | 위험 `alertLight.intensity` | `3.6 + sin(t*16)*2.4` | `2.0 + sin(t*6)*0.6` |
  | 위험 `neonRimMat.opacity` | `min(1, 0.85 + sin(t*16)*0.25)` | `0.85 + sin(t*6)*0.1` |

### I03. 회귀 테스트

- Related Files:
  - `tests/three-stage-and-models.test.ts` :: 새 `it` 추가 — 플래시 크기 회귀 방지; modify

#### Details
- 시나리오: `fx.spawnTracerBeam(origin, target, '#00f5d4', false)` 후 `fx.update(0.016)` 호출.
- 검증: `fx.group.children` 중 플래시 메시의 `scale.x`가 0.15 미만이다. 활성 트레이서의 플래시를 찾기 어려우면 `getPoolStats()` 옆에 `getActiveFlashScales(): number[]`를 추가해 사용한다.
- `isFeverOrPower = true`에서도 0.2 미만인지 함께 확인한다.

## Acceptance Criteria
- [x] 한 발 쏜 뒤 플래시가 총구 주변에만 보이고 화면을 덮지 않는다.
- [x] 트레이서 빔은 그대로 보인다.
- [x] 피버와 위험 상태에서 조명이 빠르게 깜빡이지 않는다.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts` — 새 테스트 포함 통과
- `npm test` — 전체 110개 + 새 테스트 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
fix(render): stop muzzle flash from covering the whole screen

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P01-render-and-stutter
Task: T01-fix-muzzle-flash-and-soften-stage-pulses

- Animate flash relative to its base radius instead of absolute scale 1.0~1.5
- Lower flash radius and opacity
- Slow fever and danger light pulses
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: fix(render): stop muzzle flash from covering the whole screen
