# Task: T01 실기기 통합 테스트와 로그 분석

## Status: done

## Goal
사용자가 실기기로 세 가지 수정(백그라운드 일시정지, 자동 영점, 센서 복구)을 테스트하고, `data/sensor-debug.log`로 결과를 확인한다. 이 Task는 코드 변경이 거의 없고 **사용자의 수동 테스트가 필요**하다. 결과를 받기 전에는 완료 처리하지 않는다.

## Decision Summary
- phone-background-pause D10, controller-sensor-revive D07. 이전 계획(`controller-sensor-revive`)의 P02-T02를 흡수한다.
- 결과 기록: `.memory/references/2026-11-08-phone-lifecycle-device-log.md`

## Implementation

### I01. 사전 준비 안내

- Related Files:
  - `data/sensor-debug.log` :: 서버가 쓰는 진단 로그 — 분석 대상; read-only
  - `.memory/references/2026-11-08-phone-lifecycle-device-log.md` :: 테스트 결과와 결론; new

#### Details
- P03-T01 이후 `npm run server`는 `tsx watch`라 서버 코드 변경이 자동 반영된다. 다만 `package.json`이 바뀐 뒤에는 **사용자가 서버를 한 번 직접 재시작**해야 `watch` 모드로 뜬다(이미 떠 있는 옛 프로세스는 계속 옛 코드). 프론트(vite)는 자동 반영되지만 폰 브라우저는 **새로고침**해야 확실하다.
- 기존 `data/sensor-debug.log`가 있으면 지운다.

### I02. 테스트 시나리오

#### Details
- 시작 전: **PC와 폰 둘 다 새로고침**(PC 자동 재연결 코드와 폰 버튼 코드 적용).
- **A. 화면 꺼짐 → 돌아가기 버튼(1P 폰 / 2P 마우스, 플레이 중)**: 폰 화면을 끄고 2초 → PC 일시정지. 켜면 폰에 "게임으로 돌아가기" 버튼(같은 페이지가 유지된 경우) 또는 초록 버튼(페이지가 새로 열린 경우). 모니터 중앙을 겨누고 누르면 PC 재개 카운트다운 → 십자선이 폰을 따라 움직임.
- **B. 잠깐 꺼짐**: 알림 센터를 0.5초만 내렸다 올림 → PC 일시정지 없음, 폰 버튼 없음.
- **C. 협동(폰 2대)**: 한 대 화면 끄기 → 그 슬롯 유예 카운트다운, 나머지는 계속. 버튼으로 복귀.
- **D. 신호 없는 끊김**: 플레이 중 폰 Wi-Fi/비행기 모드 3초 이상 → PC 약 3초 뒤 일시정지. 다시 연결하면 자동 재연결 경로로 복귀(화면은 켜져 있었으므로 버튼 없음).
- **E. 허용 직후 자동 영점**: 폰 새로고침 후 초록 버튼만 → PC 로비 조준경 표시·시작 가능(1P, 2P).
- **F. 서버 재시작**: 서버 파일을 저장해 `tsx watch` 재시작 → PC·폰이 5초 안에 같은 방으로 다시 붙음(무한 반복 없음).

### I03. 로그 분석 기준

#### Details
1. 서버 `lifecycle-received`(BACKGROUND/FOREGROUND) → `background-timer`(newlyLost) → `zero-release`(wasLost: true) 순서가 시나리오 A의 정상 흐름이다.
2. `frames` 줄의 `aimX`/`yaw` 범위가 버튼 뒤 다시 움직이면 센서 재등록 성공.
3. A에서 PC가 재개되지 않으면 `zero-release`가 찍혔는지로 폰 → 서버 / 서버 → PC 중 어디서 끊겼는지 가른다.
4. 결론과 남은 문제를 references 문서에 기록한다.

## Acceptance Criteria
- [ ] 시나리오 A·B·C·E·F가 통과한다(사용자 확인).
- [ ] 시나리오 D(안전망)가 통과하거나, 실패 원인과 대응이 기록된다.

## Validation
- 사용자 수동 테스트 결과 보고 + `data/sensor-debug.log` 내용 (명령어 검증 없음)
- `cat data/sensor-debug.log` — 위 분석 기준 1~4 확인

## Commit Message
```text
docs(memory): 폰 수명주기 수정 실기기 검증 결과 기록

Plan: 2026-11-08-phone-lifecycle-fixes
Phase: P05-verify-and-cleanup
Task: T01-device-test-and-analysis

- 시나리오별 결과와 로그 분석 결론 기록
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
