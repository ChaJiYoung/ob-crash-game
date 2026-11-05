# Task: T03 최종 자동 검증과 직접 플레이 (사람)

## Status: in_progress (자동 검증 완료, 사람 직접 플레이 대기)

## Goal
자동 검증을 모두 돌리고, 사람이 직접 플레이해 후반 속도·보스 소환·보스 처치 연출·똥 포탄을 확인한다. 앞 계획(`weapon-skill-rework` P04-T03)의 플레이도 이 플레이로 함께 닫는다.

## Decision Summary
- 결정 D09. 사용자는 표를 직접 채우지 않고 채팅으로 느낌을 말해도 된다. 에이전트는 기록만 하고 대신 통과로 판단하지 않는다. v5 여부는 플레이 뒤 사용자에게 묻는다(되돌릴 수 없음).

## Implementation

### I01. 자동 검증과 체크리스트
- Related Files:
  - `.memory/references/playtest-2026-11-05-skill-guard-ammo.md` — "보스·속도·포탄 개편 추가분" 절; modify
  - `scripts/playtest-bot.mjs`, `scripts/verify-live.mjs` — 실행만; read-only

#### Details
- 실행: `npm test`, `npx tsc --noEmit`, `npm run build`, 개발 서버만 켜고 `node scripts/playtest-bot.mjs`, `node scripts/verify-live.mjs`. 게임 서버(`npm run server`)는 켜지 않는다. 라이브 스크립트가 덮어쓴 `docs/screens/screen-live-verification.png`는 `git checkout`으로 되돌린다.
- 체크리스트 항목 추가:
  | 후반 웨이브(5~7)가 초반보다 느리지 않게 느껴지는가 | 속도가 비슷하거나 더 빠르다 |
  | 오비·병맥주가 너무 빠르지 않은가 | 개성이 남아 있다 |
  | 보스 소환이 체력 구간마다 눈에 띄는가 | 99·66·33%에서 몬스터가 떨어진다 |
  | 소환 몬스터가 한꺼번에 몰려 못 버틸 만한가 | 어렵지만 가능하다 |
  | 보스 처치 연출이 "클리어했다"로 느껴지는가 | 폭발·연쇄·배너가 보인다 |
  | 연출 뒤 카드가 자연스럽게 나오는가 | 1.5초 뒤 나온다 |
  | 포탄이 아이템과 확실히 구분되는가 | 똥 모양이라 모르고 맞는 일이 없다 |
  | 발사 연출이 보이는가 | 쏘는 순간 갈색 분출이 보인다 |
  | 7웨이브 마지막 보스 처치 후 결과 화면 전환이 자연스러운가 | 연출 뒤에 결과가 뜬다 |
- 조정 위치: 소환 마릿수·구간·낙하 거리는 `boss.summonCount`, `summonHpThresholds`, `minionDrop`; 속도는 `speedPerWave`와 `TARGET_SPECS`; 보스 체력은 `waves[i].boss`; 연출 시간은 `boss.clear`.

### I02. 사람 플레이 이후 마무리 (피드백 수신 후)
- Related Files:
  - `.memory/decisions/2026-11-05-boss-summon-shell-and-speed.md`; modify (최종값)
  - `.memory/phases/2026-11-05-weapon-skill-rework/P04-sync-and-verify/T03-final-verification-and-playtest.md`와 그 plan/phase 문서, `skill-guard-ammo-tuning` P03-T02, `score-differentiation` P03-T04; modify (닫기)
  - `.memory/current.md`; modify

#### Details
1. 들은 내용을 체크리스트에 적고, 조정이 필요하면 `gameTuning.ts`를 고쳐 `npm test`와 시뮬레이터를 다시 돌린다.
2. v5 여부를 묻는다(서버를 켜면 기존 점수가 백업 후 초기화되어 되돌릴 수 없음). 올리면 `gameTuning.ts` 머리 주석에 `v5: 보스·속도 개편`을 덧붙인다.
3. 앞 계획과 이전 두 계획의 플레이 Task를 이 결과로 닫고 모든 Phase를 `done`으로 표시한다.

## Acceptance Criteria
- [ ] 자동 검증이 통과하고 결과가 체크리스트에 기록된다.
- [ ] 사람 플레이 결과가 기록되고 `gameTuning.ts` 조정 또는 "그대로 OK"로 확정된다.
- [ ] v5 여부가 정해진다.

## Validation
- `npm test && npx tsc --noEmit && npm run build` — 모두 통과

## Commit Message
```text
docs(memory): record verification and playtest for the boss and speed rework

Plan: 2026-11-05-boss-summon-shell-and-speed
Phase: P04-sync-and-verify
Task: T03-final-verification-and-playtest

- automated results and the human playtest checklist
- close the earlier playtest tasks merged into this run
```

## Progress
- [x] 구현 완료 (자동 검증·체크리스트 작성)
- [ ] 검증 통과 (사람 플레이 대기)
- commit: pending (사람 플레이 뒤)
