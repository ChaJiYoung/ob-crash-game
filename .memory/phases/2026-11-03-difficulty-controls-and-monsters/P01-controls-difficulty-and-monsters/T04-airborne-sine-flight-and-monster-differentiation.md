# Task: T04 비행 S자 유영, 카스 병맥주 2.45배 대형화+통통 바운스(3HP), 한맥 버서커 가속 구현

## Status: done

## Goal
직선으로만 다가와 밋밋하던 비행 몬스터(필굿, 카스라이트)에 부드러운 S자 지그재그 유영 비행 궤적을 부여하고, 카스 병맥주를 2.45배 대형화 및 좌우로 통통 튀며 바운스 전진하는 3HP 탱커로 진화시키며, 한맥 피격 시 30% 빨라지는 버서커 돌진 기믹을 Three.js 렌더링 및 엔진 조준 판정과 1:1로 동기화 구현한다.

## Decision Summary
- [D04, D05](../decisions/2026-11-03-difficulty-and-monsters.md): 비행 몬스터 S자 유영 비행, 카스 병맥주 `modelScale` 2.45 & `hitRadiusM` 1.35 & 3HP 유지 & 좌우 통통 바운스, 한맥 피격 시 버서커 가속.

## Implementation

### I01. types.ts 및 constants.ts 스펙 정의

- Related Files:
  - `src/shared/types.ts` :: `ActiveTargetEntity` — 타겟 엔티티 인터페이스; modify
  - `src/shared/constants.ts` :: `TARGET_SPECS` — 몬스터 스펙 상수; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/shared/types.ts
  export interface ActiveTargetEntity {
    // 기존 필드들...
    initialThetaRad?: number; // S자 유영 기준 방사 각도
    isEnraged?: boolean;       // 한맥 피격 시 버서커 분노 상태 플래그
  }

  // src/shared/constants.ts
  export const TARGET_SPECS: Record<TargetKind, TargetSpec> = {
    // ...
    caslight: {
      kind: 'caslight',
      displayName: '카스 라이트 (Cass Light)',
      maxHp: 1,
      speedMps: 2.4, // 날렵한 회피 비행을 위해 소폭 상향 (기존 2.2 -> 2.4)
      hitRadiusM: 0.90,
      killBonusScore: 40,
      brandColorHex: '#38bdf8',
      accentColorHex: '#e2e8f0',
      isAirborne: true,
      modelScale: 1.85,
    },
    bottle: {
      kind: 'bottle',
      displayName: '카스 프레시 병맥주 (Cass Fresh Bottle)',
      maxHp: 3, // 사용자 요청: 3HP 그대로 유지!
      speedMps: 1.5,
      hitRadiusM: 1.35, // 기존 1.15 -> 1.35 확대 (대형화 매칭)
      killBonusScore: 160,
      brandColorHex: '#004b91',
      accentColorHex: '#e2e8f0',
      isAirborne: false,
      modelScale: 2.45, // 기존 1.95 -> 2.45 대폭 확대 (중형 탱커)
    },
    // ...
  };
  ```

### I02. BeerCrusherEngine 궤적 계산 및 한맥 버서커 기믹 연동

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `BeerCrusherEngine` — 궤적 전진 및 피격 기믹; modify

#### Details
- **Execution Flow / Logic**:
  1. `spawnNextTarget`:
     - 타겟 생성 시 `entity.initialThetaRad = pt.thetaRad;` 저장.
  2. `update(nowMs, dtSec)` 전진 루프:
     - 비행 몬스터 S자 유영:
       - `target.isAirborne && target.initialThetaRad !== undefined`인 경우:
         - `pilgood`: `target.thetaRad = target.initialThetaRad + Math.sin(nowMs * 0.003 + target.radiusM * 0.4) * 0.08;`
         - `caslight`: `target.thetaRad = target.initialThetaRad + Math.sin(nowMs * 0.006 + target.radiusM * 0.7) * 0.06;`
         - 삼각함수로 갱신: `target.x = Math.sin(target.thetaRad) * target.radiusM; target.z = -Math.cos(target.thetaRad) * target.radiusM;`
     - 한맥 버서커 속도:
       - `target.kind === 'hanmac' && target.isEnraged`인 경우 `effectiveSpeed *= 1.3;` (30% 가속)
  3. `shootAt`:
     - 몬스터 피격 시 `target.kind === 'hanmac' && !killed`이면 `target.isEnraged = true;` 설정.

### I03. TargetModels3D 병맥주 바운스 및 비행 모델 동기화

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `updateTargetAnimation3D`, `createTargetMesh3D` — 3D 모델 및 애니메이션; modify

#### Details
- **Execution Flow / Logic**:
  1. `createTargetMesh3D('bottle')`:
     - `spec.modelScale` (2.45) 적용으로 화면 중앙에서 웅장한 대형 병 실루엣 노출.
     - 바닥 그림자 반경도 확대된 스케일에 맞춰 자동 비례 확장.
  2. `updateTargetAnimation3D`:
     - `kind === 'bottle'`:
       - 단순 진동이 아닌, 탄력 있는 통통 바운스(`bounce = Math.abs(Math.sin(elapsedSec * 6.0)) * 0.28;`) 및 좌우 롤링 틸트(`inner.rotation.z = Math.sin(elapsedSec * 3.0) * 0.12;`) 부여.
     - `pilgood` & `caslight`:
       - 공중에서 부드러운 상하 유영 및 날갯짓 펄럭임 강화.

### I04. Three.js 단위 테스트 갱신 및 검증

- Related Files:
  - `tests/three-stage-and-models.test.ts` — 3D 모델 생성 및 애니메이션 테스트; modify/verify

#### Details
- `bottle`의 모델 스케일이 2.45로 생성되고 정상적으로 애니메이션 업데이트되는지 검증.

## Acceptance Criteria
- [x] 필굿과 카스라이트가 직선이 아닌 S자 곡선 유영으로 접근하며, 조준점이 곡선 궤적을 정확히 추적한다.
- [x] 카스 병맥주가 2.45배 대형화되어 노출되고, 체력은 3HP를 유지하며, 좌우로 활기차게 통통 튀며 전진한다.
- [x] 한맥이 1타 피격 시 분노하여 이동 속도가 30% 증가한다.
- [x] Three.js 시각 위치와 엔진 조준 판정 NDC 좌표가 오차 없이 1:1로 일치한다.
- [x] `tests/three-stage-and-models.test.ts` 테스트가 통과한다.

## Validation
- `npm test tests/three-stage-and-models.test.ts` — 3D 스테이지 및 모델 테스트 통과 (exit code 0)

## Commit Message
```text
feat(three): implement airborne sine flight, cass bottle bouncy tanker, and hanmac berserk

Plan: 2026-11-03-difficulty-controls-and-monsters
Phase: P01-controls-difficulty-and-monsters
Task: T04-airborne-sine-flight-and-monster-differentiation

- Add sine wave S-curve flight trajectory for airborne targets (pilgood, caslight)
- Scale Cass bottle to 2.45x with bouncy rolling tanker motion while keeping 3HP
- Implement 30% berserk speed acceleration on hit for hanmac
- Synchronize 3D visuals with engine projection coordinates
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
