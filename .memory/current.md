# Current Context

## Active Plan
[2인팟 QA 수정](./plans/2026-11-07-two-player-coop-qa-fixes.md)

## Active Phase
[P01 QA 수정](./phases/2026-11-07-two-player-coop-qa-fixes/P01-fixes/phase.md)

## Active Task
[T04 로비 모달이 1440×900·1024×768 안에 들어오게](./phases/2026-11-07-two-player-coop-qa-fixes/P01-fixes/T04-lobby-fit.md)

## Status
- T01 처리부 타이머 바인딩 수정 완료 (44e9dd5)
- T02 총구가 십자선 지점을 겨누게 수정 완료 (73a2316)
- T03 조준 경로 하나로 정리 완료
- P01 QA 수정 진행 중 (3/6 Tasks 완료)

## Next Step (IMPORTANT)
T01 청사진을 읽고 `src/pc/input/PlayerActionProcessor.ts` 타이머 바인딩부터. P02(재QA)는 리뷰어가 진행하므로 구현 에이전트는 P01만 한다.

## Paused Plan (이전 current에서 이어짐)
- `2026-11-07-weapon-balance`: 완료, 사람 플레이 대기(샷건 68%, 리볼버 64%, 개틀링 70%).
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05: 그대로 남는다.
- `2026-11-06-low-level-bonus-and-stage-cleanup`: 사후 기록 계획, 열린 Task 없음.
- `2026-11-06-boss-drop-and-passive-cards`: 플레이 후 `data/play-records.jsonl`의 피해·회복 값과 느낌을 확인한다.
- `2026-11-06-flawless-bonus-boxes`: 결정만 저장됨. 플레이 후 `/edu-plan flawless-bonus-boxes`로 계획을 세운다(랭킹 규칙 버전 6 상향은 그 기능의 마지막 Task).

## 사용자 결정 대기 (이전 current에서 이어짐)
- 무기 카드 보장(샷건 클리어율 +25%p 측정), 피버 중 발사 속도 상향(+27%p), 스킬 쿨다운·피해 조정
- 보스 웨이브 `parTimeSec`와 `bossWaveWeight`
- 샷건 공략 팁을 인게임 가이드에 넣을지
- 랭킹 규칙 버전(5)은 올리지 않는다.
