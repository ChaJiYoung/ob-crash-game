# Plan: 조준경 보간·초기 시작 흐름 복원 및 3D 렌더링 성능 최적화 통합 계획

- **Status**: done
- **Created**: 2026-11-04
- **Decisions**:
  - [.memory/decisions/2026-11-04-aim-sync-and-start-flow-fix.md](file:///Users/bigtree/Git/ob-crash-game/.memory/decisions/2026-11-04-aim-sync-and-start-flow-fix.md)
  - [.memory/decisions/2026-11-04-render-perf-optimization.md](file:///Users/bigtree/Git/ob-crash-game/.memory/decisions/2026-11-04-render-perf-optimization.md)

## Goal
모바일 컨트롤러의 급격한 스무딩 계단 점프를 제거하고 PC 조준경에 60fps `requestAnimationFrame` Lerp 보간을 도입하여 조준경 순간이동 현상을 해결한다. 동시에 게임 시작 직후 어두운 3D 카드 시인성 복원 및 선택 안내 배너 추가, 카운트다운/시작 직후 스킬 오발 차단, 평상시 60Hz React 진단 상태 업데이트 격리를 수행하고, 3D 발사체·몬스터 오브젝트 풀링/리소스 캐싱 및 정적 그림자·조명 다이어트를 통해 프레임 드랍과 WebGL 메모리 누수를 근본적으로 해소한다.

## Phases
- [x] **P01: 조준경 양방향 보간, 시작 3D 카드 시인성 복원 및 스킬 오발·진단 오버헤드 차단** (`phases/2026-11-04-aim-sync-and-render-optimization/P01-aim-sync-and-start-flow/phase.md`) ✅
  - [x] `T01`: 모바일 에임 연속 가변 스무딩 곡선, 스냅 임계값 상향(`4.8 m/s²`) 및 카운트다운/시작 1.5초 스냅 가드 구현 ✅
  - [x] `T02`: PC 조준경 rAF Lerp 보간, 3D 카드 네온 테두리 시인성 복원, 시작 카드 안내 배너 및 60Hz 진단 상태 게이트 구현 ✅
- [x] **P02: 3D 발사체·몬스터 리소스 캐싱/풀링, 정적 그림자·조명 다이어트 및 렌더 지표 검증** (`phases/2026-11-04-aim-sync-and-render-optimization/P02-render-pooling-and-lighting-diet/phase.md`) ✅
  - [x] `T01`: `ParticleEffects3D` 트레이서 단위 실린더 스케일링 및 무기 발사체·파편 지오메트리/머티리얼 캐싱·오브젝트 풀링 구현 ✅
  - [x] `T02`: `TargetModels3D`·`DraftTapGun3D` 리소스 캐시(`userData.isShared`), `GameCanvas3D` 안전 `disposeGroup`·정적 그림자·셰이더 예열 및 `BreweryStage3D` 조명 다이어트 구현 ✅
  - [x] `T03`: 센서 연구소 모달 실시간 렌더 성능 지표(`FPS`, `drawCalls`, `geometries`, `textures`) 연동 및 100발 발사/30마리 스폰 리소스 누수 회귀 테스트 작성 ✅
