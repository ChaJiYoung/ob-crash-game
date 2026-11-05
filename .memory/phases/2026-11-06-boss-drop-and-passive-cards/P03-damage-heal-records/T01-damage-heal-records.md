# Task: T01 받은 피해, 회복, 먹은 아이템 기록

## Status: done

## Goal
플레이 기록에서 한 판에 몇 번 맞고 얼마나 회복했는지 볼 수 있다.

## Decision Summary
- 사용자 요청으로 추가. 필드: `damageTaken`, `healedLives`, `itemsCollected`. 규칙 v5 유지.

## Implementation
### I01. 엔진
- `src/pc/engine/BeerCrusherEngine.ts`: 체력 감소(`update` 방어선)에 실제 줄어든 양, 수리 카드와 수리 아이템에 실제 오른 양(가득 차서 버려진 양 제외)을 센다. 아이템 사격 처리(`activateItemBuff` 호출부)에서 먹은 수를 센다. `startGame`에서 초기화.
### I02. 서버
- `src/shared/types.ts` `PlayRunStats`, `server/PlayRecordStore.ts` `isValidPlayRunStats`, `pickStats`.
- 함정: 이미 저장된 v5 기록에는 이 필드가 없다. 필수로 검사하면 서버 재시작 때 옛 판이 랭킹에서 사라진다. 선택 필드로 두어 있으면 숫자 검사, 없으면 저장 때 0으로 쓴다.
### I03. 테스트
- `tests/play-run-stats.test.ts`, `tests/play-records.test.ts`: 값 집계, 가득 찬 체력 회복은 0, 새 게임 초기화, 필드 없는 옛 기록이 랭킹에 복원.

## Acceptance Criteria
- [x] 기록에 세 값이 저장되고 옛 기록의 랭킹이 유지된다.

## Validation
- `npm test`, `npx tsc --noEmit`, `npm run build` — 통과

## Commit Message
```text
feat(stats): record damage taken, lives healed and items collected

Plan: 2026-11-06-boss-drop-and-passive-cards
Phase: P03-damage-heal-records
Task: T01-damage-heal-records

- Count real life changes per run and store them with play records
- Keep older records without these fields valid for the ranking

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
