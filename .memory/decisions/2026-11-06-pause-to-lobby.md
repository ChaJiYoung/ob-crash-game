# Decisions: 일시정지 메뉴에서 로비로 나가기

- Date: 2026-11-06
- Status: Confirmed

## D01. 일시정지 메뉴에 '로비로 나가기' 버튼을 추가한다
- **Chosen**: `PauseMenuOverlay`에 이어하기·다시시작과 함께 `🏠 로비로 나가기` 버튼을 둔다. 일시정지 사유(USER / CONTROLLER_LOST)와 폰 연결 상태에 관계없이 항상 보인다.
- **Rationale**: 지금은 게임 시작 후 로비로 돌아갈 방법이 결과 화면뿐이다. 폰이 끊겨 재연결을 기다리는 중에도 나갈 수 있어야 막히지 않는다. (요청 + 코드 확인으로 확정)

## D02. 이번 판 기록은 저장하지 않고 버린다
- **Chosen**: 로비로 나가면 점수·웨이브·콤보를 랭킹에 제출하지 않는다 (`submitScore` 호출 없음).
- **Rationale**: 다시시작과 같은 규칙이고 중간 포기 점수가 랭킹에 오르는 것을 막는다. (사용자 선택)

## D03. 실수 방지용 확인 단계를 둔다
- **Chosen**: 버튼을 누르면 같은 메뉴 안에서 "정말 나갈까요? 이번 판 점수는 저장되지 않습니다" 확인으로 바뀌고, `나가기`와 `취소` 중 고른다. 확인 중 Esc는 취소(확인 단계 닫기)로 동작한다.
- **Rationale**: 판이 통째로 사라지는 동작이라 한 번 더 확인한다. (사용자 선택 + Esc 동작은 자동 확정)

## D04. 기존 `handleReturnToLobby`를 재사용하되 일시정지 정리를 먼저 한다
- **Chosen**: `handleRestartFromPause`와 같은 순서로 카운트다운 타이머 정리 → `engine.setPaused(false, now)` → `pauseMenu` 닫기 → `handleReturnToLobby()` 호출.
- **Rationale**: `handleReturnToLobby`(`PCGamePage.tsx:891`)는 일시정지 플래그를 풀지 않으므로, 풀지 않으면 다음 게임 시작 시 엔진이 멈춘 채로 남는다. (`startGame`이 플래그를 지우지 않는 점은 `tests/pause-menu.test.ts`에 이미 검증돼 있다.) 폰 연결과 영점 보정은 유지한다.

## D05. 범위는 일반 플레이(PLAYING)만
- **Chosen**: TUTORIAL·SANDBOX는 기존 종료 흐름을 유지한다.
- **Rationale**: 일시정지 메뉴 자체가 PLAYING에서만 열린다(`canOpenPauseMenu`, 2026-11-05 D04).

## D06. 문서와 테스트를 함께 갱신한다
- **Chosen**: `README.md`의 일시정지 항목에 로비 나가기를 추가하고, `tests/pause-menu.test.ts`에 버튼 표시·확인 단계·핸들러 순서 테스트를 더한다.
- **Rationale**: `tests/docs-sync.test.ts`가 문서와 코드 동기화를 점검하고, 기존 일시정지 테스트가 같은 파일에 모여 있다.
