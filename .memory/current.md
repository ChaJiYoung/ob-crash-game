# Current Context

## Active Plan
[미지원 폰 차단 + 센서 테스트장 숨기기 + 피버·탄창·조준 수정](./plans/2026-11-08-unsupported-phone-block.md)

## Active Phase
[P02 미지원 폰 차단](./phases/2026-11-08-unsupported-phone-block/P02-unsupported-phone-block/phase.md)

## Active Task
[T01 센서 판별 코어](./phases/2026-11-08-unsupported-phone-block/P02-unsupported-phone-block/T01-sensor-probe-core.md)

## Status
- P01-T01 완료(`ff3642c`): 테스트장/랩 버튼 3곳 제거, `/sensor-test` 오버레이에 "센서 랩" 버튼, `mergeSensorFrameMetrics`로 모달 흔들림 수정. tsc·vitest(768) 통과. P01 서브에이전트 리뷰 진행 중.
- 실행 순서: P02(T01~T04) → P03(T01~T03) → P04(T01). 병렬 금지, 한 Task씩 커밋. Phase가 끝날 때마다 서브에이전트 리뷰.
- 주의: 실기기 검증(P04)은 `npm run dev`가 아니라 운영 빌드(`npm run build && npm run preview`)로 해야 한다. 개발 모드는 폰 판별을 건너뛴다.

## Next Step (IMPORTANT)
P02-T01 청사진을 읽고 `src/controller/sensors/SensorSupportProbe.ts` 신규 작성부터 시작
