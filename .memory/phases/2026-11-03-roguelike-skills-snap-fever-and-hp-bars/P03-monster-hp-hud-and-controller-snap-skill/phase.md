---
id: P03-monster-hp-hud-and-controller-snap-skill
plan: 2026-11-03-roguelike-skills-snap-fever-and-hp-bars
title: Phase 3 — 3D Monster Neon Dot HP Bars, Weapon/Skill HUD & Mobile '휙!' Snap Active Skill
status: done
progress: "done: 2/2"
---

# Overview

PC 화면(`ArcadeOverlayHUD.tsx`, `PCGamePage.tsx`)에 다회 타격 몬스터(`maxHp >= 2`)의 3D 머리 위를 실시간 추적하는 슬림 네온 도트 체력바(HP Bar)와 현재 장착 무기/레벨/탄약 및 액티브 스킬 쿨타임·스택 배지를 렌더링하고, 모바일 컨트롤러(`MobileControllerPage.tsx`, `GunGripPad.tsx`, `server/index.ts`)에서 스마트폰을 위로 '휙!(Snap)' 젖히는 가속도 제스처를 전용 액티브 스킬 트리거(`skillSnapTriggered`)로 연결한다.

# Tasks

- [x] **T01-monster-3d-hp-bars-and-weapon-skill-hud**: `ArcadeOverlayHUD` 3D 투영 몬스터 슬림 네온 도트 체력바(`maxHp >= 2`), 무기 레벨·동적 탄창·스킬 쿨타임/스택 HUD, `PCGamePage` 키보드(`R`)/마우스 우클릭 스킬 발동 및 개틀링 홀드 연사 연동 (`status: done`)
- [x] **T02-mobile-controller-snap-skill-and-sync**: `MobileControllerPage` & `GunGripPad` '휙!(Snap)' 가속도 제스처 액티브 스킬 트리거(`skillSnapTriggered`), `SKILL_STATE_SYNC` 소켓 동기화 및 충전 완료 햅틱 진동 (`status: done`)
