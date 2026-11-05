# Current Context

## Active Plan
[컨트롤러 연결 유지 + 일시정지 메뉴](./plans/2026-11-06-controller-persistence-and-pause.md)

## Active Phase
[P02 일시정지 메뉴](./phases/2026-11-06-controller-persistence-and-pause/P02-pause-menu/phase.md)

## Active Task
[T02 폰 끊김 자동 일시정지](./phases/2026-11-06-controller-persistence-and-pause/P02-pause-menu/T02-auto-pause-on-disconnect.md)

## Status
- P01, P02-T01 완료. P02-T02 구현 시작 준비 완료

## Paused Plan
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05: 그대로 남는다.
- `2026-11-06-low-level-bonus-and-stage-cleanup`: 사후 기록 계획, 열린 Task 없음.

## Next Step (IMPORTANT)
T02 청사진을 읽고 `src/pc/PCGamePage.tsx`의 `CONTROLLER_DISCONNECTED` 처리부터 시작
