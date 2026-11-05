# Current Context

## Active Plan
[후반 속도, 보스 소환 개편, 똥 모양 포탄, 보스 처치 연출](./plans/2026-11-05-boss-summon-shell-and-speed.md)

## Active Phase
[P04 문서 동기화와 최종 검증](./phases/2026-11-05-boss-summon-shell-and-speed/P04-sync-and-verify/phase.md)

## Active Task
[T03 최종 자동 검증과 직접 플레이 (사람)](./phases/2026-11-05-boss-summon-shell-and-speed/P04-sync-and-verify/T03-final-verification-and-playtest.md)

## Status
- P01~P04-T02 완료·자동 검증 통과, Opus 리뷰 반영 완료, **사람 직접 플레이 대기**(똥 포탄, 속도, 방패 제거, 체력 구간 소환, 보스 처치 연출)
- 결정: [결정 문서](./decisions/2026-11-05-boss-summon-shell-and-speed.md)

## Paused Plan
- `2026-11-05-weapon-skill-rework` P04-T03(사람 직접 플레이): 이 계획의 P04-T03 플레이에 합쳐 닫는다(앞 계획의 구현·자동 검증은 완료).
- 그 플레이로 `2026-11-05-skill-guard-ammo-tuning` P03-T02와 `2026-11-05-score-differentiation` P03-T04도 함께 닫는다.
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05: 그대로 남는다.
- 랭킹 v5 여부와 전체 난이도 판단은 P04-T03 플레이 뒤 사용자에게 묻는다.

## Next Step (IMPORTANT)
사용자가 `.memory/references/playtest-2026-11-05-skill-guard-ammo.md` 하단 "보스·속도·포탄 개편 추가분"을 플레이해 채팅으로 느낌을 말한다. 에이전트가 대신 통과로 표시하지 않는다.
**난이도 경고:** 합산 봇 클리어율이 샷건 보통 15%, 개틀링 45%, 리볼버 82%로 크게 어렵다(패배는 거의 5·7웨이브). 값은 아직 고치지 않았다. 피드백이 오면 `gameTuning.ts`(`boss.summonCount` 등)로 조정하고 `npm test`와 시뮬레이터를 다시 돌린다. 이후 v5 여부를 묻고 이전 계획들의 플레이 Task를 닫는다.
