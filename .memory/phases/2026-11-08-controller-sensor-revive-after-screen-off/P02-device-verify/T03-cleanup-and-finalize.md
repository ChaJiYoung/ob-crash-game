# Task: T03 임시 로그 제거와 마무리

## Status: superseded (2026-11-08-phone-lifecycle-fixes P04로 흡수)

## Goal
P02-T01에서 넣은 임시 디버그 코드를 모두 제거하고, T02에서 정한 `SENSOR_STALE_MS`를 반영한 뒤 전체 검증을 통과시킨다.

## Decision Summary
- D07: 확인이 끝나면 임시 로그는 제거한다.
- 제거 대상은 `TEMP(sensor-debug)` 주석이 붙은 코드 전부. 재등록·워치독 기능 자체(P01-T03)는 남긴다.

## Implementation

### I01. 임시 코드 제거와 임계값 반영

- Related Files:
  - `src/shared/types.ts` :: `ClientToServerMessage`의 `DEBUG_LOG` 멤버 — 제거; modify
  - `server/wsServer.ts` :: `case 'DEBUG_LOG'`와 관련 `fs` import — 제거; modify
  - `src/controller/MobileControllerPage.tsx` :: `debugQueueRef`, `sendDebug`, 로그 호출 지점, 로그용 등록 시각 ref — 제거; modify
  - `src/controller/sensors/SensorLiveness.ts` :: `SENSOR_STALE_MS` — T02에서 정한 값으로 갱신(변경이 없으면 유지); modify
  - `data/sensor-debug.log` :: 삭제(gitignore 대상이라 커밋에는 영향 없음); delete

#### Details
- **Execution Flow / Logic**:
  1. `grep -rn "TEMP(sensor-debug)" src server`로 위치를 모두 찾아 제거한다. 제거 후 같은 grep이 0건이어야 한다.
  2. `sensorLivenessRef`, `sensorEpoch`, 화면 복귀·워치독 effect는 **남긴다**. `SensorLiveness.elapsedMs`는 로그 전용이었다면 사용처가 없어지지만 테스트가 있으므로 남겨도 된다.
  3. 서버에서 `fs` import가 이 임시 코드 때문에 추가된 것이라면 같이 제거하고, 원래 쓰던 import는 건드리지 않는다.
  4. `SENSOR_STALE_MS`를 references 문서의 결정값으로 바꾼다. 값을 바꾸면 `tests/sensor-liveness.test.ts`가 기본값에 의존하는지 확인하고 필요하면 `SENSOR_STALE_MS`를 import해서 쓰도록 맞춘다.

## Acceptance Criteria
- [ ] `grep -rn "TEMP(sensor-debug)" src server`가 0건이다.
- [ ] `DEBUG_LOG`가 `src`, `server`에 남아 있지 않다.
- [ ] 재등록·워치독·영점 수정 기능은 그대로 동작한다 (테스트 통과).
- [ ] `tsc`, 전체 `vitest`, `build`가 통과한다.

## Validation
- `grep -rn "TEMP(sensor-debug)\|DEBUG_LOG" src server` — 출력 없음
- `npx tsc --noEmit` — 오류 없음
- `npx vitest run` — 전체 통과
- `npm run build` — 성공

## Commit Message
```text
chore(debug): 센서 진단용 임시 로그 제거, 임계값 확정

Plan: 2026-11-08-controller-sensor-revive-after-screen-off
Phase: P02-device-verify
Task: T03-cleanup-and-finalize

- DEBUG_LOG 타입·서버 핸들러·폰 로그 큐 제거
- SENSOR_STALE_MS를 실기기 로그 기준 값으로 확정
- tsc, vitest, build 통과 확인
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
