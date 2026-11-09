# Decisions: 로비 2P 기본 모바일 + 플레이어별 단계 뱃지 + 시작 버튼 상태 문구

- Date: 2026-11-10
- Status: Confirmed

## D01. 2P 기본 입력을 모바일로 미리 선택
- **Chosen**: `createLobbySlots`가 1P(마지막 입력, 기본 mobile)에 더해 2P도 'mobile'로 미리 선택한다. 2P 입력은 저장하지 않고 로비가 열릴 때마다 mobile.
- **Rationale**: 2P QR이 처음부터 보이고 미연결이어도 1인 시작이 가능해야 한다. mouse 충돌(MOUSE_TAKEN)은 mouse끼리만이라 1P가 mouse여도 문제없다.

## D02. 미연결 2P는 시작을 막지 않음 (게이트 로직 유지)
- **Chosen**: `getStartGate`/`isSlotJoined`(입력 선택 + player 있음)는 바꾸지 않는다. QR 미스캔(player 없음) 슬롯은 "미참여"로 무시되어 1인 시작된다.
- **Rationale**: 코드상 이미 그렇게 동작한다(`canStart=true`). 막힌다고 느낀 원인은 안내 문구였다.

## D03. QR은 찍고 영점 미완료인 2P는 그냥 기다린다
- **Chosen**: 계속 시작을 막는다. 타임아웃·자동 제외·수동 제외(두 번 확인) 모두 만들지 않는다. 대신 시작 버튼을 비활성화하고 상태를 버튼 글자로 알린다(D05). 기존 📱 재클릭 토글(입력 해제)은 그대로 두되 안내는 하지 않는다.
- **Rationale**: 참여 의사를 보인 2P를 두고 시작하면 갑자기 빠진다. 별도 제외 수단 없이 상태 표시만으로 해결해 범위를 줄인다.

## D04. 배너: 플레이어별 3단계 뱃지, 주황 문장 제거
- **Chosen**: `LobbyNextStepBanner`의 단일 단계 줄(QR 스캔 › 영점 조정 › 쏴서 시작)을 1P 줄/2P 줄로 나눠 플레이어마다 뱃지를 둔다. 마우스 슬롯은 2단계(닉네임 입력 › 클릭으로 시작). 옆의 주황 큰 문장(`lobby-next-headline`)과 detail은 화면에서 없앤다. 아무도 입력을 안 골랐을 때의 "입력 방식 선택" 단계는 유지한다.
- **Rationale**: 슬롯 하나만 안내하던 방식이라 2P 미연결이면 시작 불가처럼 보였다. 두 플레이어 상태를 항상 같이 보여 준다.

## D05. 시작 버튼: 항상 표시, 불가 시 비활성, 전체 상태는 괄호 문구
- **Chosen**: 시작 버튼을 항상 렌더하고 `!canStart`면 비활성화한다(현재의 별도 "⏳ …" 박스는 대체). 글자:
  - 시작 가능, 폰 포함: ▶ 게임 시작 (화면 가운데를 쏘세요)
  - 시작 가능, 마우스만: ▶ 게임 시작 (클릭으로 시작)
  - 1P 준비, 2P 폰 미연결: ▶ 게임 시작 (2P 없이 1인 시작)
  - 2P 영점 중: 게임 시작 (2P 준비 중…) / 둘 다 대기: (1P·2P 준비 중…) / 아무도 없음: (플레이어를 연결하세요)
- **Rationale**: 전체 상태를 한 곳(버튼)에서 알리고 배너의 주황 문장을 없앨 수 있다. 기존엔 괄호 문구가 canStart일 때 고정 문구 하나뿐이었다.

## D06. "선택" 안내 위치
- **Chosen**: (a) 배너 2P 줄 라벨을 "2P (선택)"으로: 1P가 준비 완료이고 2P가 폰 미연결일 때만. (b) 2P 카드 오른쪽 상태 글자를 "● 스마트폰 연결 대기 (선택)"으로 바꾸고 색을 주황→회색으로 낮춘다(같은 조건). (c) 버튼은 D05의 "2P 없이 1인 시작".
- **Rationale**: 막힌 게 아니라 선택 사항임을 배너·카드·버튼 세 곳에서 일관되게 알린다. 새로운 슬롯 상태는 만들지 않는다.

