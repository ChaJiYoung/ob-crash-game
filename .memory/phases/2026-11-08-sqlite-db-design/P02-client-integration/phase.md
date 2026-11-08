# Phase: P02 클라이언트 연동

## Goal
PC와 엔진이 P01의 서버 프로토콜을 실제로 사용한다. 이 Phase가 끝나면 실제 게임 한 판이 DB에 시작부터 종료까지 기록되고, 마우스 플레이어는 닉네임을 다시 입력하지 않는다.

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done` | 엔진: 웨이브별 피격 수 집계(`waveClears[].damageTaken`)와 무기 선택 훅(`onWeaponChosen`) | [T01](./T01-engine-wave-damage-and-weapon-hook.md) |
| T02 | `done` | PC: `GAME_BEGIN`/`GAME_STARTED`/`WEAPON_CHOSEN`/`GAME_ABANDON` 송수신, 제출에 `gameId` | [T02](./T02-pc-game-lifecycle.md) |
| T03 | `done` | 닉네임 고정과 변경: 마우스 `LOOKUP_LOCAL_PLAYER`·세션 `localPlayers`·`GAME_BEGIN` 마우스 검증, 마우스·폰 "닉네임 변경" | [T03](./T03-mouse-player-lookup.md) |

## Progress
- done: 3/3 (Phase 완료, 코디네이터 리뷰 통과)
- 참고: 로비·폰 닉네임 변경 클릭 흐름은 DOM 테스트 환경이 없어 소스 가드로만 검증. 브라우저 확인은 P03 체크리스트(A·B·G).
