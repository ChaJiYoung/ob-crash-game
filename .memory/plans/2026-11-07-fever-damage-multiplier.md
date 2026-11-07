# Plan: 피버 대미지 배율과 보스 배율 정리

## Goal
피버 중 모든 명중이 GREAT(×1.0)로 고정돼 평소 PERFECT(×2.0)보다 약해지는 문제를 없앤다. 피버 중 판정 배율을 `GAME_TUNING.judgment.feverDamage = 2.0`으로 올리고, 보스 무기별 배율(`boss.damageScaleByWeapon`)을 전 무기 1.0으로 맞춘다.
결정: [2026-11-07-fever-damage-multiplier](../decisions/2026-11-07-fever-damage-multiplier.md)

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done ✅` | 피버 대미지 2.0, 보스 배율 1.0 | [P01](../phases/2026-11-07-fever-damage-multiplier/P01-fever-and-boss-scale/phase.md) |
