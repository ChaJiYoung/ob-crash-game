# Current Context

## Active Plan
[컨트롤러 연결 유지 + 일시정지 메뉴](./plans/2026-11-06-controller-persistence-and-pause.md)

## Active Phase
[P01 연결 유지](./phases/2026-11-06-controller-persistence-and-pause/P01-connection-persistence/phase.md)

## Active Task
[T03 재연결 뒤 PC 화면 동기화](./phases/2026-11-06-controller-persistence-and-pause/P01-connection-persistence/T03-resume-sync.md)

## Status
- P01-T01, T02 완료. T03 구현 시작 준비 완료

## Paused Plan
- `2026-11-04-gameplay-polish-and-perf-optimization` P05-T04·T05: 그대로 남는다.
- `2026-11-06-low-level-bonus-and-stage-cleanup`: 사후 기록 계획, 열린 Task 없음.

## Next Step (IMPORTANT)
T03 청사진을 읽고 `src/shared/types.ts`에 `resume` 필드 추가부터 시작
