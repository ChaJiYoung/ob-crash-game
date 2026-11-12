# Plan: 찰랑 몬스터 (Chalang Submerge Monster)

## Goal
물속에 잠수했다가 화면의 다른 위치에 순간이동해 나오는 신규 몬스터 `chalang`을 추가한다.
측정 가능한 결과:
- 잠수 중에는 모든 타격·스킬이 명중하지 않는다(단위 테스트로 검증).
- 등장 3회째부터 방어선까지 3배 속도로 급발진한다(단위 테스트로 검증).
- 수면 위 피격은 기존 무기 피해 규칙을 따르며, 체력이 0이 되면 처치된다(체력 3).
- 샌드박스 테스트 랩에서 찰랑을 소환해 잠수·순간이동·급발진을 눈으로 확인할 수 있다.

근거 인터뷰: `.memory/decisions/2026-11-12-chalang-monster.md` (D01~D10)

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 찰랑 타입·스펙·튜닝·도감·테스트 목록 등록 | [P01](../phases/2026-11-12-chalang-monster/P01-data-and-spec/phase.md) |
| P02 | `pending` | 잠수·순간이동·타격 불가 상태 기계, 급발진·체력 규칙 | [P02](../phases/2026-11-12-chalang-monster/P02-submerge-engine/phase.md) |
| P03 | `pending` | 3D 모델·라벨 에셋, 잠수 시각 상태 | [P03](../phases/2026-11-12-chalang-monster/P03-visuals-and-asset/phase.md) |
| P04 | `pending` | 임시 웨이브 배치와 전체 검증 | [P04](../phases/2026-11-12-chalang-monster/P04-wave-and-verify/phase.md) |

## Assumptions (구현 전 확인 또는 테스트 후 조정)
- A1. 수면 위 체류 시간 `surfacedMs = 1000` (결정 문서에 없던 값. 2초는 길어서 사용자 확인 후 1초로 변경. 짧은 "뽀잉" 리듬을 위함).
- A2. 등장·순간이동 최소 반지름 `minRadiusM = 8` (방어선 1.8m + 여유). 최대는 `SPAWN_RADIUS_M = 24`.
- A3. 등장 횟수는 스폰을 1회로 센다. 순간이동 2번 후 3번째 등장에서 급발진한다.
- A4. 찰랑은 스폰 시 수면 위에서 시작한다.
- A5. 피해는 기존 몬스터와 같은 무기 피해 규칙을 쓴다(사용자 선택). 찰랑 전용 피해 오버라이드는 두지 않는다.
- A6. 스킬(뚫어뻥·거품 해일·칼날·폭발)도 잠수 중에는 맞지 않는다.
- A7. 급발진 중에는 다시 잠수하지 않는다.
- A8. 스펙 수치 `speedMps 2.0`, `hitRadiusM 1.0`, `killBonusScore 120`, 브랜드 색은 초기값이다.

## Dependency Order
P01-T01 → P02-T02 → P02-T03 → P03-T04 → P03-T05 → P04-T06
