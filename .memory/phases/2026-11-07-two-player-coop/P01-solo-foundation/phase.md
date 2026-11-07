# Phase: P01 1인 기반 정리

2인 작업 전에 지금 1인 코드를 "인원수·모드는 값만 다르고 로직은 하나"(D24, D31) 구조로 정리한다. 이 Phase에서는 2인 기능이 하나도 생기지 않는다. 끝나면 기존 1인 게임·튜토리얼·샌드박스가 그대로 돌고(의도된 변화: 튜토리얼·샌드박스 판정이 실전과 같아짐, 폰 홀드 첫 발, 마우스 스킬 조건. 랭킹 규칙 버전은 5 유지, D32), 엔진·입력에 1인 전용·모드 전용 갈래가 남지 않는다.

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | 개인 상태를 `PlayerCombatState`로 옮기는 순수 리팩터(동작 불변) | [T01](./T01-extract-player-state.md) |
| T02 | `done ✅` | 모드 규칙 표 `modeRules`: 튜토리얼·샌드박스 규칙 분기를 값으로 | [T02](./T02-mode-rules.md) |
| T03 | `done ✅` | 엔진 사건 알림 + `TutorialDirector`: 튜토리얼 단계 진행을 엔진 밖으로 | [T03](./T03-tutorial-director.md) |
| T04 | `done ✅` | 명중 판정 하나(실전 기준, D30), 선택 라운드 하나(무기·카드 공통) | [T04](./T04-hit-and-select-round.md) |
| T05 | `done ✅` | 입력 어댑터(폰·마우스) → 플레이어 동작 처리부, 쏴서 누르는 버튼, 폰 알림은 어댑터 | [T05](./T05-input-processor.md) |
| T06 | `done ✅` | 플레이어 0 지름길(`engine.scoreManager` 등) 제거 | [T06](./T06-remove-solo-aliases.md) |

## Progress
- done: 6/6 (Phase completed 🎉)
