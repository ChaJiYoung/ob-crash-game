# Task: T02 임시 진단 코드 제거와 최종 검증

## Status: pending

## Goal
`TEMP(sensor-debug)`가 붙은 임시 진단 코드를 모두 제거하고, `tsc`·전체 `vitest`·`build`를 통과시킨다.

## Decision Summary
- controller-sensor-revive D07: 확인이 끝나면 임시 로그는 제거한다.
- 남기는 것: 센서 재등록 장치(`sensorEpoch`, 버튼이 사용), 조준 잠금 만료, 돌아가기 버튼, 서버 프레임 끊김 감지(`ControllerWatch`), 백그라운드/포그라운드 신호, 자동 영점. 제거하는 것은 진단용 로그뿐이다.

## Implementation

### I01. 임시 코드 제거

- Related Files:
  - `src/shared/types.ts` :: `ClientToServerMessage`의 `DEBUG_LOG` 멤버와 그 위 `// TEMP(sensor-debug)` 주석 — 제거; modify
  - `server/wsServer.ts` :: `import fs from 'node:fs'`, `writeSensorDebug`, `frameStats`, `SENSOR_FRAME` 케이스의 `TEMP(sensor-debug)` 블록, `case 'DEBUG_LOG'` — 제거; modify
  - `src/controller/MobileControllerPage.tsx` :: `debugQueueRef`, `debugRegisteredAtRef`, `debugLastOrientationRef`, `sendDebugRef`와 그 호출 지점(`orientation-first`, `orientation-gap`, `visibility`, `reregister`, 워치독 안의 `sendDebugRef.current()` flush) — 제거; modify
  - `data/sensor-debug.log` :: 삭제(gitignore 대상이라 커밋에는 영향 없음); delete

#### Details
- **Execution Flow / Logic**:
  1. `grep -rn "TEMP(sensor-debug)" src server tests`로 위치를 모두 찾아 제거한다. 제거 뒤 같은 grep이 0건이어야 한다. `DEBUG_LOG`도 0건이어야 한다.
  2. 남겨야 하는 것을 지우지 않도록 주의한다: `sensorLivenessRef`, `sensorEpoch`, 화면 복귀·워치독 effect(`onVisibility`, `watchdog` 인터벌)는 그대로 둔다. 로그 호출이 끼어 있던 줄만 제거하고 `bump()` 호출은 남긴다.
  3. `onVisibility`에서 `sendDebugRef.current('visibility', ...)`와 `reregister` 로그를 지운 뒤에도 `if (document.visibilityState === 'visible') bump();` 형태가 유지되어야 한다.
  4. 서버의 `fs` import가 이 임시 코드 때문에 추가된 것이면 같이 제거한다. `path`는 기존 코드가 쓰므로 유지한다.

### I02. 최종 검증

#### Details
- `SensorLiveness`·`SENSOR_STALE_MS`는 P04-T02에서 이미 삭제됐다. 서버 시간 상수(`CONTROLLER_LIFECYCLE`)는 T01 결과에서 조정이 필요할 때만 바꾼다.
- 서버의 `traceLifecycle` 호출과 헬퍼도 `TEMP(sensor-debug)`이므로 같이 제거한다.

## Acceptance Criteria
- [ ] `grep -rn "TEMP(sensor-debug)\|DEBUG_LOG" src server tests`가 출력 없음.
- [ ] 센서 복구, 서버 감지, 백그라운드 신호, 자동 영점 기능은 그대로 동작한다(테스트 통과).
- [ ] `tsc`, 전체 `vitest`, `build`가 통과한다.

## Validation
- `grep -rn "TEMP(sensor-debug)\|DEBUG_LOG" src server tests` — 출력 없음
- `npx tsc --noEmit` — 오류 없음
- `npx vitest run` — 전체 통과
- `npm run build` — 성공

## Commit Message
```text
chore(debug): 센서 진단용 임시 로그 제거, 임계값 확정

Plan: 2026-11-08-phone-lifecycle-fixes
Phase: P05-verify-and-cleanup
Task: T02-cleanup-and-finalize

- DEBUG_LOG 타입·서버 핸들러·프레임 요약 로그·폰 로그 큐와 호출 제거
- 서버 판정 추적 로그(traceLifecycle) 제거
- tsc, vitest, build 통과 확인
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
