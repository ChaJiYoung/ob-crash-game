# Current Context

## Active Plan
[폰 화면 꺼짐 후 조준 고정 수정](./plans/2026-11-08-controller-sensor-revive-after-screen-off.md)

## Active Phase
[P01 센서 복구 코드 수정](./phases/2026-11-08-controller-sensor-revive-after-screen-off/P01-sensor-revive/phase.md)

## Active Task
[T01 autoZeroFromLatest 원시값 기준 수정](./phases/2026-11-08-controller-sensor-revive-after-screen-off/P01-sensor-revive/T01-auto-zero-raw.md)

## Status
- 계획 수립 완료 (P01 5 Task, P02 3 Task). T01 구현 시작 준비 완료.
- 범위 확장(D08, D09): P01에 T04(조준 잠금 자동 만료), T05(`__setStep` 제거) 추가.
- 직전 계획 `main 병합`은 전체 완료, 육안 확인(피버 배너, 폰 문구, 협동 보스 체감)만 대기 중.
- 그 이전 계획(2인팟 QA 수정)은 P04(3차 QA)가 리뷰어 진행 중으로 남아 있다.

## Next Step (IMPORTANT)
T01 청사진을 읽고 `src/pc/input/PhoneAdapter.ts`의 `autoZeroFromLatest` 수정과 `tests/input-adapters.test.ts` 테스트 추가를 시작한다.
P02-T02는 사용자의 실기기 테스트가 필요하므로, 거기서 멈추고 사용자에게 테스트를 요청한다.
