# Plan: Lobby Compact Layout & Weapon-Filtered Top 10 Ranking

## Goal
로비(`QRPairingModal`)의 세로 높이를 줄여 노트북 화면에서도 외곽 스크롤 없이 한눈에 들어오게 하고, 개인 랭킹(종합 + 샷건/리볼버/개틀링 무기별) 및 팀 랭킹을 플레이어/팀당 최고 기록 기준 10위까지 내부 스크롤로 조회할 수 있도록 백엔드·프로토콜·프론트엔드를 확장한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done ✅` | 플레이어별 최고 기록 기반 Top 10(종합·무기별·팀) 쿼리 및 WebSocket 페이로드 확장 | [P01](../phases/2026-11-17-lobby-compact-weapon-ranking/P01-backend-weapon-ranking/phase.md) |
| P02 | `in_progress` | 랭킹 무기 필터 칩·10위 내부 스크롤 UI 적용 및 로비 세로 컴팩트화 | [P02](../phases/2026-11-17-lobby-compact-weapon-ranking/P02-frontend-lobby-ranking-ui/phase.md) |
