# Phase 02: 3D 발사체·몬스터 리소스 캐싱/풀링, 정적 그림자·조명 다이어트 및 렌더 지표 검증

- **Plan**: `.memory/plans/2026-11-04-aim-sync-and-render-optimization.md`
- **Status**: done
- **Progress**: done 3/3 (all tasks completed)

## Overview
두 번째 결정 문서(`2026-11-04-render-perf-optimization.md`)의 확정 사항(D01~D03)을 구현한다. 사격 및 몬스터 스폰 시마다 반복 생성되던 Three.js 지오메트리·머티리얼·캔버스 텍스처를 모듈/인스턴스 캐시와 오브젝트 풀로 전환하고, 정적 배경 그림자 맵(`shadowMap.autoUpdate = false`)과 셰이더 사전 컴파일(`renderer.compile`) 및 `HemisphereLight` + 네온 에미시브 조명 다이어트를 적용한다. 마지막으로 센서 연구소 모달에 실시간 렌더 지표를 노출하고 대규모 발사/스폰 리소스 누수 회귀 테스트를 추가한다.

## Tasks
- [x] **T01**: `ParticleEffects3D` 트레이서 단위 실린더 스케일링 및 무기 발사체·파편 지오메트리/머티리얼 캐싱·오브젝트 풀링 구현 (`T01-projectile-tracer-object-pool.md`) ✅
- [x] **T02**: `TargetModels3D`·`DraftTapGun3D` 리소스 캐시(`userData.isShared`), `GameCanvas3D` 안전 `disposeGroup`·정적 그림자·셰이더 예열 및 `BreweryStage3D` 조명 다이어트 구현 (`T02-target-resource-cache-and-lighting-diet.md`) ✅
- [x] **T03**: 센서 연구소 모달 실시간 렌더 성능 지표(`FPS`, `drawCalls`, `geometries`, `textures`) 연동 및 100발 발사/30마리 스폰 리소스 누수 회귀 테스트 작성 (`T03-render-diagnostics-metrics-and-regression-tests.md`) ✅
