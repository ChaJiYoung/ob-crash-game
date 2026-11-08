# Current Context

## Active Plan
[플레이 테스트 피드백](./plans/2026-11-08-playtest-feedback.md)

## Active Phase
[P02 플레이 감각](./phases/2026-11-08-playtest-feedback/P02-play-feel/phase.md)

## Active Task
[T01 로비에서 마우스 십자선 표시](./phases/2026-11-08-playtest-feedback/P02-play-feel/T01-lobby-mouse-crosshair.md)

## Status
- P01-T01 완료(`7017d38`): 입력 방식·파트너 무기·카드 선택 기록 저장, 랭킹·결과 화면 표시. tsc·vitest(748)·build 통과.
- 2인팟 결정 문서 D10·D35에 배율 변경 내역(`f8e2669`, D41)을 기록했다. 카드 배율은 시뮬레이션 결과 2배 유지(D07-1). 재조정은 cardPicks 기록이 쌓인 뒤 판단.
- 이전 계획 [폰 컨트롤러 수명주기 수정](./plans/2026-11-08-phone-lifecycle-fixes.md) 전체 완료(실기기 A~F 통과, 임시 진단 코드 제거).

## Next Step (IMPORTANT)
P02-T01: `GameCanvas3D.tsx`의 mousemove를 window로 옮기고 `PCGamePage.tsx` 로비 십자선 조건을 `isSlotReady` 기준으로 바꾼다.
