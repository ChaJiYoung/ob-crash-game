# Plan: 폰 컨트롤러 수명주기 수정 (백그라운드 일시정지 + 자동 영점 + 센서 복구 마무리)

- Decisions:
  - [2026-11-08-phone-background-pause](../decisions/2026-11-08-phone-background-pause.md) (D01~D12)
  - [2026-11-08-auto-zero-on-permission-grant](../decisions/2026-11-08-auto-zero-on-permission-grant.md) (D01~D05)
  - [2026-11-08-return-button](../decisions/2026-11-08-return-button.md) (D01~D09, 자동 복귀를 버튼으로 대체)
  - [2026-11-08-dev-server-watch-and-dead-zeroing](../decisions/2026-11-08-dev-server-watch-and-dead-zeroing.md) (D01~D04)
  - [2026-11-08-controller-sensor-revive-after-screen-off](../decisions/2026-11-08-controller-sensor-revive-after-screen-off.md) (D01~D09, 코드는 구현·커밋 완료, 실기기 검증·정리만 남음)

## Goal
1. 폰 화면이 꺼지거나 앱이 백그라운드로 가면 PC가 일시정지하고, 돌아오면 재개한다. 신호를 못 보낸 경우에도 센서 프레임이 3초 끊기면 감지한다.
2. 센서 권한 허용(초록 버튼) 직후 폰이 자동으로 영점 신호를 보내 PC 로비의 조준경이 뜨고 시작 준비 상태가 된다.
3. 개발 서버가 코드 변경 시 자동으로 다시 시작되고, 도달할 수 없는 폰 영점 안내 화면(`ZeroingGuide`)이 정리된다.
4. 센서 복구(화면 복귀 후 리스너 재등록) 작업을 실기기에서 검증하고 임시 진단 코드를 제거한다.
- 측정 가능한 결과: `tsc`·`vitest`·`build` 통과 + 실기기에서 (a) 화면 끄면 1초 뒤 일시정지, (b) 켜면 재개, (c) 허용 버튼만으로 조준경 표시, (d) 화면 복귀 후 조준 정상

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 서버·PC: 프레임 끊김 감지, 백그라운드/포그라운드 신호, PC 중복 알림 방어 | [P01](../phases/2026-11-08-phone-lifecycle-fixes/P01-server-liveness/phase.md) |
| P02 | `done` | 폰: 화면 꺼짐/복귀 신호 전송, 허용 직후 자동 영점 | [P02](../phases/2026-11-08-phone-lifecycle-fixes/P02-phone-controller/phase.md) |
| P03 | `done` | 정리 번들: 개발 서버 자동 재시작(`tsx watch`), 폰 영점 안내 화면 죽은 코드 제거, README 동기화 | [P03](../phases/2026-11-08-phone-lifecycle-fixes/P03-cleanup-bundle/phase.md) |
| P04 | `done` | 복귀 버튼 전환: 자동 복귀 경로 제거, "게임으로 돌아가기" 버튼 | [P04](../phases/2026-11-08-phone-lifecycle-fixes/P04-return-button/phase.md) |
| P05 | `in_progress` | 실기기 통합 검증, 임시 진단 코드 제거, 최종 빌드 | [P05](../phases/2026-11-08-phone-lifecycle-fixes/P05-verify-and-cleanup/phase.md) |

## 참고
- 이전 계획 `2026-11-08-controller-sensor-revive-after-screen-off`의 P02(T02·T03)는 이 계획의 P05로 흡수되었다(`superseded`).
- 로컬 개발 서버(`tsx server/index.ts`)는 지금은 파일 변경을 감시하지 않는다. P03-T01이 `tsx watch`로 바꾸기 전까지는, 서버 코드를 바꾼 Task 뒤에 사용자가 서버를 재시작해야 실기기 테스트에 반영된다(P03 이후에도 `package.json` 변경은 한 번 직접 재시작해야 적용된다).
- (추가, 실기기 테스트 중 발견) PC 소켓 자동 재연결: 서버가 재시작되면(`tsx watch` 포함) PC가 다시 붙지 않아 방이 사라지고 폰이 `ROOM_NOT_FOUND`로 "연결중↔연결끊김"을 무한 반복했다. PC가 백오프(`getReconnectDelayMs`)로 재연결하고 저장된 방 코드로 `CREATE_ROOM`을 다시 보내게 했다(`src/pc/PCGamePage.tsx`, `tests/pc-reconnect.test.ts`).
