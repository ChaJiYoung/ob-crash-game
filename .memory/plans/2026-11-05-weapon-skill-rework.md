# Plan: 무기 스킬 개편과 효용성 정리

## Goal
"리볼버·개틀링 스킬의 효과가 뭔지 모르겠다"는 직접 플레이 피드백을 해결한다. 스킬마다 역할을 나눈다(뚫어뻥 멈추기, 리볼버 처치, 개틀링 밀어내기).

측정 가능한 완료 기준:
- 리볼버 스킬은 부채꼴로 곧게 나가는 칼날이다. Lv.1~4 칼날 3 / 3 / 5 / 7개, 관통 0 / 1 / 1 / 2. 닿는 순간에만 피해가 들어가고 포탄을 벤다.
- 개틀링 스킬은 필드 전체를 3 / 3.5 / 4 / 5m 밀고, 피해는 0.2 / 0.3 / 0.4 / 0.5이며, 거품 수가 레벨마다 늘어난다.
- 어떤 밀어내기도 몬스터를 앞으로 끌어오지 않는다(16m 밖 포함).
- 보스에게는 기절·둔화가 걸리지 않고 관련 표시도 없다.
- 공격력 강화 카드가 세 스킬 피해에 모두 적용된다.
- 리볼버 평타 관통으로 맞은 몬스터에도 타격 연출이 보인다.
- `spreadRad`가 코드와 문서에서 사라지고, 무기·스킬 설명이 실제 동작과 일치한다.
- `npm test`, `npx tsc --noEmit`, `npm run build`, 봇 플레이, 라이브 검증이 통과하고 사람이 직접 플레이로 확인한다.

근거 문서: [결정 문서](../decisions/2026-11-05-weapon-skill-rework.md)

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 세 무기 공통 규칙: 밀어내기 버그 수정, 보스 면역, 카드 적용, `spreadRad` 삭제, 샷건 설명 | [P01](../phases/2026-11-05-weapon-skill-rework/P01-shared-rules/phase.md) |
| P02 | `in_progress` | 리볼버: 칼날 판정(엔진), 칼날·타격 연출(화면), 평타 관통 표시 | [P02](../phases/2026-11-05-weapon-skill-rework/P02-revolver-blades/phase.md) |
| P03 | `pending` | 개틀링: 거품 파도와 미끄러짐(엔진), 작은 거품 인스턴싱(화면) | [P03](../phases/2026-11-05-weapon-skill-rework/P03-gatling-foam/phase.md) |
| P04 | `pending` | 문서·문구 동기화, 기준 시간 재측정, 최종 검증과 직접 플레이 | [P04](../phases/2026-11-05-weapon-skill-rework/P04-sync-and-verify/phase.md) |

## 순서의 이유
- P01 먼저: `pushTargetBack`, `applySkillDamage`, `getSkillDamage`를 P02·P03이 재사용한다.
- 각 Phase는 엔진(판정)을 먼저, 화면(연출)을 나중에 둔다. 판정은 자동 테스트와 시뮬레이터로 검증할 수 있지만 연출은 그럴 수 없어서, 판정이 맞다는 것을 확인한 뒤 화면을 얹는다.
- P04는 마지막: 칼날과 거품 비행 시간까지 들어간 뒤에야 기준 시간을 잴 수 있고, 문구도 최종 동작 기준으로 쓸 수 있다.

## 선행 상태 / 충돌
- `2026-11-05-skill-guard-ammo-tuning` P03-T02(사람 직접 플레이)와 `2026-11-05-score-differentiation` P03-T04는 이 계획의 P04-T03 플레이에 합쳐 닫는다(결정 D18).
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05는 이번 플레이로 닫히지 않고 일시 중지 상태로 남는다.
- `RANKING_RULESET_VERSION`은 이 계획에서 올리지 않는다. v5 여부는 P04-T03 플레이 후 사용자에게 묻는다(결정 D10).
