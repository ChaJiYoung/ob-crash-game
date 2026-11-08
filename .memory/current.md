# Current Context

## Active Plan
[미지원 폰 차단 + 센서 테스트장 숨기기 + 피버·탄창·조준 수정](./plans/2026-11-08-unsupported-phone-block.md)

## Active Phase
[P02 미지원 폰 차단](./phases/2026-11-08-unsupported-phone-block/P02-unsupported-phone-block/phase.md)

## Active Task
[T04 폰 차단 화면 연결](./phases/2026-11-08-unsupported-phone-block/P02-unsupported-phone-block/T04-phone-block-screen.md)

## Status
- P02-T03 완료(`e9e5881`): `applyControllerUnsupported`, `PCGamePage`의 `CONTROLLER_UNSUPPORTED` 수신(로비에서만 슬롯 비움)과 QR 모달 빨간 안내 칩(6초). tsc·vitest(794) 통과.
- P02-T02 완료(`ae794a2`): `DEVICE_UNSUPPORTED`/`CONTROLLER_UNSUPPORTED` 메시지와 서버 핸들러(좌석 소켓+deviceId 일치 확인, 이후 `close` 핸들러가 DISCONNECTED 전송). tsc·vitest(789) 통과.
- P02-T01 완료(`e2e5711`): 센서 판별 코어 `SensorSupportProbe.ts`(`decideSensorSupport`·`probeSensorSupport`), `SENSOR_PROBE_MS`, `UnsupportedReason`. P01 서브에이전트 리뷰 통과(`607bcf8`에 낮음 1건 반영). tsc·vitest(782) 통과.
- P01-T01 완료(`ff3642c`): 테스트장/랩 버튼 3곳 제거, `/sensor-test` 오버레이에 "센서 랩" 버튼, `mergeSensorFrameMetrics`로 모달 흔들림 수정. tsc·vitest(768) 통과. P01 서브에이전트 리뷰 진행 중.
- 실행 순서: P02(T01~T04) → P03(T01~T03) → P04(T01). 병렬 금지, 한 Task씩 커밋. Phase가 끝날 때마다 서브에이전트 리뷰.
- 주의: 실기기 검증(P04)은 `npm run dev`가 아니라 운영 빌드(`npm run build && npm run preview`)로 해야 한다. 개발 모드는 폰 판별을 건너뛴다.

## Next Step (IMPORTANT)
P02-T04 청사진을 읽고 `src/controller/components/UnsupportedDeviceScreen.tsx` 신규 작성 후 `LoginAndPermissionGate.tsx`·`MobileControllerPage.tsx` 연결
