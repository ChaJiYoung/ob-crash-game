# Task: T01 PlayerPanel 피버 표시에 배율 반영

## Status: done

## Goal
2인용 `PlayerPanel`이 피버 중 `⚡ FEVER TIME!`만 보여 주는 대신 점수·대미지 배율을 함께 보여 준다. main에는 이 컴포넌트가 없어서 병합으로는 반영되지 않는 부분이다.

## Decision Summary
- D04-2(피버 HUD에 실제 배율 표시)의 이 브랜치 쪽 짝. 배율은 `GAME_TUNING`에서 읽는다.

## Implementation

### I01. 라벨 함수 분리
- Related Files:
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `formatFeverStatusBadge` — T01(P01)에서 이미 배율 라벨 보유; read-only 참조
  - `src/pc/components/PlayerPanel.tsx` :: 피버 문구(약 245행 `'⚡ FEVER TIME!'`) — modify
  - `tests/player-panel-fever.test.ts` — new
#### Details
- `PlayerPanel.tsx`의 피버 상태 삼항식(`FEVER TIME!` / `FEVER READY` / `FEVER GAUGE n%`)에서 활성 문구를 `` `⚡ FEVER TIME! 점수 ${GAME_TUNING.fever.scoreMult}배·대미지 ${GAME_TUNING.judgment.feverDamage}배` ``로 바꾼다. 패널 폭이 좁으므로 긴 문구가 줄바꿈/overflow 되는지 해당 스타일(`whiteSpace`, `fontSize`)을 확인하고, 넘치면 `fontSize`를 한 단계 낮추거나 두 줄로 쪼갠다.
- 문구를 테스트하기 쉽게 `PlayerPanel.tsx`에서 `export function formatPanelFeverText(isActive: boolean, isReady: boolean, gauge: number): string`를 뽑아 사용한다.
- 테스트: `formatPanelFeverText(true, false, 100)`이 `점수 1.5배`, `대미지 2배`(`GAME_TUNING` 값 보간)를 포함, `isReady`일 때 `FEVER READY`, 그 외 `FEVER GAUGE n%`.

## Acceptance Criteria
- [ ] 피버 활성 시 패널 문구에 두 배율이 튜닝 값대로 표시
- [ ] 비활성/준비 문구는 기존과 동일
- [ ] 패널 안에서 문구가 잘리지 않음(코드로 확인, 육안 확인은 보고)

## Validation
- `npx vitest run tests/player-panel-fever.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(panel): show fever score and damage multipliers on player panel

Plan: 2026-11-08-merge-main-rules
Phase: P02-fever-panel
Task: T01-player-panel-fever

- extract formatPanelFeverText and add tuned multipliers
- add unit test
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- note: 패널이 좁아 한 줄 문구 대신 피버 중에만 게이지 아래 별도 줄(`formatPanelFeverBonus`)로 배율 표시
- commit: see git log
