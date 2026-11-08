# Current Context

## Active Plan
[플레이 테스트 피드백](./plans/2026-11-08-playtest-feedback.md)

## Active Phase
[P01 기록과 랭킹 표시](./phases/2026-11-08-playtest-feedback/P01-records-and-ranking/phase.md)

## Active Task
[T01 입력 방식·카드 선택 기록 저장과 랭킹·결과 화면 표시](./phases/2026-11-08-playtest-feedback/P01-records-and-ranking/T01-input-kind-in-records.md)

## Status
- T01 구현 시작 준비 완료
- 2인팟 결정 문서 D10·D35에 배율 변경 내역(`f8e2669`, D41)을 기록했다. 카드 배율은 시뮬레이션 결과 2배 유지(D07-1). 재조정은 cardPicks 기록이 쌓인 뒤 판단.
- 보류 중인 이전 계획: [폰 컨트롤러 수명주기 수정](./plans/2026-11-08-phone-lifecycle-fixes.md) P05-T02(임시 진단 코드 제거·임계값 확정). P05-T01 실기기 시나리오 A~F 모두 통과(사용자 확인). 임시 진단 코드 `TEMP(sensor-debug)`가 아직 남아 있다.

## Next Step (IMPORTANT)
T01 청사진을 읽고 `src/shared/types.ts`에 `InputKind`, `CardPickRecord`와 선택 필드부터 추가한다.
