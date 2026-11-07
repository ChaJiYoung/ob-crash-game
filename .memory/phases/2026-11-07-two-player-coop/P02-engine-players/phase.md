# Phase: P02 엔진 2인

P01로 정리된 엔진에 플레이어를 여럿 둔다. 화면 없이 vitest로 "두 플레이어가 같은 필드에서 각자 쏘고, 각자 카드를 고르고, 각자 점수를 받는다"를 검증한다. 1인은 같은 코드에서 플레이어가 1명인 경우다.

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | 사격·스킬·피버·처치 점수·사건을 `playerIndex`로 라우팅 | [T01](./T01-player-routing.md) |
| T02 | `in_progress 🔵` | 인원수 규칙 표 `playerCountRules`와 `startGame({ playerCount })` | [T02](./T02-player-count-rules.md) |
| T03 | `pending` | 선택 라운드가 모든 플레이어를 기다림(시간 제한 없음, D34), 선택 상태 조회, 이탈자용 자동 선택 | [T03](./T03-owned-select-targets.md) |
| T04 | `pending` | 이탈 상태 `setPlayerAway`: 개인 타이머 정지, 입력 무시, 선택 즉시 자동 | [T04](./T04-player-away.md) |
| T05 | `pending` | 플레이어별 판 통계와 협동 정보 `coop` | [T05](./T05-coop-run-stats.md) |

## Progress
- done: 1/5 (active: T02)
