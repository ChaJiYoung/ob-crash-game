# Task: T05 `__setStep` 전역 노출 제거

## Status: done

## Goal
`MobileControllerPage.tsx` 상단에 남아 있는 `window.__setStep` 디버그 훅을 제거한다.

## Decision Summary
- D09. 사용처 확인 결과(`grep -rn "__setStep"`): 소스·테스트·문서 어디에서도 호출하지 않고 정의 한 줄만 있다. 제거해도 동작 영향이 없다.

## Implementation

### I01. 훅 제거와 가드 테스트

- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: `MobileControllerPage` 상단의 `if (typeof window !== 'undefined') { (window as any).__setStep = setStep; }` 블록 — 제거; modify
  - `tests/controller-reconnect.test.ts` :: `describe('MobileControllerPage reconnect wiring (source guard)')` — 소스 가드 케이스 추가; modify

#### Details
- **Execution Flow / Logic**:
  1. 시작 전에 `grep -rn "__setStep" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git .`로 사용처가 없음을 다시 확인한다. 새로 생긴 사용처가 있으면 제거하지 말고 사용자에게 알린다.
  2. 위 4줄 블록(`if (typeof window !== 'undefined') {` … `}`)을 통째로 제거한다. `setStep` 자체(상태 setter)는 컴포넌트 내부에서 계속 쓰이므로 건드리지 않는다.
  3. 소스 가드 테스트: `expect(source).not.toContain('__setStep')`.

## Acceptance Criteria
- [ ] `MobileControllerPage.tsx`에 `__setStep`과 `(window as any)`가 없다.
- [ ] 소스 가드 테스트가 통과한다.
- [ ] 폰 컨트롤러 화면 전환(로그인 → 영점 → 패드) 관련 기존 테스트가 통과한다.

## Validation
- `grep -rn "__setStep" src tests` — 가드 테스트의 문자열 외에는 출력 없음
- `npx vitest run tests/controller-reconnect.test.ts tests/controller-ui-and-routing.test.ts` — 전체 통과
- `npx tsc --noEmit` — 타입 오류 없음

## Commit Message
```text
chore(controller): 사용하지 않는 __setStep 전역 노출 제거

Plan: 2026-11-08-controller-sensor-revive-after-screen-off
Phase: P01-sensor-revive
Task: T05-remove-set-step

- window.__setStep 디버그 훅 제거 (사용처 없음 확인)
- 재도입 방지용 소스 가드 테스트 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
