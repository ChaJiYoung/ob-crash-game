# Current Context

## Active Plan
[판별 플레이 기록 저장과 결과 화면 랭킹](./plans/2026-11-05-play-records-and-result-ranking.md)

## Active Phase
[P01 결과 화면 랭킹](./phases/2026-11-05-play-records-and-result-ranking/P01-result-ranking/phase.md)

## Active Task
[T01 결과와 TOP 5 좌우 배치](./phases/2026-11-05-play-records-and-result-ranking/P01-result-ranking/T01-side-ranking.md)

## Status
- T01 구현 시작 준비 완료

## Paused Plan
- `2026-11-05-boss-distance-gatling-hanmac`: 구현 완료, 사람 플레이 느낌 대기.
- `2026-11-05-playtest-visual-feedback` P03-T02(사람 플레이): 자동 검증 완료, 느낌 확인 대기.
- `2026-11-05-boss-summon-shell-and-speed` P04-T03(사람 플레이): 사용자 소감은 "거의 비슷했다"이나 **개틀링을 아직 안 해 봐서 다시 알려주기로 함**. 그때까지 닫지 않고 값도 고치지 않는다.
- 그 플레이로 `2026-11-05-weapon-skill-rework` P04-T03, `2026-11-05-skill-guard-ammo-tuning` P03-T02, `2026-11-05-score-differentiation` P03-T04도 함께 닫는다.
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05: 그대로 남는다.
- 랭킹 v5 여부는 개틀링 플레이 뒤 사용자에게 묻는다.

## Next Step (IMPORTANT)
T01 청사진을 읽고 `src/pc/components/ResultRankingModal.tsx` 구현 시작
