---
id: P01-roguelike-engine-weapons-and-gimmicks
plan: 2026-11-03-roguelike-skills-snap-fever-and-hp-bars
title: Phase 1 — Shared Weapon/Skill Balance Specs & Core Roguelike Combat Engine
status: done
progress: "done: 2/2"
---

# Overview

3종 무기 아키타입(`shotgun`, `revolver`, `gatling`)의 Lv.1~MAX 너프 밸런스 테이블, 상향된 몬스터 체력(`hanmac: 3`, `bottle: 4`, `boss: 60`), 4초 초고밀도 피버 상수를 정의하고, `WeaponSystem`과 `BeerCrusherEngine`에 사격형 카드 선택(Shoot-to-Select), 무기별 고유 탄도(산탄/관통/속사), 액티브 스킬 3종 판정(기절/둔화/넉백), 황금 캔 및 투사체 요격 기믹을 구현한다.

# Tasks

- [x] **T01-shared-specs-and-weapon-archetype-system**: 공유 타입(`WeaponKind`, `WeaponLevel`, `RewardCardKind`), 너프된 Lv.1~MAX 밸런스 상수(`WEAPON_ARCHETYPE_SPECS`), 몬스터 상향 체력(`TARGET_SPECS`), 4초 피버(`FEVER_CONSTANTS`), `WeaponSystem` 무기/스킬 쿨타임 관리 확장 (`status: done`)
- [x] **T02-engine-roguelike-cards-skills-and-gimmicks**: `BeerCrusherEngine` 필드 아이템 스폰 제거, 시작 무기 타겟 및 웨이브 보상 카드 사격 선택(Shoot-to-Select), 3종 무기별 탄도(산탄/관통/속사) 및 전용 액티브 스킬(뚫어뻥 폭풍/오프너 참격/거품 해일), 황금 캔 & 한맥·보스 투사체 요격 기믹 구현 (`status: done`)
