# Plan: WebGL 컨텍스트 손실·차단 대응

## Goal
- 개발 중 StrictMode·HMR 반복 마운트로 WebGL 컨텍스트가 쌓이지 않게, 정리할 때 즉시 반납한다.
- 게임 중 컨텍스트를 잃으면 일시정지하고 3초 동안 복구를 기다린다. 복구되면 새로고침하고, 실패하면 안내 화면을 띄운다.
- 렌더러 생성 실패(브라우저 차단) 시 빈 화면 대신 원인·해결 방법·새로고침 버튼을 보여 준다.
- 측정: `npx tsc --noEmit` 0 오류, `npx vitest run` 전부 통과, 새 단위 테스트(가드 로직·오버레이 렌더) 통과.

Decisions: [2026-11-08-webgl-context-loss](../decisions/2026-11-08-webgl-context-loss.md)

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 컨텍스트 가드 + 안내 오버레이 + GameCanvas3D 연결 | [P01](../phases/2026-11-09-webgl-context-loss/P01-context-guard/phase.md) |
