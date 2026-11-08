# Current Context

## Active Plan
[폰 화면 꺼짐 후 조준 고정 수정](./plans/2026-11-08-controller-sensor-revive-after-screen-off.md)

## Active Phase
[P02 실기기 검증과 정리](./phases/2026-11-08-controller-sensor-revive-after-screen-off/P02-device-verify/phase.md)

## Active Task
[T02 실기기 테스트와 로그 분석](./phases/2026-11-08-controller-sensor-revive-after-screen-off/P02-device-verify/T02-device-test-and-analysis.md)

## Status
- P01 전체 완료 (T01~T05): tsc·vitest(704) 통과.
- P02-T01 완료: 임시 로그 릴레이(`TEMP(sensor-debug)`) 추가.
- P02-T02 대기: 사용자의 서버 재시작과 실기기 테스트가 필요하다.
- 직전 계획 `main 병합`은 전체 완료, 육안 확인만 대기. 그 이전 계획(2인팟 QA 수정)은 P04(3차 QA)가 리뷰어 진행 중으로 남아 있다.

## Next Step (IMPORTANT)
사용자가 `npm run server`를 재시작하고 T02 시나리오 A~D를 테스트한 뒤 결과를 알려주면, `data/sensor-debug.log`를 읽고 분석 기준에 따라 `.memory/references/2026-11-08-sensor-revive-device-log.md`를 작성한다.
이후 T03에서 `TEMP(sensor-debug)` 코드를 제거하고 `SENSOR_STALE_MS`를 확정한다.
