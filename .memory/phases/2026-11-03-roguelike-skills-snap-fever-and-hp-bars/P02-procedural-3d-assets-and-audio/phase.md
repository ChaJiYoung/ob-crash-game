---
id: P02-procedural-3d-assets-and-audio
plan: 2026-11-03-roguelike-skills-snap-fever-and-hp-bars
title: Phase 2 — Procedural 3D Weapons (Lv.1~MAX), Special Target Meshes, Skill FX & Synth Audio
status: done
progress: "done: 2/2"
---

# Overview

[`weapon-showroom-preview.html`](../../../weapon-showroom-preview.html) 프로토타입에서 검증된 프로시저럴 3D 에셋 레퍼런스를 바탕으로, 리얼 고무 벨 뚫어뻥(`createRealisticPlungerMesh`)과 3종 무기 × 4단계(Lv.1~MAX) 외형 진화(`DraftTapGun3D`), 황금 캔·투사체·보상 카드 3D 메쉬(`TargetModels3D`), 그리고 무기별 비행 탄환 & 3종 액티브 스킬 이펙트(`ParticleEffects3D` — 8방향 포물선 뚫어뻥 폭풍·몬스터 부착·바닥 튕김 물리, 회전 오프너 부메랑, 160도 거품 해일) 및 Web Audio 타격음(`SoundSynthesizer`)을 구현한다.

# Tasks

- [x] **T01-procedural-3d-weapons-and-special-targets**: 리얼 고무 벨 뚫어뻥(`createRealisticPlungerMesh`), `DraftTapGun3D` 3종 무기 × 4단계(Lv.1~MAX) 총열/파츠 외형 진화, `TargetModels3D` 황금 캔·투사체·사격형 카드 3D 메쉬 및 기절 몬스터 뚫어뻥 부착 연출 (`status: done`)
- [x] **T02-3d-projectiles-skill-fx-and-synth-audio**: `ParticleEffects3D` 무기별 3D 비행 탄환 & 3종 액티브 스킬 물리 이펙트(8방향 포물선 뚫어뻥 폭풍·바닥 튕김, 오프너 회전 부메랑, 160도 거품 해일), `GameCanvas3D` 씬 연동, `SoundSynthesizer` 무기/스킬 타격음 합성 (`status: done`)
