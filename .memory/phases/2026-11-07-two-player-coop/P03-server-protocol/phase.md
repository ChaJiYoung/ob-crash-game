# Phase: P03 서버·프로토콜

서버 방이 폰 2대(슬롯 1·2)를 따로 붙이고, 메시지를 슬롯별로 중계하며, 마우스 플레이어를 기기 ID로 등록하고, 2인팟 기록을 솔로 랭킹과 분리해 저장하고 팀 랭킹을 만든다. 소켓 테스트로 "폰 두 대 + PC" 흐름을 검증한다. 슬롯 없는 옛 메시지는 슬롯 1이다.

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `in_progress 🔵` | 메시지에 `slot`, `RoomManager` 컨트롤러 슬롯 2개, 슬롯별 중계·끊김 알림 | [T01](./T01-slot-protocol.md) |
| T02 | `pending` | 마우스 플레이어 등록 `REGISTER_LOCAL_PLAYER`(D15) | [T02](./T02-local-player-identity.md) |
| T03 | `pending` | 2인팟 기록 `mode:"coop"`, 솔로 Top5 제외, `totalGames`+1, `coopBests` | [T03](./T03-coop-records.md) |
| T04 | `pending` | 팀 랭킹 Top5(`teamRankings`, D22) | [T04](./T04-team-rankings.md) |

## Progress
- done: 0/4 (active: T01)
