# Task: T01 서버: 끊김 표시를 영점 신호로만 해제

## Status: done

## Goal
서버가 PC에 "폰 끊김"을 알린 자리는 프레임이 다시 와도 복귀로 보지 않고, 그 폰이 `CALIBRATE_ZERO`·`DEVICE_CHECK`를 보내거나 소켓이 닫힐 때만 해제한다. 프레임 재개로 PC를 복귀시키는 경로(`notifyControllerBack`)와 `backgrounded` 집합을 없앤다.

## Decision Summary
- return-button D05·D06(2)·D09. 복귀 경로는 폰의 버튼(또는 초록 버튼) → `CALIBRATE_ZERO` 하나다. 숨겨진 폰의 드문 프레임이 PC를 재개시키거나 3초마다 끊김 알림을 반복시키지 않게 한다.

## Implementation

### I01. `ControllerWatch` 의미 변경

- Related Files:
  - `server/ControllerWatch.ts` :: `ControllerWatch.onFrame`, 신규 `ControllerWatch.release` — 프레임으로 `lost`를 풀지 않음; modify

#### Details
- **Signatures & Types**:
  ```typescript
  /** 프레임을 받았을 때 마지막 수신 시각만 갱신한다. lost는 풀지 않는다(복귀는 release로만). */
  public onFrame(key: string, nowMs: number): void;
  /** 폰이 영점/재인증으로 돌아왔을 때: lost를 풀고 지금부터 다시 지켜본다. 이전에 lost였으면 true. */
  public release(key: string, nowMs: number): boolean;
  ```
- **Execution Flow / Logic**:
  1. `onFrame`: 항목이 없으면 `{lastMs: nowMs, lost: false}` 생성. 있으면 `lastMs = nowMs`만 갱신한다. 반환값 없음(기존 `'ok' | 'recovered'` 제거).
  2. `release`: 항목이 없으면 `{lastMs: nowMs, lost: false}` 생성 후 `false`. 있으면 `wasLost = entry.lost; entry.lost = false; entry.lastMs = nowMs; return wasLost`.
  3. `check`는 그대로(`!lost` 항목만 판정) — `lost` 상태의 키는 프레임이 와도 다시 보고되지 않는다.
  4. `markLost`, `isLost`, `forget`, `watchKey`, `parseWatchKey`는 그대로.

### I02. 서버 경로 정리

- Related Files:
  - `server/wsServer.ts` :: `notifyControllerBack`(삭제), `backgrounded`(삭제), `clearBackground`, `SENSOR_FRAME` 케이스, `CONTROLLER_BACKGROUND`/`FOREGROUND` 케이스, `CALIBRATE_ZERO` 케이스, `DEVICE_CHECK` 케이스, `close()` — modify

#### Details
- **Execution Flow / Logic**:
  1. `notifyControllerBack` 함수와 `RoomSession` import(다른 곳에서 안 쓰면)를 지운다.
  2. `backgrounded` 집합과 그 사용처(`add`, `has`, `delete`, `clear`)를 지운다. `clearBackground(key)`는 대기 타이머만 정리하도록 남긴다(이름 유지).
  3. `SENSOR_FRAME`: `watch.onFrame(frameKey, Date.now())`만 호출한다(결과 분기와 `frame-recovered` 추적 로그 제거).
  4. `CALIBRATE_ZERO`: 기존 `ZERO_CALIBRATED` 전송 전에, 보낸 소켓이 그 방의 컨트롤러면(`slotBySocket = roomManager.getControllerSlot(session, ws)`가 있으면) `clearBackground(key)`와 `watch.release(key, Date.now())`를 호출한다. `session`이 있고 `pcSocket`이 없어도 해제는 한다. 임시 추적 로그 `traceLifecycle('zero-release', { key, wasLost })` 한 줄을 `// TEMP(sensor-debug)`로 남긴다.
  5. `DEVICE_CHECK`: 기존 `clearBackground` + `watch.forget`을 유지한다(재연결 = 새 출발).
  6. `CONTROLLER_FOREGROUND`: `clearBackground(key)`만(대기 중 알림 취소). `CONTROLLER_BACKGROUND`: `backgrounded.add` 줄만 지우고 나머지(1초 타이머 → `markLost`가 true면 알림)는 그대로.
  7. `close()`: `backgrounded.clear()` 줄 삭제.
