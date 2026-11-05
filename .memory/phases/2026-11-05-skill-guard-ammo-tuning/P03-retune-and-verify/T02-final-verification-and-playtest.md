# Task: T02 최종 자동 검증과 직접 플레이 (사람)

## Status: in_progress (자동 검증 완료, 사람 직접 플레이 대기)

## Goal
자동 검증을 모두 돌리고, 사람이 직접 플레이해 이번 피드백 네 가지가 실제로 해결됐는지 확인한다. 점수 차별화 계획의 대기 중인 플레이 확인(P03-T04)도 이때 함께 한다.

## Decision Summary
- 에이전트가 사람 체감 항목을 대신 통과로 표시하지 않는다.
- 피드백이 오면 `src/shared/gameTuning.ts`만 조정하고 `npm test`와 시뮬레이터를 다시 돌린다.

## Implementation

### I01. 자동 검증
- Related Files:
  - `.memory/references/playtest-2026-11-05-skill-guard-ammo.md` — 직접 플레이 체크리스트(새 파일); new
  - `scripts/playtest-bot.mjs`, `scripts/verify-live.mjs` — 실행만; read-only

#### Details
- 실행: `npm test`, `npx tsc --noEmit`, `npm run build`, `node scripts/playtest-bot.mjs`, `node scripts/verify-live.mjs`(둘 다 서버·개발 서버 필요; 실행 방법은 `.memory/references/playtest-2026-11-05.md` "실행 방법" 참고). 결과를 체크리스트 파일 "자동 검증" 표에 기록한다.
- 체크리스트 파일(사람이 채움)의 항목:
  | 확인 항목 | 기대 | 폰 자이로 | 마우스 |
  | 스킬이 충분히 빨리 차는가 | 한 웨이브에 1~3번 쓸 수 있다 | | |
  | 오비 방패가 내려가 있는 시간이 충분한가 | 박자만 읽으면 맞힐 수 있다 | | |
  | 탄창이 빡빡하지 않은가 (시작 10발) | 장전이 답답하지 않다 | | |
  | 장전 중인 것이 조준점에서 바로 보이는가 | 링이 차오르는 걸 보면 "장전 중"임을 안다 | | |
  | 피버 중에는 링이 안 나오는가 | 안 나온다 | | |
  | 개틀링 조준점 링이 도는 것이 거슬리지 않는가 (죽은 spin 수정으로 평소 4초에 한 바퀴) | 거슬리지 않는다 | | |
  | 피버 중 샷건·개틀링 조준점 링이 도는가 | 빠르게 돈다 | | |
  | 너무 쉬워지지 않았는가 | 보스·후반 웨이브 긴장감이 남아 있다 | | |
- 하단에 조정 위치를 적는다: 스킬 `skillCooldownMsByLevel`, 방패 `monsters.obi`, 장전 `fire.reloadScale`, 탄수 `maxAmmoByWeapon`, 기준 시간 `waves[i].parTimeSec`(모두 `src/shared/gameTuning.ts`).

### I02. 사람 플레이 이후 마무리 (피드백 수신 후)
- 조정한 값을 결정 문서에 반영하고, 점수 차별화 계획의 P03-T04도 이 플레이 결과로 닫는다(`.memory/references/playtest-2026-11-05.md`의 미채움 항목은 사용자가 정한다).
- 모든 Phase를 `done`으로 표시하고 `.memory/current.md`를 정리한다.

## Acceptance Criteria
- [x] `npm test`, `tsc`, `build`, 봇 플레이, 라이브 검증이 통과한다(결과가 `.memory/references/playtest-2026-11-05-skill-guard-ammo.md`에 기록됨).
- [ ] 사람이 체크리스트를 채우고 피드백이 `gameTuning.ts` 조정으로 반영되거나 "그대로 OK"로 확정된다.

## Validation
- `npm test && npx tsc --noEmit && npm run build` — 모두 통과

## Commit Message
```text
docs(memory): record verification and playtest for the skill/guard/ammo retune

Plan: 2026-11-05-skill-guard-ammo-tuning
Phase: P03-retune-and-verify
Task: T02-final-verification-and-playtest

- automated results and the human playtest checklist
- final tuning values confirmed after playtest
```

## Progress
- [x] 구현 완료 (자동 검증·체크리스트 파일 작성)
- [ ] 검증 통과
- commit: pending
