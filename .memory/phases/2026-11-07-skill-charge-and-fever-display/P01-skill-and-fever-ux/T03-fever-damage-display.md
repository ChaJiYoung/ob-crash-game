# Task: T03 Fever Damage Display

## Status: pending

## Goal
피버 중 명중하면 배너가 `FEVER!` / `2.0x 데미지`를 보여 주고, 튜토리얼 피버 문구에 대미지 배율이 나온다. 지금은 GREAT 고정이라 1.0x로 보인다.

## Decision Summary
- D03·D04: 배율은 `GAME_TUNING.judgment.feverDamage`에서 읽는다. 실제 대미지 로직은 건드리지 않는다.

## Implementation

### I01. 배너
- Related Files:
  - `src/pc/components/JudgmentBanner.tsx` :: `getJudgmentBannerSpec`, `JudgmentBannerHandle.show` — modify
  - `src/pc/PCGamePage.tsx` :: `handleShootEvent` — modify
#### Details
- `getJudgmentBannerSpec(grade: JudgmentGrade, isFever = false)`: `isFever && grade !== 'MISS'`이면 `{ title: 'FEVER!', subtitle: `${feverDamage.toFixed(1)}x 데미지 (피버)`, colorHex: '#f97316', scale: 1.3 }`.
- `show(grade, isFever?: boolean)`로 확장, PCGamePage 225줄에서 이미 있는 `isFever` 변수를 넘긴다.

### I02. 튜토리얼 문구
- Related Files:
  - `src/pc/components/TutorialGuideOverlay.tsx` — modify
#### Details
- 두 피버 문구의 `명중 점수 1.5배`를 `명중 점수 1.5배 & 대미지 {GAME_TUNING.judgment.feverDamage}배`로 바꾼다.

### I03. 테스트
- `tests/pc-hud-and-banner.test.ts`에 케이스 추가: `getJudgmentBannerSpec('GREAT', true)` → title `FEVER!`, subtitle에 `2.0x`. 인자 없는 호출은 기존 결과 유지.

## Acceptance Criteria
- [ ] 피버 중 명중 배너가 FEVER! 2.0x를 보여 준다.
- [ ] 평소 배너는 그대로다.

## Validation
- `npx vitest run`, `npx tsc --noEmit`

## Commit Message
```text
fix(fever): show the real fever damage multiplier

Plan: 2026-11-07-skill-charge-and-fever-display
Phase: P01-skill-and-fever-ux
Task: T03-fever-damage-display

- judgment banner shows FEVER! with feverDamage during fever
- tutorial fever text mentions the damage multiplier
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
