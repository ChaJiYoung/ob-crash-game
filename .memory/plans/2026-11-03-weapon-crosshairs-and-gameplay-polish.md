# Plan: Weapon Crosshairs, Hit-Detection & Gameplay Quality Polish

## Goal
3종 무기 아키타입(🪠 맥주관 뚫어뻥 샷건 / 🍾 황금 병따개 리볼버 / 🍺 탄산 탭 개틀링)별 전용 조준경 HUD를 렌더링하고 실제 히트 판정 범위를 1:1로 일치시켜 부당한 MISS 판정을 제거한다. 또한 보상 카드 연타 오선택 방지(0.8초 사격 면역 딜레이), 피버 발동 시 즉시 탄창 100% 강제 리필, 모바일 스냅 에임 고정 시간 연장(350ms), 황금 캔 출현 알림(사운드/골드 테두리), 투사체 요격 `[INTERCEPTED! 🛡️]` 전용 아케이드 피드백을 적용하여 오락실급 완성도와 손맛을 완성한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 무기별 조준경 UI, 히트 판정 동기화, 보상 카드 0.8초 딜레이, 3D 카드 대형화, 피버 즉시 리필, 모바일 스냅 350ms 및 아케이드 피드백 통합 구현 | [P01](../phases/2026-11-03-weapon-crosshairs-and-gameplay-polish/P01-crosshairs-and-gameplay-polish/phase.md) |
