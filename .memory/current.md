# Current Context

## Active Plan
[미지원 폰 차단 + 센서 테스트장 숨기기 + 피버·탄창·조준 수정](./plans/2026-11-08-unsupported-phone-block.md)

## Active Phase
[P04 실기기 검증](./phases/2026-11-08-unsupported-phone-block/P04-real-device-verify/phase.md)

## Active Task
[없음 (계획 전체 완료, 실기기 확인 대기)](./phases/2026-11-08-unsupported-phone-block/P04-real-device-verify/T01-verify-and-build.md)

## Status
- P04-T01 완료(`0026864`): 운영 빌드·개발 서버·폰 흉내 웹소켓으로 체크리스트 자동 확인(13개 통과). **계획 전체 구현 완료.** 실기기에서만 확인 가능한 항목(A·B·C·I·K·P, G의 1분 관찰)이 남아 있다: 특히 C(보급형 폰이 실제로 차단되는지)가 판별 규칙의 핵심 가정을 검증한다. tsc·vitest(826)·build 통과.
- P03-T03 완료(`1a8968a`): 별도 장전 링 제거, 탄창 호가 장전 중 하늘색으로 차오름, 피버 호가 붉은색으로 줄어듦, 하단 패널 장전 막대, 튜토리얼·샌드박스 십자선에 호 표시. P02 리뷰 반영(`e1dafc4`). P03 전체 완료, 서브에이전트 리뷰 진행 중. tsc·vitest(825)·build 통과.
- P03-T02 완료(`6639643`): 피버가 탄창을 채우지 않음(`refillAmmoOnFever`·`update()` 피버 분기 삭제), 피버 중 장전 계속 진행, 스킬 독립 테스트. tsc·vitest(813) 통과. P02 리뷰 중간 1건(차단 후 재연결 경로)은 별도 수정 커밋 예정.
- P03-T01 완료(`af3a087`): `getMouseBinding`의 1인 보조 분기 삭제(마우스로 참여한 슬롯만 마우스가 조종), 센서 테스트장 안내 문구 변경. tsc·vitest(804) 통과.
- P02-T04 완료(`a3f99d6`): 폰 차단 화면 `UnsupportedDeviceScreen`, 게이트 "센서 확인 중...", 권한 허용 뒤 `probeSensorSupport`(개발 모드는 건너뜀), README 안내. P02 전체 완료, 서브에이전트 리뷰 진행 중. tsc·vitest(801)·build 통과.
- P02-T03 완료(`e9e5881`): `applyControllerUnsupported`, `PCGamePage`의 `CONTROLLER_UNSUPPORTED` 수신(로비에서만 슬롯 비움)과 QR 모달 빨간 안내 칩(6초). tsc·vitest(794) 통과.
- P02-T02 완료(`ae794a2`): `DEVICE_UNSUPPORTED`/`CONTROLLER_UNSUPPORTED` 메시지와 서버 핸들러(좌석 소켓+deviceId 일치 확인, 이후 `close` 핸들러가 DISCONNECTED 전송). tsc·vitest(789) 통과.
- P02-T01 완료(`e2e5711`): 센서 판별 코어 `SensorSupportProbe.ts`(`decideSensorSupport`·`probeSensorSupport`), `SENSOR_PROBE_MS`, `UnsupportedReason`. P01 서브에이전트 리뷰 통과(`607bcf8`에 낮음 1건 반영). tsc·vitest(782) 통과.
- P01-T01 완료(`ff3642c`): 테스트장/랩 버튼 3곳 제거, `/sensor-test` 오버레이에 "센서 랩" 버튼, `mergeSensorFrameMetrics`로 모달 흔들림 수정. tsc·vitest(768) 통과. P01 서브에이전트 리뷰 진행 중.
- 실행 순서: P02(T01~T04) → P03(T01~T03) → P04(T01). 병렬 금지, 한 Task씩 커밋. Phase가 끝날 때마다 서브에이전트 리뷰.
- 주의: 실기기 검증(P04)은 `npm run dev`가 아니라 운영 빌드(`npm run build && npm run preview`)로 해야 한다. 개발 모드는 폰 판별을 건너뛴다.

## Next Step (IMPORTANT)
없음(구현 완료). 사용자가 실기기(운영 빌드: `npm run build && npm run preview`)로 P04-T01 체크리스트 A·B·C·I·K·P를 확인하고, 판별 규칙이 어긋나면 `/edu-grill-me`로 기준을 다시 정한다.
