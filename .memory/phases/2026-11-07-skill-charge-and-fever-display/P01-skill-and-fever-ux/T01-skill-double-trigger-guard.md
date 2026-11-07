# Task: T01 Skill Double Trigger Guard

## Status: pending

## Goal
스킬이 2개 찬 상태에서 손목을 한 번 젖히면 스킬이 1회만 발동한다. 지금은 가속도 값이 110ms보다 오래 튕겨 두 번 감지되고, PC에도 연속 발동을 막는 장치가 없다.

## Decision Summary
- D02: 폰 재감지 대기 110ms → 400ms, 엔진은 스킬 발동 후 500ms 동안 재발동 거부. 값은 `GAME_TUNING`에 둔다.

## Implementation

### I01. 튜닝 값
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING` — modify
#### Details
- 최상위에 `skillInput: { snapDebounceMs: 400, reuseLockMs: 500 }` 추가 (number, ms).

### I02. 폰 감지 디바운스
- Related Files:
  - `src/controller/sensors/GunGripTracker.ts` :: `GunGripTracker.detectSnapFire` — modify
#### Details
- `const cooldownMs = 110;` → `const cooldownMs = GAME_TUNING.skillInput.snapDebounceMs;` (import 추가). 다른 로직은 그대로 둔다.

### I03. 엔진 재발동 잠금
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `runWeaponSkill` — modify
#### Details
- private 필드 `lastSkillActivatedMs = -Infinity` 추가.
- `runWeaponSkill` 시작의 거부 조건에 `nowMs - this.lastSkillActivatedMs < GAME_TUNING.skillInput.reuseLockMs`를 OR로 추가한다. 반드시 `consumeSkill` 앞에 둔다(짧은 평가로 스톡 차감을 막기 위함).
- 발동 성공 시 `this.lastSkillActivatedMs = nowMs`. 게임 리셋 경로에서 `-Infinity`로 되돌린다.

### I04. 테스트
- `tests/skill-double-trigger.test.ts` (new):
  - 엔진에 스톡 2개 → t=1000 발동 성공, t=1200 거부·스톡 1 유지, t=1600 발동 성공.
  - `GunGripTracker.detectSnapFire`: 기준치 넘는 샘플을 0ms·200ms → 두 번째 false, 450ms → true.

## Acceptance Criteria
- [ ] 500ms 안의 두 번째 스킬 요청은 스톡을 소모하지 않는다.
- [ ] 폰 스냅 감지는 400ms 안에서 한 번만 true.

## Validation
- `npx vitest run` — 전체 통과
- `npx tsc --noEmit` — 타입 오류 없음

## Commit Message
```text
fix(skills): fire one skill per wrist snap

Plan: 2026-11-07-skill-charge-and-fever-display
Phase: P01-skill-and-fever-ux
Task: T01-skill-double-trigger-guard

- raise snap debounce on the controller from 110ms to 400ms
- reject a second skill within 500ms in the engine
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
