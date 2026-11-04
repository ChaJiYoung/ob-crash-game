# Plan: Gameplay Polish and Performance Optimization

## Goal
화면 번쩍임과 1~2초 멈춤을 없애고, 어떤 무기를 골라도 비슷한 확률로 아슬아슬하게 깨지는 7웨이브 보스 러시로 게임을 재구성한다.

측정 가능한 완료 기준은 결정 문서 D14를 따른다.
- 실제 플레이 중 `linkProgram` 0회, 처치 시 텍스처 업로드 0회, 일반 전투 프레임 p95가 모니터 주사율 안에 들어온다.
- 보통 봇 클리어율이 세 무기 모두 약 70~85%이고, 화면 전체를 훑는 연타로는 거의 깰 수 없다.
- 폰 자이로와 마우스로 직접 플레이해 수치를 최종 조정한다.

근거 문서: [결정 문서](../decisions/2026-11-04-gameplay-polish-and-perf-optimization.md)

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 번쩍임·멈춤·상시 저하 해결 후 성능 재측정 | [P01](../phases/2026-11-04-gameplay-polish-and-perf-optimization/P01-render-and-stutter/phase.md) |
| P02 | `pending` | 바닥선, 요격 폭발, 카드 선택 중 오발 방지와 전체 정지 | [P02](../phases/2026-11-04-gameplay-polish-and-perf-optimization/P02-stage-and-input/phase.md) |
| P03 | `pending` | 난이도 상수 통합, 게이지, 연사·장전·판정 규칙, 카드 9종 | [P03](../phases/2026-11-04-gameplay-polish-and-perf-optimization/P03-balance-and-cards/phase.md) |
| P04 | `pending` | 7웨이브, 몬스터 5종 특색, 미니웨이브 후 보스, 냉각기·대왕 패턴, 수치 재조정 | [P04](../phases/2026-11-04-gameplay-polish-and-perf-optimization/P04-waves-and-bosses/phase.md) |
| P05 | `pending` | 스크립트·안내·문서 갱신, 랭킹 초기화, 직접 플레이 검증, 스크린샷 재촬영 | [P05](../phases/2026-11-04-gameplay-polish-and-perf-optimization/P05-docs-and-verification/phase.md) |
