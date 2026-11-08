# Plan: main 병합 (규칙 수치·스킬 중복 방지·피버 표시)

## Goal
`main`을 실제 `git merge`로 이 브랜치(feature/1p-2p)에 합친다. 충돌은 이 브랜치 구조(플레이어별 상태) 기준으로 풀고, main의 규칙 수치(피버 대미지 2.0, 보스 배율 1.0), 스킬 중복 발동 방지(엔진 플레이어별 500ms 잠금), 피버 표시 개선을 이식한다. 결정: [decisions/2026-11-08-merge-main-rules.md](../decisions/2026-11-08-merge-main-rules.md)
완료 기준: `npx tsc --noEmit`, `npx vitest run` 모두 통과, `git log`에 main 병합 커밋이 있다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | main 병합 + 충돌 해결(엔진 잠금·배너·HUD·문구 이식) + 폰 디바운스 제외 | [P01](../phases/2026-11-08-merge-main-rules/P01-merge-and-port/phase.md) |
| P02 | `pending` | 2인용 패널(PlayerPanel)의 피버 표시에 배율 반영 + 최종 검증 | [P02](../phases/2026-11-08-merge-main-rules/P02-fever-panel/phase.md) |