## D07. 죽은 필드 정리: `LobbyNextAction.ready`·`headline`·`detail` 제거, 슬롯별 뷰 추가
- **Chosen**: `LobbyNextAction`에서 `ready`(화면에서 안 읽힘), `headline`, `detail`(D04로 화면에서 안 그림)을 제거한다. 플레이어별 뱃지 줄을 위한 필드(예: `slotsView`)를 추가한다. 전체 시작 가능 여부는 `StartGate.canStart`만 본다.
- **Rationale**: `ready`는 테스트에서만 검증되는 죽은 필드였고 D04로 headline/detail도 죽은 필드가 된다. 남겨 두면 "누구 기준의 ready인지" 같은 혼란만 남는다. 관련 테스트(`tests/lobby-next-step.test.ts`)도 새 구조로 고친다.

## D08. 기존 테스트 갱신은 필수 Task
- **Chosen**: `tests/lobby-default-input.test.ts`의 "2P는 비어 있다"(`input === null`)를 "2P는 mobile로 미리 선택"으로 갱신. 배너 플레이어별 뱃지, 버튼 문구/비활성, 카드 "(선택)" 상태 테스트를 추가하고 `lobby-next-step`/`lobby-slot-cards` 기존 테스트를 새 구조에 맞춘다.
- **Rationale**: D01·D04·D05로 기존 단언이 깨진다.

## D09. 랭킹: 클리어 기록은 금색 "CLEAR" 글자로 표시 (아이콘 없음)
- **Chosen**: `RankingTabs`의 솔로·팀 항목에서 `outcome === 'VICTORY'`면 `W7` 자리에 금색 "CLEAR" 글자만 보인다(이모지·아이콘 없음). 사망(`GAMEOVER`)은 지금처럼 회색 `W{waveReached}`. 기록에 `outcome`이 없으면(옛 클라이언트/데이터) 사망으로 취급한다.
- **Rationale**: 7웨이브 도달이 "클리어"인지 "7에서 사망"인지 구분이 안 됨. 글자가 달라야 색을 못 구분해도 알 수 있다. 아이콘은 사용자 요청으로 제외.

## D10. 랭킹: 서버가 이미 저장한 outcome을 내보낸다 (마이그레이션 없음)
- **Chosen**: `games.outcome`(GAMEOVER/VICTORY)은 판 종료 시 이미 저장된다. `RunRankingEntry`·`TeamRankingEntry`에 `outcome` 필드를 추가하고 `getTopRuns`·`getTopTeams`의 SELECT에 `g.outcome`을 넣는다. 팀 랭킹은 팀별 최고점 판(`rn = 1`)의 outcome을 쓴다. 쌓여 있는 기록에도 바로 적용된다.
- **Rationale**: 새 저장·DB 변경 불필요. 표시 위치는 `RankingTabs` 두 곳뿐이며 로비·결과 화면이 같은 컴포넌트를 쓴다. 결과 화면 제목은 이미 VICTORY/GAME OVER를 구분하므로 건드리지 않는다.

## D11. 문서 캡처 재촬영을 이번 계획에 포함
- **Chosen**: 모든 UI 변경(P01~P03) 뒤에 마지막 Phase로 로비 3장(`screen-01-pc-lobby.png`, `screen-01-pc-lobby-qr.png`, `screen-01b-pc-lobby-paired.png`)과 결과 랭킹 화면(`play-result-ranking.png`)을 다시 찍는다. 기존 `scripts/capture-lobby.mjs`를 쓴다.
- **Rationale**: 로비 배너·시작 버튼·2P 카드와 랭킹 표기가 바뀌어 문서의 기존 캡처가 틀려진다. 브라우저는 `--use-angle=metal`(프로젝트 메모리 규칙).
