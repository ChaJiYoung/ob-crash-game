# Current Context

## Active Plan
[2인팟 QA 수정](./plans/2026-11-07-two-player-coop-qa-fixes.md)

## Active Phase
[P03 2차 QA 수정](./phases/2026-11-07-two-player-coop-qa-fixes/P03-fixes-r2/phase.md)

## Active Task
[T07 2인 난이도 배율 조정(D41)](./phases/2026-11-07-two-player-coop-qa-fixes/P03-fixes-r2/T07-coop-difficulty-v2.md)

## Status
- T01 처리부 타이머 바인딩 수정 완료 (44e9dd5)
- T02 총구가 십자선 지점을 겨누게 수정 완료 (73a2316)
- T03 조준 경로 하나로 정리 완료 (d9ad271)
- T04 로비 모달 화면 맞춤 및 캡처 완료 (08b8d7e)
- T05 불안정 테스트 원인 제거 (7f942a1)
- T06 개발 서버 전용 읽기 전용 디버그 창구 구현 완료
- P03 T01 완료: 같은 기기 슬롯 이동 시 이전 슬롯 비우기
- P03 T02 완료: 선택 카드는 몸체를 맞혀야 선택
- P03 T03 완료: 결과·로비 십자선 menu variant(이름표 없음, 0.6배, 반투명, 모달 아래 층)
- P03 T04 완료: 배지·이름표 화면 안 clamp(clampToViewport)
- P03 T05 완료: 개틀링 링 border longhand 분리(콘솔 경고 0건)
- P03 T06 완료: setPhase 헬퍼로 ref 먼저 갱신, 시작 시 PLAYING 후 syncProcessors
- P01 QA 수정 완료 (6/6 Tasks 완료, P02 재QA 대기)

## Next Step (IMPORTANT)
P03-fixes-r2 T01~T06 구현. P04(3차 QA)는 리뷰어가 진행.

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