- **주의(회귀 방지)**: close 핸들러의 `alreadyReported`(이미 알린 슬롯은 다시 알리지 않음)는 그대로 둔다. `CALIBRATE_ZERO`의 `resume` 처리(`...(msg.resume === true ? { resume: true } : {})`)도 그대로다.

### I03. 테스트

- Related Files:
  - `tests/controller-watch.test.ts` — `onFrame` 반환값을 쓰던 단언을 `isLost`·`release` 단언으로 바꿈; modify
  - `tests/server-controller-watch.test.ts`, `tests/server-controller-background.test.ts` — 복귀 기대를 새 규칙으로 바꿈; modify

#### Details
- 순수: 프레임 끊김 후 `onFrame`을 해도 `isLost`가 `true`이고 `check`가 다시 반환하지 않는다. `release`는 이전 상태를 돌려주고(`true`→ 이후 `false`) 다시 지켜보기 시작한다(이후 타임아웃 시 재보고). 추적 없는 키의 `release`는 `false`.
- 서버 통합:
  1. 프레임 끊김 알림 뒤 프레임이 다시 와도 PC가 `ZERO_CALIBRATED`/추가 `CONTROLLER_PAIRED`를 받지 않고, 끊김 알림도 다시 오지 않는다(500ms 관찰).
  2. 그 뒤 폰이 `CALIBRATE_ZERO`(resume 없음)를 보내면 PC가 `ZERO_CALIBRATED`(resume 없음)를 받고, 이후 프레임이 다시 3초(테스트 옵션 300ms) 끊기면 끊김 알림이 한 번 더 온다(다시 지켜봄 확인).
  3. 백그라운드 알림 뒤 숨겨진 폰의 프레임: PC 재개 없음(기존 테스트 유지, 기대만 갱신). `FOREGROUND` + 프레임만으로는 복귀하지 않고, `CALIBRATE_ZERO`를 보내야 `ZERO_CALIBRATED`가 간다.
  4. 기존 "핸드셰이크 복귀 시 한 번만" 테스트는 `DEVICE_CHECK` 후 프레임이 복귀 알림을 보내지 않음을 그대로 확인한다.

## Acceptance Criteria
- [ ] 끊김이 알려진 자리는 프레임만으로 풀리지 않고, PC에 복귀 알림이 서버 단독으로 가지 않는다.
- [ ] `CALIBRATE_ZERO`·`DEVICE_CHECK`·소켓 종료로만 해제되고, 해제 뒤에는 다시 감시된다.
- [ ] `notifyControllerBack`·`backgrounded`가 코드에 없다.
- [ ] `tsc`, 전체 `vitest` 통과.

## Validation
- `grep -n "notifyControllerBack\|backgrounded" server/wsServer.ts` — 출력 없음
- `npx vitest run tests/controller-watch.test.ts tests/server-controller-watch.test.ts tests/server-controller-background.test.ts tests/pc-reconnect.test.ts` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- `npx vitest run` — 전체 통과

## Commit Message
```text
refactor(server): 끊김 표시는 영점 신호로만 해제, 프레임 복귀 알림 제거

Plan: 2026-11-08-phone-lifecycle-fixes
Phase: P04-return-button
Task: T01-server-lost-until-zero

- ControllerWatch: onFrame은 lost를 풀지 않음, release 추가
- notifyControllerBack·backgrounded 제거, CALIBRATE_ZERO에서 해제
- 테스트를 새 복귀 규칙으로 갱신
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
