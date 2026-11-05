# Plan: 후반 속도, 보스 소환 개편, 똥 모양 포탄, 보스 처치 연출

## Goal
직접 플레이 피드백 세 가지를 해결한다: (1) 후반 웨이브가 초반보다 느리게 느껴진다, (2) 보스가 빨리 깨져서 소환을 못 본다, (3) 요격 포탄이 아이템처럼 보여 모르고 맞았다. 보스를 잡고도 "클리어했다"는 순간이 없다.

측정 가능한 완료 기준:
- `speedPerWave` 0.08, 오비 2.2, 병맥주 2.0. 도감·가이드 문구가 값과 일치한다.
- 대왕 방패가 코드·모델·HUD·문서에서 사라진다(오비 방패는 그대로).
- 보스 체력 75 / 70×2 / 90×2 / 대왕 200. 각 보스가 체력 99 / 66 / 33% 아래로 내려갈 때마다 4마리를 소환한다(상한 없음, 시간 소환 제거).
- 마지막 보스를 잡으면 큰 폭발 → 남은 몬스터 연쇄 폭발 → "BOSS DOWN!" 배너 1.5초 → 카드(7웨이브는 결과 화면).
- 한맥·보스 포탄이 갈색 똥 모양이고, 발사 순간 분출 연출이 나오며, 요격 파편이 갈색이다.
- `npm test`, `npx tsc --noEmit`, `npm run build`, 봇 플레이, 라이브 검증이 통과하고 사람이 직접 플레이로 확인한다.

근거 문서: [결정 문서](../decisions/2026-11-05-boss-summon-shell-and-speed.md)

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 속도 값, 대왕 방패 제거, 보스 체력 구간 소환(시간 소환 제거) | [P01](../phases/2026-11-05-boss-summon-shell-and-speed/P01-speed-and-boss-rules/phase.md) |
| P02 | `in_progress` | 보스 처치 연출: 엔진 처치 시퀀스와 화면 폭발·배너 | [P02](../phases/2026-11-05-boss-summon-shell-and-speed/P02-boss-clear-effect/phase.md) |
| P03 | `pending` | 똥 모양 포탄, 발사 사건과 분출 연출, 갈색 파편 | [P03](../phases/2026-11-05-boss-summon-shell-and-speed/P03-poop-shell/phase.md) |
| P04 | `pending` | 문서·가이드 동기화, 기준 시간 재측정, 최종 검증과 직접 플레이 | [P04](../phases/2026-11-05-boss-summon-shell-and-speed/P04-sync-and-verify/phase.md) |

## 순서의 이유
- P01 먼저: 방패와 시간 소환을 걷어내야 P02의 "마지막 보스" 판정과 P03 이전의 보스전 규칙이 단순해진다. 지우기를 먼저 하고 새 규칙을 얹는다.
- P02는 P01 뒤: 처치 시퀀스가 `handleMonsterKilled`의 보스 분기를 바꾸는데, 이 분기에서 방패 해제 호출을 먼저 없애야 충돌이 없다.
- P03은 독립이라 P02 뒤에 둔다(같은 `GameCanvas3D.tsx`의 이벤트 소비 코드를 재사용).
- P04는 마지막: 최종 동작 기준으로 문구를 쓰고, 속도·보스 체력·소환이 모두 들어간 뒤에 기준 시간을 잰다.

## 선행 상태 / 충돌
- `2026-11-05-weapon-skill-rework` P04-T03(사람 직접 플레이)이 대기 중이다. 이 계획의 P04-T03에 합쳐서 한 번에 플레이한다. 그 플레이로 `skill-guard-ammo-tuning` P03-T02와 `score-differentiation` P03-T04도 함께 닫는다.
- `RANKING_RULESET_VERSION`은 이 계획에서도 올리지 않는다(결정 D09). v5 여부는 플레이 뒤 사용자에게 묻는다.
- 난이도가 크게 오른다(결정 D04 경고). P04-T02에서 합산 재측정 수치를 사용자에게 보고하고, 값은 `GAME_TUNING.boss.summonCount`로 조정한다.
