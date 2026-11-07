# Plan: 2인팟 (Two-Player Co-op)

## Goal
한 PC 화면에서 두 사람이 협동으로 플레이한다(모바일+모바일 또는 마우스+모바일, D01). 맵·웨이브·보스·목숨은 공유하고, 무기·레벨·스킬·피버·카드·점수는 각자 가진다(D02, D03). 1P/2P 슬롯 로비(D06, D07), 소유자별 선택 표적(D13), 두 사람 동시 카드 선택(시간 제한 없음, D34), 30초 재접속 유예와 이탈 표시(D08, D20), 개인 패널 HUD(D09, D14), 1P·2P 비교 결과 화면(D11), 2인팟 전용 기록(D05, D18)까지 만든다.

측정 가능한 완료 조건:
- 한쪽 슬롯만 연결하면 지금과 똑같은 1인 게임이 된다(기존 테스트 전부 통과, 1인 화면은 개인 패널 형태만 바뀜).
- 두 슬롯을 연결하면 체력 1.6배·스폰 1.3배(D10) 판이 시작되고, 결과 화면에 두 점수가 나란히 나오며, 서버 `data/play-records.jsonl`에 `mode: "coop"` 두 줄이 남고 솔로 랭킹 Top5는 변하지 않는다.
- 랭킹 규칙 버전 `RANKING_RULESET_VERSION`(5)은 올리지 않는다(D05).

근거 문서: [결정 문서](../decisions/2026-11-07-two-player-coop.md) (D01~D16 인터뷰, D17~D20 계획 단계, D21~D23 계획 보고 후, D24~D31 구조 검토 후, D32~D40 남은 확인 — D22가 D05의 "팀 랭킹판 제외"를 바꿈)
UI 시안: [references/two-player-coop-mockups.md](../references/two-player-coop-mockups.md) — Task에서 "시안 N"은 이 문서의 N번 화면이다. 시안과 결정이 다르면 결정(문서의 "시안 이후 바뀐 점")을 따른다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 1인 기반 정리: 개인 상태 분리, 모드 규칙 표, TutorialDirector, 판정·선택 라운드 통일, 입력 어댑터→처리부, 플레이어 0 지름길 제거(2인 기능 없음) | [P01](../phases/2026-11-07-two-player-coop/P01-solo-foundation/phase.md) |
| P02 | `done` | 엔진 2인: 플레이어별 라우팅, 인원수 규칙 표, 모두 기다리는 선택 라운드, 이탈 상태, 개인 통계 | [P02](../phases/2026-11-07-two-player-coop/P02-engine-players/phase.md) |
| P03 | `in_progress` | 서버: 슬롯 2개, 마우스 플레이어 식별, 2인팟 기록·`coopBests`, 팀 랭킹 | [P03](../phases/2026-11-07-two-player-coop/P03-server-protocol/phase.md) |
| P04 | `pending` | PC 로비·연결: 슬롯 카드, 어댑터→처리부 바인딩, 시작·결과 흐름, 끊김 유예 | [P04](../phases/2026-11-07-two-player-coop/P04-pc-input-lobby/phase.md) |
| P05 | `pending` | 화면: 개인 패널 HUD, 플레이어 색, 선택 화면, 결과 화면, 튜토리얼 패널, 총 두 자루, 랭킹 탭, 문서 갱신 | [P05](../phases/2026-11-07-two-player-coop/P05-hud-screens/phase.md) |

## 설계 원칙 (D24, 모든 Task가 지킨다)
- 인원수에 따라 달라지는 것은 `GAME_TUNING.playerCountRules[n]`의 값과 화면 표시값(`getPlayerPresentation`)뿐이다. 엔진·입력·선택 라운드·점수·이탈 로직에 `isCoop`/`players.length === 2` 분기를 쓰지 않는다. 1인은 플레이어 배열 길이가 1인 같은 코드다.
- 입력 장치(폰·마우스)는 "어느 플레이어에 묶였나"만 다르고, 장치 어댑터는 aim·fireDown·fireUp·skill·fever 신호만 내고, 실제 동작과 허용 조건은 `PlayerActionProcessor` 한 곳에서 한다(P01-T05, D25).
- 플레이어 0 전용 지름길(`engine.scoreManager`, `engine.weaponSystem`, HUD 스냅샷의 개인 필드)은 남기지 않는다(P01-T06, P05-T01). 모든 개인 값은 `engine.getPlayer(i)` / `snapshot.players[i]`로만 읽는다.
- 리뷰 체크: Task 완료 시 `grep -n "isCoop\|players.length === 2" src/pc/engine src/pc/input` 결과가 0이어야 한다(표시용 `getPlayerPresentation`과 통계 `mode` 라벨은 예외, 그 두 함수 안에만 둔다).

## 공통 규칙 (모든 Task)
- 전체 검증: `npm test && npx tsc --noEmit` (빌드까지 볼 Task는 `npm run build` 추가).
- 플레이어 번호: 엔진 안은 `PlayerIndex = 0 | 1`(0=1P), 서버·프로토콜은 `PlayerSlot = 1 | 2`. 변환은 `slot - 1`.
- 1인 경로를 깨지 않는 것이 최우선이다. 새 인자는 모두 기본값(`playerIndex = 0`, `slot = 1`)을 둔다.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`를 붙인다.
