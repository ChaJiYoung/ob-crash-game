# Plan: Debug Mode (무적 테스트 플레이, 랭킹 미등록)

Decisions: [2026-11-17-debug-mode](../decisions/2026-11-17-debug-mode.md)

## Goal
PC 화면에 `?debug=1`을 붙이면 로비에서 시작 조건(W1/W6/EX, 무기 Lv, 카드 스택)을 고르고 무적으로 플레이한다. 판은 평소처럼 DB에 저장되지만 `games.is_debug = 1`로 표시되어 모든 랭킹·최고점·협동 기록에서 빠진다. 피격 수(웨이브별, EX DANGER별)는 결과 화면과 로비 디버그 패널 [최근 기록]에서 볼 수 있다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done ✅` | DB v2 마이그레이션, 디버그 판 저장·랭킹 제외, EX DANGER 피격 저장, 최근 디버그 기록 조회 WS | [P01](../phases/2026-11-17-debug-mode/P01-server-db-debug-flag/phase.md) |
| P02 | `done ✅` | 엔진 무적, 디버그 시작 조건 적용, EX DANGER별 피격 집계 | [P02](../phases/2026-11-17-debug-mode/P02-engine-debug-play/phase.md) |
| P03 | `done ✅` | `?debug=1` 연결, 로비 디버그 패널, HUD·결과 화면 표시 | [P03](../phases/2026-11-17-debug-mode/P03-pc-debug-ui/phase.md) |
