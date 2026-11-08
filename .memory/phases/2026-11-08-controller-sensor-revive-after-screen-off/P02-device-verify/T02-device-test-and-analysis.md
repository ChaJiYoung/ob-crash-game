# Task: T02 실기기 테스트와 로그 분석

## Status: pending

## Goal
사용자가 실기기로 재현 시나리오를 테스트하고, `data/sensor-debug.log`를 읽어 (1) 원인 가설이 맞는지 (2) 재등록 후 조준이 복구되는지 (3) 워치독 임계값 `SENSOR_STALE_MS`를 얼마로 할지 결정한다.

## Decision Summary
- D07. 이 Task는 코드 변경이 거의 없고 **사용자 수동 테스트**가 필요하다. 사용자가 테스트 결과를 알려주기 전에는 완료 처리하지 않는다.
- 결과 기록: `.memory/references/2026-11-08-sensor-revive-device-log.md`

## Implementation

### I01. 테스트 시나리오 안내

- Related Files:
  - `data/sensor-debug.log` :: 서버가 쓰는 로그 파일 — 분석 대상; read-only
  - `.memory/references/2026-11-08-sensor-revive-device-log.md` :: 테스트 결과와 결론 기록; new

#### Details
- **사전 준비**: 사용자가 로컬 서버를 재시작해야 `DEBUG_LOG` 핸들러가 반영된다 (`npm run server` 재시작, 프론트는 vite가 자동 반영). 기존 `data/sensor-debug.log`가 있으면 지운다.
- **시나리오 A (본 증상 재현)**: 1P 폰 / 2P 마우스로 게임 시작 → 폰 화면을 끄고 10초 후 켬 → 십자선이 폰 움직임을 따라 움직이는지 확인.
- **시나리오 B (일시정지 후 재개)**: 시나리오 A 직후 일시정지 → 재개 카운트다운이 끝난 뒤 조준이 어긋나는지 확인 (①영점 수정 확인).
- **시나리오 C (짧은 화면 꺼짐)**: 화면을 2초만 껐다 켬. 같은 방식으로 확인.
- **시나리오 D (오래 꺼짐)**: 화면을 1분 이상 껐다 켬.
- 각 시나리오마다 사용자는 "십자선이 움직였다 / 안 움직였다 / 어긋났다"를 알려준다.

### I02. 로그 분석 기준

#### Details
1. 화면 복귀 직후 `visibility visible` → `reregister reason=visible` → `orientation-first`가 나오면 재등록 후 센서가 다시 오는 것이다 → 수정 성공.
2. `reregister` 후에도 `orientation-first`가 안 나오면 재등록만으로 부족하다 → 원인 재검토(예: iOS 권한 재요청 필요 여부). 이 경우 P01 T03를 보강하는 Task를 추가하고 사용자에게 알린다.
3. `reregister reason=watchdog`가 화면이 켜진 채 정상 사용 중에도 자주 나오면 임계값이 너무 짧다 → 올린다. 워치독이 아예 안 나오고 화면 복귀로만 복구되면 임계값은 2000ms 유지해도 된다.
4. `orientation-gap` 값으로 정상 사용 중 센서 이벤트 최대 간격을 확인하고, 임계값은 "최대 정상 간격의 2배 이상"으로 정한다.
5. 결론(가설 맞음/틀림, 최종 `SENSOR_STALE_MS` 값, 시나리오별 결과)을 `.memory/references/2026-11-08-sensor-revive-device-log.md`에 기록한다.

## Acceptance Criteria
- [ ] 시나리오 A에서 화면 복귀 후 십자선이 폰을 따라 움직인다 (사용자 확인).
- [ ] 시나리오 B에서 재개 후 조준이 어긋나지 않는다 (사용자 확인).
- [ ] 로그로 가설이 확인되었거나, 틀렸다면 새 원인과 추가 Task가 기록되었다.
- [ ] 최종 `SENSOR_STALE_MS` 값이 결정되어 references 문서에 기록되었다.

## Validation
- 사용자 수동 테스트 결과 보고 + `data/sensor-debug.log` 내용 (명령어 검증 없음)
- `cat data/sensor-debug.log` — 위 분석 기준 1~4 확인

## Commit Message
```text
docs(memory): 센서 복구 실기기 검증 결과 기록

Plan: 2026-11-08-controller-sensor-revive-after-screen-off
Phase: P02-device-verify
Task: T02-device-test-and-analysis

- 시나리오별 결과와 로그 분석 결론 기록
- SENSOR_STALE_MS 최종값 결정
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
