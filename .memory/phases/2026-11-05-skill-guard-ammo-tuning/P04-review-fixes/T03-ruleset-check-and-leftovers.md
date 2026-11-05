# Task: T03 점수 제출 규칙 버전 검사와 남은 정리

## Status: done

## Goal
옛 빌드 클라이언트가 v4 랭킹에 옛 규칙 점수를 넣지 못하게 점수 제출에 규칙 버전을 싣고 서버가 검사한다. 쓰이지 않는 `WEAPON_CONSTANTS.MAX_AMMO`·`AUTO_RELOAD_MS`를 지우고 base 무기 표의 덮어쓰기 주석을 추가한다.

## Decision Summary
- `GAME_SCORE_SUBMIT`에 `rulesetVersion`을 **필수**로 요구한다. 없으면(옛 클라이언트) 버전 불일치와 같이 거절한다.
- 거절은 `ERROR` 메시지(`code: 'RULESET_MISMATCH'`)로 알리고 점수는 기록하지 않는다.

## Implementation

### I01. 프로토콜과 서버
- Related Files (modify): `src/shared/types.ts` (`ClientToServerMessage`의 `GAME_SCORE_SUBMIT`, `ERROR` 코드 유니온 있으면 추가), `server/wsServer.ts` (`case 'GAME_SCORE_SUBMIT'`), `src/pc/PCGamePage.tsx` (`submitScore`)
#### Details
- 타입: `{ type: 'GAME_SCORE_SUBMIT'; roomId: string; deviceId: string; score: number; waveReached: number; maxCombo: number; rulesetVersion: number }`
- 서버: 기존 입력 검증 뒤에 `if (msg.rulesetVersion !== RANKING_RULESET_VERSION) { sendJson(ws, { type: 'ERROR', code: 'RULESET_MISMATCH', message: ... }); return; }` — `recordGameScore` 호출 전.
- 클라이언트: `submitScore`의 JSON에 `rulesetVersion: RANKING_RULESET_VERSION`(`gameTuning`에서 import).
### I02. 정리
- Related Files (modify): `src/shared/constants.ts`, `tests/shared-protocol.test.ts`
#### Details
- `WEAPON_CONSTANTS`에서 `MAX_AMMO`, `AUTO_RELOAD_MS`를 삭제하고 테스트의 해당 두 줄 삭제(사용처가 없는지 `grep`으로 재확인).
- `BASE_WEAPON_ARCHETYPE_SPECS` 위에 "maxAmmo·reloadDurationMs·skillCooldownMs는 `applyWeaponTuning`이 `GAME_TUNING`으로 덮어쓰므로 기본 표의 이 값은 직접 쓰지 않는다" 주석.
### I03. 테스트
- Related Files (modify): `tests/server-session.test.ts`
#### Details
- 기존 점수 제출 테스트(390행 근처)에 `rulesetVersion: RANKING_RULESET_VERSION` 추가.
- 새 케이스: 버전이 다르거나 없으면 `ERROR`(`RULESET_MISMATCH`)를 받고 `bestScore`가 기록되지 않는다.

## Acceptance Criteria
- [ ] 버전이 맞는 제출만 랭킹에 반영된다
- [ ] 상수 두 개가 없고 `tsc`·`npm test`·`npm run build` 통과

## Validation
- `npx tsc --noEmit && npm test && npm run build`

## Commit Message
```text
fix(server): reject score submissions from a different ranking ruleset

Plan: 2026-11-05-skill-guard-ammo-tuning
Phase: P04-review-fixes
Task: T03-ruleset-check-and-leftovers

- GAME_SCORE_SUBMIT carries rulesetVersion; the server answers RULESET_MISMATCH and records nothing
- remove unused WEAPON_CONSTANTS.MAX_AMMO / AUTO_RELOAD_MS
- note that the base weapon table values are overwritten by GAME_TUNING
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
