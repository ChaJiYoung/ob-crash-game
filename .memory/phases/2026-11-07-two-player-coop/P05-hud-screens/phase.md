# Phase: P05 HUD·화면

2인팟 화면을 결정·시안대로 만든다. 1인/2인 표시 차이는 `getPlayerPresentation` 한 함수만 정하고 컴포넌트는 그 값으로 그린다(D24). Task마다 캡처로 확인한다. 시안: [two-player-coop-mockups.md](../../../references/two-player-coop-mockups.md).

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done` ✅ | HUD 스냅샷 `players[]`(개인 필드 지름길 제거), 표시 규칙 함수, `PlayerPanel` 개인 패널 | [T01](./T01-player-panel-hud.md) |
| T02 | `in_progress` 🔵 | 플레이어 색: 십자선·이름표, 사격 트레이서, 판정 팝업 | [T02](./T02-player-colors.md) |
| T03 | `pending` | 선택 화면: 좌우 배경·카드 종류색+주인색 테두리·소유 배지·대기 상태 | [T03](./T03-select-screen.md) |
| T04 | `pending` | 결과 화면 1P·2P 비교와 팀 최고 기록 | [T04](./T04-coop-result-screen.md) |
| T05 | `pending` | 튜토리얼이 메인과 같은 개인 패널을 쓴다(D14) | [T05](./T05-tutorial-panel.md) |
| T06 | `pending` | 3D 총 플레이어 수만큼(D21) | [T06](./T06-two-guns.md) |
| T07 | `pending` | 로비 명예의 전당 "개인 랭킹 / 팀 랭킹" 탭(D22) | [T07](./T07-lobby-ranking-tabs.md) |
| T08 | `pending` | 문서 갱신: README·docs·인게임 가이드, docs-sync 금지 문구(D39) | [T08](./T08-docs.md) |

## Progress
- done: 1/8 (active: T02)
