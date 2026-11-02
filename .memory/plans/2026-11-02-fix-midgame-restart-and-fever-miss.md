# Plan: Fix Mid-Game Countdown Restart, Fever Miss Banner/Combo, and Guide Pause/Resume

## Goal
인게임 중 화면 중앙 스냅 사격 시 오래된 클로저(`gamePhase === 'PAIRING'`) 참조로 인해 3, 2, 1 카운트다운이 돌며 게임이 처음부터 리셋되던 치명적 버그를 원천 차단하고, 피버 타임 자동 연사 중 허공 탄환에 의해 `MISS` 배너가 뜨거나 콤보가 깨지는 현상을 완벽히 제거한다. 또한 게임 도중 가이드 모달을 열었을 때 엔진(몬스터 이동, 스폰, 피버/버프/재장전 타이머)이 완벽히 일시정지되고, 가이드를 닫을 때 3, 2, 1 카운트다운 후 0초에 정면 영점을 자동 재보정하며 게임이 재개되도록 구현한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 인게임 리셋 버그 차단, 피버 MISS 배너/콤보 보호, 가이드 일시정지 및 3-2-1 재개 카운트다운 | [P01](../phases/2026-11-02-fix-midgame-restart-and-fever-miss/P01-fix-midgame-restart-fever-miss-and-guide-pause/phase.md) |
