# Plan: 플레이 피드백 반영 (가이드·로비·샷건 스킬/퍼짐·튜토리얼)

- 결정 문서: [2026-11-09-playtest-feedback-guide-lobby-shotgun](../decisions/2026-11-09-playtest-feedback-guide-lobby-shotgun.md) (D01~D19)

## Goal
외부 플레이 피드백 5건을 반영한다. 측정 가능한 완료 기준:
1. 샷건 평타 한 발이 십자선 주변 몬스터 2/2/3/3마리에게 주 대상 피해의 10/15/20/25%를 추가로 준다(스케일 1.2→1.0).
2. 샷건 스킬은 방어선에 가까운 4/5/6/8마리에 박혀 2.0/2.2/2.5/3.0초 기절한 뒤 0.7/0.8/0.9/1.0 피해로 터진다(보스는 즉시 피해만).
3. 봇 80판 클리어율이 게틀링(68%) < 샷건 < 리볼버(70%) 서열에 들어온다(안 맞으면 D08 규칙대로 조정).
4. 로비는 1P가 마지막에 쓴 입력 방식(처음은 모바일)으로 시작하고 "지금 할 일" 배너가 단계를 안내한다.
5. 가이드 모달이 카드(아이콘·한 줄 요약·수치 칩·접기)로 바뀌고, 튜토리얼 3단계가 샷건→리볼버→게틀링 스킬 체험 3라운드가 된다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 샷건 평타 퍼짐: 추가 명중 엔진·튜닝, 연출 | [P01](../phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P01-shotgun-spread/phase.md) |
| P02 | `pending` | 샷건 스킬 재설계: 박힘→기절→폭발, `GAME_TUNING.skills.plunger`, 연출 | [P02](../phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P02-shotgun-skill/phase.md) |
| P03 | `pending` | 균형 측정·튜닝: 봇 80판으로 서열 확인, 값 조정 | [P03](../phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P03-balance-measure/phase.md) |
| P04 | `pending` | 로비: 1P 입력 방식 기억·기본값, "지금 할 일" 배너 | [P04](../phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P04-lobby/phase.md) |
| P05 | `pending` | 가이드 모달 카드화(한 줄 요약·칩·접기), 문구는 튜닝 값에서 계산 | [P05](../phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P05-guide/phase.md) |
| P06 | `pending` | 튜토리얼 3단계 무기 3라운드(샷건·리볼버·게틀링 스킬 체험) | [P06](../phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P06-tutorial/phase.md) |
| P07 | `pending` | 문서 캡처 재촬영·교체, README 참조 점검 | [P07](../phases/2026-11-09-playtest-feedback-guide-lobby-shotgun/P07-docs-captures/phase.md) |

## 순서의 이유
- P01→P02→P03: 샷건 수치(평타·스킬)가 모두 구현된 뒤에야 봇 측정(P03)이 의미 있다. 측정 결과로 값이 바뀔 수 있으므로 값이 문서에 박히는 P05·P07보다 앞에 둔다.
- P04(로비)는 샷건과 코드가 겹치지 않아 어느 자리에 둬도 된다. 샷건 수치가 확정(P03)된 뒤에 가이드·튜토리얼·문서를 만지려는 순서를 지키기 위해 P03 뒤에 두었다.
- P05→P06: 튜토리얼 안내가 가이드 카드의 "한 줄 요약"(`src/shared/guideText.ts`)을 재사용하므로 P05가 먼저다.
- P07은 모든 화면이 완성된 뒤 마지막.

## 범위 밖 (확정, 이번에 하지 않는다)
- 리볼버·게틀링 수치 변경, 무기별 전체 튜토리얼(무기 선택 방식), 시작하기 탭, 가이드 이미지 삽입, 보스 기절.
- `docs/beer-crusher-presentation-standalone.html`(발표용 단독 HTML)의 샷건 문구: 이번 계획에서 수정하지 않는다.
