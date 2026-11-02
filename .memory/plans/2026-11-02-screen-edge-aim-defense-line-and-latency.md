# Plan: Screen Edge Aim Deadzone Fix, Floor Defense Line, and Low-Latency Input

## Goal
화면 우측 끝 조준 사각지대(Deadzone)를 해소하고, 1.8m 바닥 밀착형 마지노선(Hazard Stripe & Neon Line)과 몬스터 그림자 바닥 고정을 구현하며, PC React 리렌더링 폭풍(`setDiagnostics`) 차단 및 모바일 센서 스무딩 지연을 개선하여 지연 없는 120fps 칼반응 조준 경험을 완성한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 사각지대 해소, 바닥 마지노선 밀착, PC 리렌더링 폭풍 차단 및 입력 지연 개선 | [P01](../phases/2026-11-02-screen-edge-aim-defense-line-and-latency/P01-fix-aim-deadzone-defense-line-and-latency/phase.md) |
