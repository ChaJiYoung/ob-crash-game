# Plan: 무기 공격력 서열 재정의와 가이드 레이더 차트

결정 문서: [2026-11-10-weapon-power-order-and-radar](../decisions/2026-11-10-weapon-power-order-and-radar.md) (D01~D08)

## Goal
한 발 피해(관통·산탄 포함 최선의 경우) 기준으로 리볼버 > 샷건 > 개틀링이 되도록 수치를 고치고, 가이드에 5축 레이더 차트를 둔다. 측정 가능한 결과: 샷건 한 발 합계 1.00/1.03/1.07/1.12, 리볼버 관통 비율 0.5/0.5/0.6/0.7, 판정 허용 배율 세 무기 모두 1.0, 레이더 Lv.4 축 최댓값 100.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done ✅` | 게임 수치 변경(샷건·리볼버·판정) + 기존 테스트 정정 | [P01](../phases/2026-11-10-weapon-power-order-and-radar/P01-balance-values/phase.md) |
| P02 | `done ✅` | 가이드 막대·성능 문구·레이더 차트를 새 기준으로 재작성 | [P02](../phases/2026-11-10-weapon-power-order-and-radar/P02-guide-radar/phase.md) |
| P03 | `done ✅` | 봇 시뮬레이션 재측정 + 수치 변경 문서 갱신 | [P03](../phases/2026-11-10-weapon-power-order-and-radar/P03-verify-and-docs/phase.md) |
