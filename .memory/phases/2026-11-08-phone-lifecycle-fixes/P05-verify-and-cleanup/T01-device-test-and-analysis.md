# Task: T01 실기기 통합 테스트와 로그 분석

## Status: pending

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
- **A. 화면 꺼짐 일시정지(1P 폰 / 2P 마우스, 플레이 중)**: 폰 화면을 끄고 2초 기다린다 → PC가 일시정지(메뉴)되는지. 화면을 켠다 → PC가 복귀하고 십자선이 폰을 따라 움직이는지.
- **B. 잠깐 꺼짐**: 폰 알림 센터를 0.5초 정도만 내렸다 올린다 → PC가 일시정지되지 않는다.
- **C. 협동(폰 2대)**: 한 폰의 화면을 끈다 → 해당 슬롯 유예 카운트다운이 시작되고 나머지 한 명은 계속 플레이된다. 켜면 재개 카운트다운 후 복귀한다.
- **D. 신호 없는 사라짐(안전망)**: 플레이 중 폰의 Wi-Fi를 끄거나 비행기 모드로 3초 이상 둔다 → PC가 3초 안팎으로 일시정지된다. 다시 연결하면 복귀한다.
- **E. 허용 직후 자동 영점**: 새로고침으로 폰 페이지를 새로 연 뒤 초록 버튼만 누른다 → PC 로비에 조준경이 뜨고 시작 가능 상태가 된다(1P 폰, 2P 폰 둘 다).
- **F. 센서 복구**: 화면 껐다 켠 뒤 폰을 흔들면 십자선이 따라온다(이전 증상 재확인).
- 각 시나리오마다 사용자는 "된다 / 안 된다 / 이상하다"와 관찰 내용을 알려준다.

### I03. 로그 분석 기준

#### Details
1. 서버 `frames` 줄(초당 요약)의 `aimX`/`yaw` 범위가 화면 복귀 후 다시 움직이는지 본다. 움직이면 센서 복구 성공, 최소=최대로 고정이면 센서 이벤트가 안 오는 것.
2. 화면이 꺼진 시점 이후 `frames` 줄이 끊기는 시각과 PC가 일시정지된 시각의 차이로 지연(약 1초 이내)을 확인한다.
3. `orientation-gap` 값으로 정상 사용 중 센서 이벤트 최대 간격을 확인하고, `SENSOR_STALE_MS`(기본 2000)가 적절한지 판단한다. 정상 사용 중 워치독 `reregister`(reason `watchdog`)가 자주 나오면 값을 올린다.
4. `visibility` 로그가 화면 꺼짐/켜짐을 얼마나 믿을 수 있게 남겼는지(좀비 소켓으로 유실되는지) 기록한다.
5. 결론(시나리오별 결과, `SENSOR_STALE_MS` 최종값, 남은 문제)을 references 문서에 기록한다. 시나리오가 실패하면 원인을 분석해 필요한 수정 Task를 이 Phase에 추가하고 사용자에게 알린다.

## Acceptance Criteria
- [ ] 시나리오 A·B·C·E·F가 통과한다(사용자 확인).
- [ ] 시나리오 D(안전망)가 통과하거나, 실패 원인과 대응이 기록된다.
- [ ] `SENSOR_STALE_MS` 최종값이 결정되어 references 문서에 기록된다.

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
- SENSOR_STALE_MS 최종값 결정
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
