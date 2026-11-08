# Task: T02 폰 스킬 디바운스 되돌리기

## Status: done

## Goal
T01 병합으로 자동으로 들어온 폰 쪽 스킬 신호 400ms 디바운스(`shouldSendSkillSnap`, `lastSkillSnapMsRef`)와 `GAME_TUNING.skillInput.snapDebounceMs`를 제거해, 결정 D03(엔진 잠금만 사용)과 일치시킨다.

## Decision Summary
- D03: 컨트롤러 파일은 건드리지 않는다. 중복 신호는 엔진 잠금이 거부한다. 자동 병합으로 들어온 부분만 원래대로 돌린다.
- `GunGripPad.tsx`의 충전 시간 문구(`formatControllerSkillStatus`)는 D06이라 **유지**한다.

## Implementation

### I01. 제거 대상
- Related Files:
  - `src/controller/sensors/GunGripTracker.ts` :: `shouldSendSkillSnap`, 그리고 `GAME_TUNING` import(다른 곳에서 안 쓰면) — 제거; modify
  - `src/controller/MobileControllerPage.tsx` :: `lastSkillSnapMsRef`, `import { ..., shouldSendSkillSnap }`, 스킬 스냅 분기 — 병합 전 형태로 복원; modify
  - `src/shared/gameTuning.ts` :: `skillInput` — `snapDebounceMs` 제거, 주석 갱신; modify
  - `tests/skill-double-trigger.test.ts` — `shouldSendSkillSnap` import와 'controller sends the skill signal once...' 케이스 삭제; modify
#### Details
- `MobileControllerPage.tsx` 스냅 분기를 병합 전 형태로 되돌린다:
  ```typescript
  if (snap && isSnapAllowed) {
    skillSnapTriggeredRef.current = true;
    // (이하 lockAim 등 기존 코드 유지)
  ```
  이 브랜치에서 해당 파일이 병합 전과 달라진 부분은 건드리지 않는다. `git diff HEAD~1 -- src/controller/MobileControllerPage.tsx`(병합 직전 대비)로 되돌릴 hunk가 main이 넣은 것뿐인지 확인.
- `skillInput` 최종 형태: `skillInput: { reuseLockMs: 500 }` (주석: 스킬 재발동 엔진 잠금(ms), 플레이어별).
- `GunGripTracker.ts` 맨 아래 `shouldSendSkillSnap` 함수와 주석 삭제. `GAME_TUNING` import가 그 함수 말고 쓰이지 않으면 import도 삭제.

## Acceptance Criteria
- [ ] `grep -rn "shouldSendSkillSnap\|snapDebounceMs\|lastSkillSnapMsRef" src tests` 결과 없음
- [ ] `GunGripPad.tsx`의 `formatControllerSkillStatus`와 `tests/skill-charge-timer.test.ts`는 그대로 통과
- [ ] 엔진 잠금 테스트 통과

## Validation
- `npx tsc --noEmit` — 오류 없음
- `npx vitest run` — 전체 통과

## Commit Message
```text
refactor(controller): drop phone-side skill debounce, rely on engine lock

Plan: 2026-11-08-merge-main-rules
Phase: P01-merge-and-port
Task: T02-revert-phone-debounce

- remove shouldSendSkillSnap and snapDebounceMs brought in by the main merge
- keep the engine per-player 500ms reuse lock as the only guard
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: see git log
