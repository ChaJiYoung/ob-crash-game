# Task: T01 처리부 타이머 바인딩 수정

## Status: done

## Goal
브라우저에서 사격·누른 채 연사·피버 자동 연사 때 나는 `TypeError: Illegal invocation`을 없앤다. 지금은 연사·피버 자동 연사 인터벌이 만들어지지 않아 1인·2인 모두 해당 기능이 동작하지 않는다.

## Decision Summary
- 원인: `src/pc/input/PlayerActionProcessor.ts` 54~60행 `private get setIntervalFn() { return this.ctx.timers?.setInterval ?? setInterval; }`를 `this.setIntervalFn(cb, 5)`로 부르면 브라우저 내장 `setInterval`이 `this = PlayerActionProcessor`로 호출되어 예외가 난다(Node·vitest에서는 통과해서 테스트가 못 잡음).
- 고치는 위치는 처리부 하나. 시간 주입(`ctx.timers`, `ctx.now`) 기능은 테스트에 필요하므로 유지하되, **항상 일반 함수로 호출**되게 생성자에서 묶어 둔다.

## Implementation

### I01. 타이머를 생성자에서 묶기

- Related Files:
  - `src/pc/input/PlayerActionProcessor.ts` :: `PlayerActionProcessor` 생성자, `setIntervalFn`·`clearIntervalFn` getter(삭제), `getNow`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  type IntervalFns = {
    set: (cb: () => void, ms: number) => ReturnType<typeof setInterval>;
    clear: (id: ReturnType<typeof setInterval>) => void;
  };
  private readonly timers: IntervalFns;
  constructor(private readonly ctx: ProcessorContext) {
    const t = ctx.timers;
    this.timers = t
      ? { set: (cb, ms) => t.setInterval(cb, ms), clear: (id) => t.clearInterval(id) }
      : { set: (cb, ms) => setInterval(cb, ms), clear: (id) => clearInterval(id) };
  }
  ```
- 사용처 4곳(`holdFireInterval`·`feverAutoFireInterval` 생성·해제)을 `this.timers.set(...)` / `this.timers.clear(...)`로 바꾸고 getter 두 개는 삭제한다.
- `getNow()`는 이미 `performance.now()`를 직접 호출하므로 그대로 둔다.

### I02. 같은 유형 전수 확인

- `grep -rnE "\?\? (setInterval|clearInterval|setTimeout|clearTimeout|requestAnimationFrame)\b|= (performance\.now|setInterval|setTimeout)\b[^(]" src`로 브라우저 내장 함수를 떼어 내 저장·호출하는 곳을 찾아 같은 방식으로 고친다. 결과를 커밋 메시지 본문에 "추가로 고친 곳: …" 또는 "없음"으로 적는다.

### I03. 재발 방지 테스트

- Related Files:
  - `tests/player-action-processor.test.ts`; modify

#### Details
- 브라우저처럼 `this`를 검사하는 가짜 전역 타이머로 처리부를 실행한다:
  ```typescript
  const realSet = globalThis.setInterval;
  globalThis.setInterval = function (this: unknown, cb: () => void, ms: number) {
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
    return realSet(cb, ms);
  } as typeof setInterval;
  // clearInterval도 같은 방식. 테스트 끝에 원래 함수 복구.
  ```
  `ctx.timers` 없이 만든 처리부에 `fireDown` → 예외 없음, 연사 인터벌 생성 확인. 피버 활성 상태에서 `tick()` → 예외 없음.

## Acceptance Criteria
- [x] 처리부가 브라우저 내장 타이머를 다른 `this`로 호출하지 않는다.
- [x] 위 테스트가 수정 전 코드에서는 실패하고 수정 후 통과한다(수정 전 실패를 한 번 확인).

## Validation
- `npx vitest run tests/player-action-processor.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과

## Commit Message
```text
fix(input): call browser timers unbound in the action processor

Plan: 2026-11-07-two-player-coop-qa-fixes
Phase: P01-fixes
Task: T01-timer-binding

- Bind setInterval/clearInterval once in the constructor so they are never called with the processor as this
- Hold fire and fever auto-fire no longer throw "Illegal invocation" in Chromium
- Test fakes a this-checking global timer like a browser

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
