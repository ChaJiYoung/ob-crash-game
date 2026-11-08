# Plan: 플레이 테스트 피드백 (랭킹 입력 방식, 로비 마우스 조준점, 2인 카드 빈도, 조준경 링 게이지)

- Decisions: [2026-11-08-playtest-feedback](../decisions/2026-11-08-playtest-feedback.md)

## Goal
- 개인/팀 랭킹과 결과 화면에서 플레이어별 입력 방식(🖱/📱), 점수, 무기가 보인다(D02~D05).
- 로비에서 마우스 슬롯을 고르면 마우스를 따라가는 십자선이 보인다(D06).
- 판 기록에 입력 방식과 카드 선택 기록을 남긴다(D02, D09). 2인 카드 배율은 시뮬레이션 결과 1인과 같아서 2로 유지하고, 시뮬레이션은 회귀 테스트로 남긴다(D07-1). 배율 재조정은 기록이 쌓인 뒤 별도로 한다.
- 십자선 둘레의 링 게이지로 탄창, 스킬, 피버를 보여 준다(D08).
- 오래된 2인팟 결정 문서(D10, D35)에 실제 배율 변경 내역을 남긴다(사용자 추가 요청).
- 완료 기준: `npx tsc --noEmit`, `npm test`, `npm run build` 통과.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 기록에 입력 방식·카드 선택 저장, 랭킹·결과 화면 표시 | [P01](../phases/2026-11-08-playtest-feedback/P01-records-and-ranking/phase.md) |
| P02 | `in_progress` | 로비 마우스 십자선, 카드 빈도 시뮬레이션 테스트, 조준경 링 게이지 | [P02](../phases/2026-11-08-playtest-feedback/P02-play-feel/phase.md) |
