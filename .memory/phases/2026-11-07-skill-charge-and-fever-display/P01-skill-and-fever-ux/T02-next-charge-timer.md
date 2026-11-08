# Task: T02 Next Charge Timer

## Status: done

## Goal
스킬 스톡이 1개 이상 최대치 미만일 때, 폰과 PC HUD에 다음 충전까지 남은 초가 보인다.

## Decision Summary
- D01: 엔진은 이미 `skillCooldownRemainingMs`를 계산하고 폰에 보낸다(`SKILL_STATE_SYNC`). 표시 문자열만 바꾼다.

## Implementation

### I01. PC HUD 문자열
- Related Files:
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `formatWeaponSkillBadge` — modify
#### Details
- 조건 `isReady && skillStock < maxSkillStock && cooldownRemainingMs > 0` 이면 stockBadge를 ` [★${skillStock}/${maxSkillStock} · 다음 ${s}s]`로 (s = `(ms/1000).toFixed(1)`). 그 외 기존 문자열 유지(기존 테스트 `tests/pc-hud-and-banner.test.ts` 호환).

### I02. 폰 문자열
- Related Files:
  - `src/controller/components/GunGripPad.tsx` — modify
#### Details
- export 순수 함수 `formatControllerSkillStatus(skillName: string, stock: number, maxStock: number, remainingMs: number): string` 추가.
  - stock<=0: `스킬 재충전 중... ${s}s`
  - 0<stock<max && remainingMs>0: `⚡ ${skillName} READY! (${stock}/${max} · 다음 충전 ${s}s) 총구를 위로 '휙!' 젖히기`
  - 그 외: 기존 READY 문구.
- 252~254줄의 삼항식을 이 함수 호출로 교체.

### I03. 테스트
- `tests/skill-charge-timer.test.ts` (new): 두 함수에 대해 stock 0/1/2(max 2) 경우 문자열 검증.

## Acceptance Criteria
- [ ] 1/2 상태에서 PC·폰 모두 다음 충전 초가 보인다.
- [ ] 2/2, 0/2 상태 문구는 기존과 같다.

## Validation
- `npx vitest run`, `npx tsc --noEmit`

## Commit Message
```text
feat(skills): show time to the next skill charge

Plan: 2026-11-07-skill-charge-and-fever-display
Phase: P01-skill-and-fever-ux
Task: T02-next-charge-timer

- PC HUD badge shows the next charge seconds while partly charged
- controller READY text shows stock and next charge seconds
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (vitest 515 passed, tsc OK)
- commit: see git log
