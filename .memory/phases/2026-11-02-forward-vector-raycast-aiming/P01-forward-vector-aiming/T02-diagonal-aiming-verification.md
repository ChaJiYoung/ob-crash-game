# Task: T02 대각선(좌상단/우상단/좌하단/우하단) 4분면 조준 짐벌락 방지 및 회귀 검증 테스트

## Status: done

## Goal
`tests/controller-sensors.test.ts`에 4대 사분면(좌상단, 우상단, 좌하단, 우하단) 대각선 조준 시 부호가 뒤집히거나 짐벌락으로 축이 튀지 않고 정확한 사분면 좌표에 안착하는지 확인하는 전용 유닛 테스트를 추가하고, 전체 40여 개 테스트 스위트 및 프로덕션 빌드 무결성을 최종 검증한다.

## Decision Summary
- [D01](../../decisions/2026-11-02-forward-vector-raycast-aiming.md): 3D 단위 벡터 기반 조준으로 대각선 짐벌락 제거 검증.
- [D02](../../decisions/2026-11-02-forward-vector-raycast-aiming.md): 권총 파지세 및 리모컨 파지세 모두에서 가상 스크린 평면 투영의 안정성 보장.

## Implementation

### I01. 4분면 대각선 조준 짐벌락 방지 유닛 테스트 추가

- Related Files:
  - `tests/controller-sensors.test.ts` :: `GunGripTracker & UnifiedTouchPadController` — 대각선 조준 부호 안정성 테스트 케이스 추가; modify

#### Details
- **Test Cases**:
  1. 권총 파지세(`alpha: 180, beta: 0, gamma: -85` 또는 `beta: 20`) 영점 후:
     - 좌상단 조준: `yawDeg < 0` (aimX < 0), `pitchDeg > 0` (aimY > 0)
     - 우상단 조준: `yawDeg > 0` (aimX > 0), `pitchDeg > 0` (aimY > 0)
     - 좌하단 조준: `yawDeg < 0` (aimX < 0), `pitchDeg < 0` (aimY < 0)
     - 우하단 조준: `yawDeg > 0` (aimX > 0), `pitchDeg < 0` (aimY < 0)
  2. 일반 리모컨/수평 파지세(`alpha: 0, beta: 45, gamma: 0`) 영점 후:
     - 동일하게 4개 사분면으로 총구를 회전시켰을 때 aimX와 aimY의 부호가 100% 의도대로 매핑되는지 검증.
  3. 사용자가 겪었던 버그(좌상단으로 향할 때 우상단으로 튀어버리는 현상)가 발생하지 않음을 명시적 assertion으로 확인:
     `expect(topLeftAim.aimX).toBeLessThan(-0.1);`
     `expect(topLeftAim.aimY).toBeGreaterThan(0.1);`

### I02. 전체 프로젝트 통합 회귀 검증

- Related Files:
  - `src/` 전체
  - `tests/` 전체

#### Details
- `npx vitest run`을 통해 3D 캔버스, 총기 모델, 피버 시스템, 몬스터 피격 판정 등 기존 44개 테스트가 모두 100% 정상 통과하는지 확인.
- `npm run build`로 타입스크립트 컴파일 및 번들링 에러 없음 확인.

## Acceptance Criteria
- [ ] 대각선 4분면 조준 테스트가 추가되어 vitest 통과.
- [ ] 권총 및 리모컨 파지 상태 모두에서 좌상단 조준 시 `aimX < 0` 및 `aimY > 0`이 엄격히 보장됨.
- [ ] 전체 유닛 테스트 및 `npm run build` 에러 없이 완료.

## Validation
- `npx vitest run tests/controller-sensors.test.ts` — 대각선 테스트 포함 전체 통과
- `npx vitest run` — 전체 프로젝트 테스트 통과
- `npm run build` — 빌드 성공

## Commit Message
```text
test(controller): add diagonal aiming tests and verify gimbal lock elimination

Plan: 2026-11-02-forward-vector-raycast-aiming
Phase: P01-forward-vector-aiming
Task: T02-diagonal-aiming-verification

- Add unit test for all 4 quadrants (top-left, top-right, bottom-left, bottom-right)
- Verify gimbal lock elimination in both gun-grip and remote-grip orientations
- Run full regression test suite and production build
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
