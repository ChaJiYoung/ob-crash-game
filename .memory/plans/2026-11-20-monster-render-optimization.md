# Plan: Monster Render Optimization

## Goal
Chrome DevTools 프로파일링으로 확인된 몬스터 대량 스폰 시의 2대 렌더링 병목—(1) 매 프레임 DOM `left`/`top`/`width` 갱신으로 인한 레이아웃 스래싱(`UpdateLayoutTree` 3,861회), (2) 개별 바닥 그림자 메시 및 비캐싱 재질로 인한 드로우콜·스폰 스파이크(최대 90.17ms)—을 해결하여 1P/2P 고밀도 웨이브에서도 안정적인 프레임을 유지한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done ✅` | 몬스터 HP 바를 단일 2D `<canvas>` 오버레이로 교체하여 DOM 레이아웃 연산 0회 달성 | [P01](../phases/2026-11-20-monster-render-optimization/P01-hp-bar-canvas/phase.md) |
| P02 | `done ✅` | 바닥 그림자 `InstancedMesh` 통합, 미캐싱 재질 공유화, 웜업/성능 실측 검증 | [P02](../phases/2026-11-20-monster-render-optimization/P02-shadow-instancing-and-cache/phase.md) |
