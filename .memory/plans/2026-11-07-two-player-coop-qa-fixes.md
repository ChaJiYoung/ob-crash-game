# Plan: 2인팟 QA 수정

## Goal
2인팟 구현([2026-11-07-two-player-coop](./2026-11-07-two-player-coop.md))을 실제 브라우저로 확인한 QA에서 나온 문제를 고치고 다시 QA로 확인한다.

- QA 보고서: `.memory/references/two-player-coop-qa/{A-solo,B-mouse-phone,C-phone-phone}/report.md`
- 체크리스트: [two-player-coop-qa-checklist.md](../references/two-player-coop-qa-checklist.md)

### 고칠 문제
| # | 문제 | 출처 | 심각도 |
| :--- | :--- | :--- | :--- |
| 1 | 사격·연사·피버 자동 연사 때 `TypeError: Illegal invocation`. `PlayerActionProcessor`가 브라우저 내장 `setInterval`을 자기 메서드처럼(`this.setIntervalFn(...)`) 불러 `this`가 어긋남. 누른 채 연사·피버 자동 연사 타이머가 만들어지지 않음(1인·2인 전부) | QA A·B·C 공통 | 치명 |
| 2 | 2인 판 3D 총구가 십자선을 겨누지 않음. 총이 "조준값 × 고정 비율"로만 돌고 좌우로 옮긴 총에 고정 안쪽 보정(`GUN_YAW_COMP`)을 더해 늘 화면 가운데 쪽을 봄 | 사용자 확인(`B-10-guns-3d.png`). QA-B는 PASS로 잘못 판정 | 높음 |
| 3 | 마우스 이동이 마우스가 묶인 플레이어와 상관없이 1P 총(0번)을 직접 움직임(`GameCanvas3D` 마우스 핸들러). 조준 경로가 둘(처리부 `onAim`, 캔버스 직접 쓰기)이고 안 쓰는 옛 조준 함수(`PCGamePage.updateAimDirect`)가 남아 있음 | 코드 리뷰 | 높음 |
| 4 | 로비 모달이 1440×900에서 아래쪽이 잘림(마지막 안내 문구) | 캡처 `two-player-coop-screens/01-lobby-empty.png` | 낮음 |
| 5 | 가끔 실패하는 테스트 1개(640개 중, 재실행하면 통과) | 전체 테스트 실행 | 낮음 |

### 지킬 원칙
- 원 계획의 설계 원칙(D24·D25·D26) 그대로: 1인·2인은 값만 다르고 코드는 하나, 장치 차이는 어댑터 안, 조준은 처리부 한 경로.
- 계층 방향: `src/pc/components/**`(React) → `src/pc/three/**`(3D) → 순수 함수. 3D 모듈은 React 컴포넌트 파일을 import하지 않는다. 순수 좌표 변환은 React·three 어느 쪽에도 속하지 않는 파일에 둔다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 수정 5건(타이머 바인딩, 조준 좌표 모듈 분리와 총구 조준 계산, 조준 경로 하나로, 로비 모달 맞춤, 불안정 테스트) | [P01](../phases/2026-11-07-two-player-coop-qa-fixes/P01-fixes/phase.md) |
| P02 | `done` | 체크리스트 보강(총구 조준 정량 확인 등) 후 QA 3개 재실행·결과 리뷰 | [P02](../phases/2026-11-07-two-player-coop-qa-fixes/P02-requa/phase.md) |
| P03 | `pending` | 2차 QA 확정 버그 6건(슬롯 이동, 카드 몸체 판정, 결과 화면 겹침, 작은 화면 배지, 개틀링 링 경고, 시작 순서) | [P03](../phases/2026-11-07-two-player-coop-qa-fixes/P03-fixes-r2/phase.md) |
| P04 | `pending` | 3차 QA 단독 실행(폰 입력 재측정, P03 확인, 풀플레이, C 미완 항목) | [P04](../phases/2026-11-07-two-player-coop-qa-fixes/P04-requa-r3/phase.md) |
