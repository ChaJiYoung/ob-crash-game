# Plan: Fix Start Card Visibility & Remove Amber Box

## Goal
게임 시작 시 중앙 상단에 불필요하게 떠 있던 주황색 직사각형 메쉬(`amberSignMesh`)를 제거하여 펍 배경을 깔끔하게 정리하고, React 18 StrictMode 및 재마운트 시 발생하던 `GameCanvas3D` 좀비 rAF 루프와 씬-타겟 메쉬 불일치 문제를 해결하여 3D 시작 카드 3장(샷건, 리볼버, 개틀링)이 누락 없이 즉시 렌더링되도록 복원한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 주황색 상자 메쉬 삭제, rAF 캔슬 누락 수정 및 3D 카드 씬 동기화 보장 | [P01](../phases/2026-11-04-fix-start-card-visibility-and-remove-amber-box/P01-cleanup-and-card-rendering/phase.md) |
