# Current Context

## Active Plan
[플레이 소감 반영 (장전 링, 스프링 똥, 피격 효과, 보스 경고, 냉각기 디자인)](./plans/2026-11-05-playtest-visual-feedback.md)

## Active Phase
[P01 화면 표시](./phases/2026-11-05-playtest-visual-feedback/P01-screen-feedback/phase.md)

## Active Task
[T01 장전 링 강화와 장전 중 조준점 흐림](./phases/2026-11-05-playtest-visual-feedback/P01-screen-feedback/T01-reload-ring.md)

## Status
- T01 구현 시작 준비 완료
- 결정: [결정 문서](./decisions/2026-11-05-playtest-visual-feedback.md)

## Paused Plan
- `2026-11-05-boss-summon-shell-and-speed` P04-T03(사람 플레이): 사용자 소감은 "거의 비슷했다"이나 **개틀링을 아직 안 해 봐서 다시 알려주기로 함**. 그때까지 닫지 않고 값도 고치지 않는다.
- 그 플레이로 `2026-11-05-weapon-skill-rework` P04-T03, `2026-11-05-skill-guard-ammo-tuning` P03-T02, `2026-11-05-score-differentiation` P03-T04도 함께 닫는다.
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05: 그대로 남는다.
- 랭킹 v5 여부는 개틀링 플레이 뒤 사용자에게 묻는다.

## Next Step (IMPORTANT)
T01 청사진을 읽고 `src/pc/components/CrosshairOverlay.tsx` 구현 시작
