# Current Context

## Active Plan
[폰 컨트롤러 수명주기 수정](./plans/2026-11-08-phone-lifecycle-fixes.md)

## Active Phase
[P02 폰 컨트롤러 수정](./phases/2026-11-08-phone-lifecycle-fixes/P02-phone-controller/phase.md)

## Active Task
[T01 폰 화면 꺼짐/복귀 신호와 복귀 재연결 절차](./phases/2026-11-08-phone-lifecycle-fixes/P02-phone-controller/T01-phone-background-signals.md)

## Status
- P01 완료(서버 프레임 끊김 감지, 백그라운드/포그라운드 신호, PC 중복 방어): tsc·vitest(724) 통과.
- 진행 방식: 사용자 요청으로 Phase 단위 커밋, P04(사용자 테스트) 제외하고 P03까지 구현 후 코드 리뷰.
- 통합된 작업: 백그라운드 일시정지, 센서 권한 허용 직후 자동 영점, 개발 서버 `tsx watch` 전환과 폰 `ZeroingGuide` 죽은 코드 정리(P03), 센서 복구 마무리(실기기 검증·정리, P04).
- 이전 계획 `controller-sensor-revive-after-screen-off`: P01 5 Task와 P02-T01 완료. 남은 P02-T02·T03은 이 계획의 P04로 이전(`superseded`).
- 임시 진단 코드(`TEMP(sensor-debug)`)는 P04-T02까지 남아 있다.
- 그 이전 계획: `main 병합`은 전체 완료(육안 확인만 대기), 2인팟 QA 수정은 P04(3차 QA)가 리뷰어 진행 중.

## Next Step (IMPORTANT)
P02-T01 청사진을 읽고 `src/controller/MobileControllerPage.tsx`에 화면 꺼짐/복귀 신호를 구현한다.
P04-T01(실기기 테스트)은 사용자의 서버 재시작과 폰 테스트가 필요하므로, 거기서 멈추고 사용자에게 요청한다.
