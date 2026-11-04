# Phase 01: 조준경 양방향 보간, 시작 3D 카드 시인성 복원 및 스킬 오발·진단 오버헤드 차단

- **Plan**: `.memory/plans/2026-11-04-aim-sync-and-render-optimization.md`
- **Status**: done
- **Progress**: done 2/2

## Overview
첫 번째 결정 문서(`2026-11-04-aim-sync-and-start-flow-fix.md`)의 확정 사항(D01~D04)을 구현한다. 모바일 컨트롤러의 속도 비례 연속 스무딩 곡선과 PC 조준경의 60fps `requestAnimationFrame` Lerp 보간을 결합해 조준경 순간이동을 없애고, 시작 시 어두운 3D 카드의 자체 발광 네온 프레임과 상단 안내 배너를 추가하며, 카운트다운/시작 직후 스킬 오발 방지 가드 및 평상시 60Hz React 진단 상태 업데이트 차단을 완성한다.

## Tasks
- [x] **T01**: 모바일 에임 연속 가변 스무딩 곡선, 스냅 임계값 상향(`4.8 m/s²`) 및 카운트다운/시작 1.5초 스냅 가드 구현 (`T01-mobile-aim-curve-and-snap-guard.md`) ✅
- [x] **T02**: PC 조준경 rAF Lerp 보간, 3D 카드 네온 테두리 시인성 복원, 시작 카드 안내 배너 및 60Hz 진단 상태 게이트 구현 (`T02-pc-crosshair-lerp-card-visibility-and-diag-gate.md`) ✅
