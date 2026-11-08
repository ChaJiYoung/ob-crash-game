# Task: T01 autoZeroFromLatest 원시값 기준 수정

## Status: done

## Goal
`PhoneAdapter.autoZeroFromLatest()`를 몇 번 호출해도 호출 직후 같은 센서값이 들어오면 조준이 (0,0)이 되도록 고친다. 지금은 이미 영점·감도가 적용된 `latestAim`을 새 영점으로 저장해서, 두 번째 호출부터 어긋난다.

## Decision Summary
- D06 ①: 마지막 "원시 센서값(영점 적용 전, invertY 적용 후)"을 저장하고 영점을 그 값으로 잡는다.
- 폰 쪽 코드는 건드리지 않는다. PC 어댑터 한 파일과 테스트만 수정한다.

## Implementation

### I01. PhoneAdapter 원시값 저장과 영점 수정

- Related Files:
  - `src/pc/input/PhoneAdapter.ts` :: `PhoneAdapter.onSensorFrame`, `PhoneAdapter.autoZeroFromLatest` — 영점 계산 수정; modify
  - `src/pc/PCGamePage.tsx` :: `autoZeroFromLatest()` 호출 4곳 (약 927, 970, 1174, 1594행) — 호출부는 변경 없음; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  // PhoneAdapter 클래스에 private 필드 추가
  private latestPayloadAim = { x: 0, y: 0 };
  // 시그니처 변경 없음
  public autoZeroFromLatest(): void;
  ```
  - `public latestAim`은 그대로 둔다(다른 코드가 읽을 수 있음).
- **Data & Schema Fields**:
  - `latestPayloadAim.x` = `p.aimX` (페이로드 그대로)
  - `latestPayloadAim.y` = `tuning.invertY ? -p.aimY : p.aimY` (`applyZeroAndTuning`의 `signedAimY`와 같은 값)
  - 초기값 (0,0): 프레임을 한 번도 받지 못했으면 지금과 같은 결과.
- **Execution Flow / Logic**:
  1. `onSensorFrame`에서 `applyZeroAndTuning` 호출 직후 `this.latestPayloadAim`을 위 규칙대로 갱신한다.
  2. `autoZeroFromLatest`는 `zeroOffset = { offsetX: latestPayloadAim.x, offsetY: latestPayloadAim.y }`로 설정한다.
  3. 이유: `applyZeroAndTuning`은 `(payload.aimX - zero.offsetX) * sensitivityX`이므로 영점은 "페이로드 공간" 값이어야 한다. 기존 코드는 감도·영점이 적용된 값을 넣어서 영점이 0이 아닐 때나 감도가 1이 아닐 때 어긋난다.
  4. 예외 처리 없음. 순수 계산.

### I02. 단위 테스트

- Related Files:
  - `tests/input-adapters.test.ts` :: `describe('PhoneAdapter')` 안에 케이스 추가 — 테스트; modify

#### Details
- 기존 `makePayload`, `makeTuning`(없는 옵션이면 객체 스프레드로 덮어쓰기), `mockSink` 패턴을 그대로 쓴다. 어댑터는 기존 테스트처럼 `new PhoneAdapter({ sink, send, roomId, getTuning, now })`.
- 케이스 1 — 반복 영점: 감도 1.5, `makePayload({aimX:0.5, aimY:0.4})` 전송 → `autoZeroFromLatest()` → 같은 페이로드 재전송 시 결과 `aimX===0`, `aimY===0`. 이어서 `makePayload({aimX:0.8, aimY:0.2})` 전송 → `autoZeroFromLatest()` → 같은 페이로드 재전송 시 다시 (0,0). (기존 코드는 두 번째에서 0이 아님)
- 케이스 2 — invertY: `invertY: true`, `makePayload({aimY:0.4})` → `autoZeroFromLatest()` → 같은 페이로드 재전송 시 `aimY===0`.
- 케이스 3 — 프레임 없이 호출: 새 어댑터에서 `autoZeroFromLatest()` 호출 시 `zeroOffset`이 `{0,0}` 유지.
- 케이스 4 — 영점 뒤 움직임: 영점 직후 `aimX`를 +0.1 올린 페이로드를 보내면 결과 `aimX === 0.1 * sensitivityX` (부동소수점은 `toBeCloseTo`).

## Acceptance Criteria
- [ ] `autoZeroFromLatest()`를 연속 호출해도 매번 직후 동일 입력이 (0,0)이 된다 (감도 1.5, invertY 포함).
- [ ] 프레임 수신 전 호출은 영점 (0,0)을 유지한다.
- [ ] 기존 `input-adapters` 테스트가 모두 통과한다.

## Validation
- `npx vitest run tests/input-adapters.test.ts` — 전체 통과
- `npx tsc --noEmit` — 타입 오류 없음

## Commit Message
```text
fix(input): autoZeroFromLatest가 원시 센서값으로 영점을 잡도록 수정

Plan: 2026-11-08-controller-sensor-revive-after-screen-off
Phase: P01-sensor-revive
Task: T01-auto-zero-raw

- PhoneAdapter가 마지막 페이로드 조준값(invertY 적용 후)을 저장
- autoZeroFromLatest가 영점·감도가 적용된 값 대신 저장된 원시값을 영점으로 사용
- 반복 영점, invertY, 프레임 없음 케이스 테스트 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
