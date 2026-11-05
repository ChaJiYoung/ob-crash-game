# Plan: 판별 플레이 기록 저장과 결과 화면 랭킹

## Goal
게임이 끝나면 결과 옆에서 바로 판별 TOP 5(닉네임, 점수, 스테이지, 무기)와 최대 콤보를 보고, 끝난 모든 판의 점수 산정 정보가 `data/play-records.jsonl`에 한 줄씩 쌓인다.

근거 문서: [결정 문서](../decisions/2026-11-05-play-records.md)

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 결과 화면 좌우 배치 | [P01](../phases/2026-11-05-play-records-and-result-ranking/P01-result-ranking/phase.md) |
| P02 | `done` | 엔진 통계 수집, 서버 저장, 판별 TOP 5, 콤보·처치 표시 | [P02](../phases/2026-11-05-play-records-and-result-ranking/P02-play-records/phase.md) |
| P03 | `done` | 문서와 최종 검증 | [P03](../phases/2026-11-05-play-records-and-result-ranking/P03-verify/phase.md) |

## 순서의 이유
P01은 서버와 무관해 바로 확인할 수 있다. P02는 엔진 값이 있어야 전송할 수 있어 수집을 먼저 한다.
