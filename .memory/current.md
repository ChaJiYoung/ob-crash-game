# Current Context

## Active Plan
[무기 스킬 개편과 효용성 정리](./plans/2026-11-05-weapon-skill-rework.md)

## Active Phase
[P01 세 무기 공통 규칙](./phases/2026-11-05-weapon-skill-rework/P01-shared-rules/phase.md)

## Active Task
[T03 스킬 피해 공용 함수, 카드 적용, spreadRad 삭제, 샷건 설명](./phases/2026-11-05-weapon-skill-rework/P01-shared-rules/T03-skill-damage-bonus-and-shotgun-text.md)

## Status
- P01-T01 완료(밀어내기 공용 함수 `pushTargetBack`), P01-T02 완료(보스 면역)
- 결정: [무기 스킬 개편 결정 문서](./decisions/2026-11-05-weapon-skill-rework.md)

## Paused Plan
- `2026-11-05-skill-guard-ammo-tuning` P03-T02(사람 직접 플레이): 이 계획의 P04-T03 플레이에 합쳐 닫는다.
- `2026-11-05-score-differentiation` P03-T04(사람 직접 플레이): 같은 플레이로 닫는다.
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05: 그대로 남는다(T05는 UI 확정 뒤).
- 랭킹 v5 여부와 전체 난이도 판단(이전 리뷰 1)은 P04-T03 플레이 뒤에 사용자에게 묻는다.

## Next Step (IMPORTANT)
T03 청사진을 읽고 `getSkillDamage`/`applySkillDamage`를 만들고 `spreadRad`를 지운다. P01 세 Task가 끝나면 Opus 5.5 리뷰를 받는다(사용자 요청).
