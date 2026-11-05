# Task: T03 최종 자동 검증과 직접 플레이 (사람)

## Status: pending

## Goal
자동 검증을 모두 돌리고, 사람이 플레이해 스킬 효과가 눈에 보이고 쓸 이유가 있는지 확인한다. 밀려 있던 이전 두 계획의 플레이 확인과 랭킹 v5 여부도 이 플레이로 정리한다.

## Decision Summary
- 결정 D10, D18. 사용자는 체크리스트를 직접 채우지 않고 채팅으로 느낌을 말해도 된다. 에이전트가 기록하되 대신 통과로 판단하지 않는다.
- 피드백은 `src/shared/gameTuning.ts`로 조정하고 `npm test`와 시뮬레이터를 다시 돌린다.

## Implementation

### I01. 자동 검증
- Related Files:
  - `.memory/references/playtest-2026-11-05-skill-guard-ammo.md` — 체크리스트에 항목 추가; modify
  - `scripts/playtest-bot.mjs`, `scripts/verify-live.mjs` — 실행만; read-only

#### Details
- 실행: `npm test`, `npx tsc --noEmit`, `npm run build`. `npm run server`와 `npm run dev`를 켠 뒤 `node scripts/playtest-bot.mjs`, `node scripts/verify-live.mjs`. 시스템 부하가 높아 기본 대기 시간에 실패하면 대기를 늘린 사본으로 돌리고 그 사실을 적는다.
- 결과를 체크리스트 파일 자동 검증 표에 적는다.
- **서버 주의**: `npm run server`는 `data/players.json`을 v4로 옮기면서 기존 점수를 백업 후 초기화한다. 이 PC의 파일에는 아직 규칙 버전이 없다. 처음 켜기 전에 사용자에게 알린다.
- 체크리스트 파일의 "이번에 바뀐 것" 뒤에 절을 추가한다.
  | 확인 항목 | 기대 | 폰 자이로 | 마우스 |
  | 리볼버 스킬이 맞는 게 보이는가 | 칼날이 닿는 몬스터가 찌그러지고 베인 자국이 보인다 | | |
  | Lv.1 칼날 3개가 충분한가 | 스킬이 통째로 허공으로 가는 일이 거슬리지 않는다 | | |
  | 칼날이 시야를 가리지 않는가 | 시전 직후에도 조준이 어렵지 않다 | | |
  | 포탄을 베는 게 보이는가 | 포격 때 스킬을 쓸 이유가 된다 | | |
  | 평타 관통이 보이는가 | 뒤 몬스터도 찌그러지거나 터진다 | | |
  | 개틀링 스킬로 밀리는 게 보이는가 | 몬스터가 뒤로 미끄러지는 게 멀리서도 보인다 | | |
  | 거품 모양이 맞는가 | 작은 거품이 촤악 퍼지고, 레벨이 오르면 많아진다 | | |
  | 거품이 많을 때 프레임이 유지되는가 | 끊기지 않는다 | | |
  | 16m 밖 몬스터가 앞으로 튀어나오지 않는가 | 샷건·개틀링 모두 앞으로 안 온다 | | |
  | 보스에게 뚫어뻥이 안 박히고 파랗게 안 변하는가 | 맞고 튕기며, 피해는 들어간다 | | |
  | 전체 난이도 | 보스·후반 긴장감이 남아 있다 | | |
  | 샷건 체감 | 버그 수정 후에도 괜찮다 | | |
- 조정 위치 표에 추가한다: 칼날 수·관통·보스 피해·폭·속도는 `skills.blade`, 거품 밀기·피해·수·속도는 `skills.foam`.

### I02. 사람 플레이 이후 마무리 (피드백 수신 후)
- Related Files:
  - `.memory/decisions/2026-11-05-weapon-skill-rework.md` — 최종값 반영; modify
  - `.memory/phases/2026-11-05-skill-guard-ammo-tuning/P03-retune-and-verify/T02-final-verification-and-playtest.md`, 그 `phase.md`, `.memory/plans/2026-11-05-skill-guard-ammo-tuning.md`; modify
  - `.memory/phases/2026-11-05-score-differentiation/` 의 P03-T04, `.memory/plans/2026-11-05-score-differentiation.md`; modify
  - `.memory/current.md`; modify
  - `src/shared/gameTuning.ts` :: `RANKING_RULESET_VERSION`; 사용자가 v5를 고를 때만 modify

#### Details
1. 들은 내용을 체크리스트에 적는다. 조정이 필요하면 `gameTuning.ts`를 고치고 `npm test`, `npx tsx .memory/references/scripts/simulate-current-decisions.ts 60`을 다시 돌린다.
2. 플레이 뒤 사용자에게 v5 여부를 묻는다. 올리면 서버가 기존 점수를 백업 후 초기화해 되돌릴 수 없으므로 실행 직전에 다시 확인한다. 올리면 `gameTuning.ts` 머리 주석에 `v5: 무기 스킬 개편`을 덧붙인다.
3. 이전 두 계획의 직접 플레이 Task를 이 플레이 결과로 닫는다. `2026-11-04-gameplay-polish-and-perf-optimization`의 P05-T04·T05는 닫지 않는다.
4. 모든 Phase를 `done`으로 표시하고 `.memory/current.md`를 정리한다.

## Acceptance Criteria
- [ ] `npm test`, `tsc`, `build`, 봇 플레이, 라이브 검증이 통과하고 결과가 체크리스트에 기록된다.
- [ ] 사람이 플레이한 결과가 기록되고 `gameTuning.ts` 조정 또는 "그대로 OK"로 확정된다.
- [ ] v5 여부가 사용자 답변으로 정해진다.
- [ ] 이전 두 계획의 플레이 확인 Task가 닫힌다.

## Validation
- `npm test && npx tsc --noEmit && npm run build` — 모두 통과

## Commit Message
```text
docs(memory): record verification and playtest for the weapon skill rework

Plan: 2026-11-05-weapon-skill-rework
Phase: P04-sync-and-verify
Task: T03-final-verification-and-playtest

- automated results and the human playtest checklist
- final values confirmed after playtest
- close the earlier playtest tasks merged into this run
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
