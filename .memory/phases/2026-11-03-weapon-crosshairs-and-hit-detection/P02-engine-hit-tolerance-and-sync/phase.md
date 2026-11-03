# Phase 2: Engine Hit Tolerance and Crosshair Synchronization

- **Plan**: [.memory/plans/2026-11-03-weapon-crosshairs-and-hit-detection.md](../../plans/2026-11-03-weapon-crosshairs-and-hit-detection.md)
- **Status**: todo
- **Progress**: 0/1 tasks completed (0%)

## Objectives
1. `BeerCrusherEngine.ts`의 `shootAt` 로직에서 무기 종류별(`shotgun`, `revolver`, `gatling`) 유효 피격 허용 배율(`weaponHitToleranceMult`)을 적용하여 조준경 시각적 범위와 피격 판정 범위를 1:1로 일치.
2. 조준경 원 안에 걸친 적이 부당하게 `MISS` 판정받아 콤보/피버가 파괴되는 문제를 해결하고 단위 테스트(`src/tests/WeaponCrosshairHitDetection.test.ts`)로 검증.

## Tasks
- [ ] `T01-engine-weapon-hit-tolerance.md`: 무기별 히트 판정 허용 배율 적용 및 단위 테스트 검증
