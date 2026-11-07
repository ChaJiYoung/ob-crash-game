# Current Context

## Active Plan
[Skill Charge Timer, Double Skill Fix, Fever Display](./plans/2026-11-07-skill-charge-and-fever-display.md)

## Active Phase
[P01 Skill and Fever UX](./phases/2026-11-07-skill-charge-and-fever-display/P01-skill-and-fever-ux/phase.md)

## Active Task
없음 (P01 T01~T04 완료, 사람 플레이 대기)

## Status
- 완료: 스킬 연속 발동 차단(폰 스킬 신호 400ms, 엔진 재발동 500ms), 다음 충전 시간 표시(폰·PC), 피버 배너 FEVER! 2.0x와 튜토리얼 문구. 피버 지속 시간·점수 배율은 `GAME_TUNING.fever.durationMs`·`scoreMult`로 이동.
- 플레이 후 확인: 실제 폰에서 한 번 젖힐 때 스킬 1회만 나가는지, 일부러 빠르게 두 번 젖힐 때 0.5초 잠금이 답답하지 않은지. 값은 `GAME_TUNING.skillInput`.

## Paused Plan
- `2026-11-07-fever-damage-multiplier`: 완료, 피버·보스 체감 플레이 확인 대기.
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05: 그대로 남는다.
- `2026-11-06-boss-drop-and-passive-cards`: 플레이 후 `data/play-records.jsonl` 확인.
- `2026-11-06-flawless-bonus-boxes`: 결정만 저장됨. 플레이 후 `/edu-plan flawless-bonus-boxes`.

## 사용자 결정 대기
- 무기 카드 보장, 피버 중 발사 속도 상향, 스킬 쿨다운·피해 조정
- 보스 웨이브 `parTimeSec`와 `bossWaveWeight`
- 샷건 공략 팁을 인게임 가이드에 넣을지

## Next Step (IMPORTANT)
사용자가 플레이한 뒤 스킬 입력·피버 표시 체감을 알려 주면 조정한다. 랭킹 규칙 버전(5)은 올리지 않는다.
