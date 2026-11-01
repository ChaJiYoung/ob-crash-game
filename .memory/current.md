# Current Context

## Active Plan
[비어 크러셔 (Beer Crusher) 3D 모션 슈팅 게임 구현](./plans/2026-11-01-beer-crusher.md)

## Active Phase
[P04 스마트폰 권총 그립(+Y 총구·화면 좌측) 센서 및 85:15 통합 터치 컨트롤러 레이어](./phases/2026-11-01-beer-crusher/P04-mobile-gun-grip-controller/phase.md)

## Active Task
[T01 휴대폰 deviceId 발급, 권총 그립(+Y 총구·+X 상단 스냅) 3D 쿼터니언 센서 및 85% 통합 터치패드 제스처 머신 구현](./phases/2026-11-01-beer-crusher/P04-mobile-gun-grip-controller/T01-gun-grip-quaternion-and-touch-sensors.md)

## Status
- P03 완료, P04-T01 구현 시작 준비 완료

## Next Step (IMPORTANT)
T01 청사진을 읽고 `src/controller/sensors/DeviceIdentity.ts`, `src/controller/sensors/GunGripTracker.ts`, `src/controller/sensors/UnifiedTouchPad.ts`, `src/controller/sensors/HapticFeedback.ts`, `tests/controller-sensors.test.ts` 구현 시작
