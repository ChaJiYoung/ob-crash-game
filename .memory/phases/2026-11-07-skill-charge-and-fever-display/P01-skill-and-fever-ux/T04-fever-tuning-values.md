# Task: T04 Fever Tuning Values

## Status: done

## Goal
피버 지속 시간(4초)과 점수 배율(1.5배)을 `GAME_TUNING.fever`로 옮겨, 튜닝 값을 바꾸면 엔진과 모든 안내 문구가 함께 바뀌게 한다. (T03 보고 후 사용자 승인으로 추가)

## Implementation
- `src/shared/gameTuning.ts` :: `GAME_TUNING.fever` — `durationMs: 4000`, `scoreMult: 1.5` 추가
- `src/shared/constants.ts` :: `FEVER_CONSTANTS.DURATION_MS` — `GAME_TUNING.fever.durationMs` 참조
- `src/pc/engine/ScoreAndFeverManager.ts` — 하드코딩 `1.5` → `GAME_TUNING.fever.scoreMult`
- `ArcadeOverlayHUD.tsx`(`formatFeverStatusBadge`), `TutorialGuideOverlay.tsx`, `GuideModal.tsx` — "4초", "1.5배" 문구를 튜닝 값으로 바꾸고 대미지 배율 표기 추가
- `tests/fever-tuning-sync.test.ts` (new)

## Validation
- `npx vitest run`, `npx tsc --noEmit`

## Progress
- [x] 구현 완료
- [x] 검증 통과 (vitest 517 passed, tsc OK)
- commit: see git log
