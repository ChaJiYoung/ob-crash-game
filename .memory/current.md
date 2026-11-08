# Current Context

## Active Plan
[폰 컨트롤러 수명주기 수정](./plans/2026-11-08-phone-lifecycle-fixes.md)

## Active Phase
[P05 실기기 검증과 정리](./phases/2026-11-08-phone-lifecycle-fixes/P05-verify-and-cleanup/phase.md)

## Active Task
[T01 실기기 통합 테스트와 로그 분석](./phases/2026-11-08-phone-lifecycle-fixes/P05-verify-and-cleanup/T01-device-test-and-analysis.md)

## Status
- P04 완료(복귀 버튼 전환): 서버 `3e9e178`, 폰 버튼은 이번 커밋. tsc·vitest(738)·build 통과.
- 실기기 테스트 결과 자동 복귀를 버튼 방식으로 바꾸기로 결정(`decisions/2026-11-08-return-button.md`). P04(복귀 버튼 전환) 추가, 실기기 검증은 P05로 이동.
- 추가 커밋: `4514bc2`(리뷰 반영), `a7b5e09`(서버 판정 로그, 임시), `b5ae0a9`(PC 자동 재연결).
- P01 완료(서버 프레임 끊김 감지, 백그라운드/포그라운드 신호, PC 중복 방어): `f894283`.
- P02 완료(폰 화면 꺼짐/복귀 신호, 허용 직후 자동 영점): `a855c6a`.
- P03 완료(`tsx watch`, `ZeroingGuide` 제거, README): tsc·vitest(731)·build 통과.
- 진행 방식: 사용자 요청으로 Phase 단위 커밋, 사용자 테스트 Phase 제외하고 구현 후 코드 리뷰.
- 통합된 작업: 백그라운드 일시정지, 센서 권한 허용 직후 자동 영점, 개발 서버 `tsx watch` 전환과 폰 `ZeroingGuide` 죽은 코드 정리(P03), 센서 복구 마무리(실기기 검증·정리, P05).
- 이전 계획 `controller-sensor-revive-after-screen-off`: P01 5 Task와 P02-T01 완료. 남은 P02-T02·T03은 이 계획의 P05로 이전(`superseded`).
- 임시 진단 코드(`TEMP(sensor-debug)`)는 P04-T02까지 남아 있다.
- 그 이전 계획: `main 병합`은 전체 완료(육안 확인만 대기), 2인팟 QA 수정은 P04(3차 QA)가 리뷰어 진행 중.

## Next Step (IMPORTANT)
P05-T01: 사용자에게 PC·폰 새로고침 후 실기기 테스트를 요청한다(화면 끄기 → 돌아가기 버튼 → 재개와 조준, 페이지 재로드 → 초록 버튼 → 재개). 결과와 `data/sensor-debug.log`로 분석한다.
