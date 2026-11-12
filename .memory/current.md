# Current Context

## Active Plan
[찰랑 몬스터 (Chalang Submerge Monster)](./plans/2026-11-12-chalang-monster.md)

## Active Phase
[P03 시각·에셋](./phases/2026-11-12-chalang-monster/P03-visuals-and-asset/phase.md)

## Active Task
[T05 물속 시각 상태](./phases/2026-11-12-chalang-monster/P03-visuals-and-asset/T05-submerged-visual-state.md)

## Status
- T04 완료: 찰랑 라벨(`chalang.jpg`), 3D 모델(몸통·눈·병·라벨·링), 출처 기록. 모델 구조 테스트 포함.

## Next Step (IMPORTANT)
T05 청사진을 읽고 `updateTargetAnimation3D`에 `isSubmerged` 옵션 추가, `GameCanvas3D`에서 `engine.isTargetSubmerged` 전달, 체력 바 필터 확인