# Phase 1: Weapon-Specific Crosshairs HUD

- **Plan**: [.memory/plans/2026-11-03-weapon-crosshairs-and-hit-detection.md](../../plans/2026-11-03-weapon-crosshairs-and-hit-detection.md)
- **Status**: in-progress
- **Progress**: 0/1 tasks completed (0%)

## Objectives
1. `CrosshairOverlay.tsx`에 `weaponKind?: WeaponKind`, `weaponLevel?: WeaponLevel` 속성을 추가하고, 3종 무기별 고유 HUD 비주얼(샷건 120px 펠릿 링, 리볼버 76px 스나이퍼 십자선/도트, 개틀링 88px 회전 톱니) 및 레벨별 디테일 렌더링.
2. `PCGamePage.tsx`에서 엔진 `weaponSystem.getState()`로부터 현재 무기 종류 및 레벨을 전달하여 실시간 반영.

## Tasks
- [ ] `T01-weapon-crosshair-overlay.md`: CrosshairOverlay 무기별 비주얼 구현 및 PCGamePage 연동
