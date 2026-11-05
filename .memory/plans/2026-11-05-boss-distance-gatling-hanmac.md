# Plan: 보스 거리, 부하 낙하 거리, 개틀링 탄창, 오비 비중, 한맥 폭탄 캔

## Goal
직접 플레이 소감을 반영한다: 보스 똥 도달 시간 약 3.8초, 부하 10~18m 낙하, 개틀링 탄창 30~50발, 오비 비중 감소, 보스 없이 똥이 나오지 않게 한맥을 폭탄 캔으로 변경. 문서와 기준 시간까지 맞추고 자동 검증을 통과한다.

근거 문서: [결정 문서](../decisions/2026-11-05-boss-distance-gatling-hanmac.md)

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 튜닝 값 변경(거리, 탄창, 오비 비중) | [P01](../phases/2026-11-05-boss-distance-gatling-hanmac/P01-rule-values/phase.md) |
| P02 | `done` | 한맥 발사 제거와 폭탄 캔 | [P02](../phases/2026-11-05-boss-distance-gatling-hanmac/P02-hanmac-bomb/phase.md) |
| P03 | `done` | 기준 시간, 문서, 스크린샷, 최종 검증 | [P03](../phases/2026-11-05-boss-distance-gatling-hanmac/P03-docs-and-verify/phase.md) |
