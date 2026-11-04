# Task: T03 모바일 컨트롤러 프리셋 토글 연동 및 종합 센서 안정화 E2E 테스트 작성

## Status: done


## Goal
모바일 컨트롤러 단독 사용 시에도 즉시 안정화 모드를 켤 수 있도록 모바일 패드에 원터치 안정화 토글을 추가하고, PC와 모바일 간의 설정 동기화 메시지(`SENSOR_CONFIG_UPDATE`)를 처리하며, 가상 자이로 노이즈 주입 및 고속 스냅 사격을 포함한 종합 센서 안정화 E2E 테스트 스위트(`tests/mobile-sensor-stabilizer.test.ts`)를 작성하여 전체 안정성을 검증한다.

## Decision Summary
- [D01] 모바일과 PC 양방향 실시간 필터 파라미터 동기화.
- [D04] 모바일 컨트롤러 단독 실행 시에도 영점 화면과 패드에서 '안정화 모드' 원터치 토글 지원.

## Implementation

### I01. 모바일 컨트롤러 UI에 안정화 프리셋 토글 추가

- Related Files:
  - `src/controller/components/GunGripPad.tsx` :: 상단 영점 버튼 우측에 `[🛡️ 안정화: ON/OFF]` 미니 토글 버튼 추가; modify
  - `src/controller/MobileControllerPage.tsx` :: `SENSOR_CONFIG_UPDATE` 수신 핸들러 추가 및 tracker 동기화; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // GunGripPadProps 확장
  export interface GunGripPadProps {
    // ... 기존 props 유지
    isStabilizedMode?: boolean;
    onToggleStabilizedMode?: () => void;
  }
  ```
- **Execution Flow / Logic**:
  1. `GunGripPad.tsx` 상단 15% 영역에서:
     - 좌측 70%: `🎯 정면 영점 맞추기 (모니터 겨누고 탭)` 버튼
     - 우측 30%: `[🛡️ 안정화]` 토글 버튼 (활성화 시 에메랄드 그린, 비활성화 시 그레이)
     - 토글 시 `tracker.applyPreset(isStabilized ? 'balanced' : 'stabilized')` 호출 및 햅틱 진동 피드백 발동.
  2. `MobileControllerPage.tsx` 웹소켓 수신부:
     - `case 'SENSOR_CONFIG_UPDATE':`
     - 메시지 페이로드의 `minCutoff`, `beta`, `deadzone`, `sensitivityX`, `sensitivityY`를 `tracker.setFilterConfig(...)` 및 `tracker.setCalibrationConfig(...)`에 즉시 반영.

### I02. 종합 센서 안정화 및 가상 자이로 노이즈 시뮬레이션 E2E 테스트

- Related Files:
  - `tests/mobile-sensor-stabilizer.test.ts` :: `MobileSensorStabilizer E2E Suite` — 노이즈 감쇄, 스냅 반응, 설정 동기화 E2E 검증; new

#### Details
- **Test Scenarios**:
  1. **가상 자이로 지터 노이즈 억제율 검증 (Galaxy A15 시뮬레이션)**:
     - 가만히 있는 상태에서 지자기 센서 전자기 노이즈(주파수 30Hz, 진폭 `±0.025`)를 100샘플 주입.
     - 필터링 전 `rawAimX`의 분산(Variance)과 필터링 후 `aimX`의 분산을 비교하여 **노이즈가 90% 이상 억제**되는지 정량 검증.
  2. **조준선 정지 데드존(Deadzone) 완벽 정지 검증**:
     - 데드존 범위(`±0.012`) 이내의 불규칙한 센서 방위각 흔들림에 대해 조준 좌표가 1픽셀도 움직이지 않고(변화량 0.0) 정확히 고정되는지 검증.
  3. **고속 스냅 사격 시 응답성(Responsiveness) 검증**:
     - 정지 상태에서 순간적으로 각도 20도 급선회(스냅 조준) 시, 컷오프 주파수가 즉각 상승하여 2~3프레임 이내에 목표 좌표에 지연 없이 도달하는지 확인.
  4. **PC-모바일 양방향 파이프라인 동기화 검증**:
     - PC에서 프리셋을 변경했을 때 모바일의 `GunGripTracker` 설정이 즉시 동기화되어 다음 샘플부터 새 파라미터로 계산되는지 검증.
  5. **로컬 스토리지 보관 및 복원 검증**:
     - 저장된 튜닝 설정이 페이지 리로드 시 기본값 대신 정상 복원되는지 검증.

## Acceptance Criteria
- [ ] 모바일 패드 상단에 원터치 안정화 토글이 렌더링되고 작동함.
- [ ] PC에서 보낸 설정 변경이 모바일 트래커에 0ms 지연으로 실시간 동기화됨.
- [ ] 가상 자이로 노이즈 시뮬레이션에서 지터가 90% 이상 억제됨.
- [ ] 데드존 범위 내에서 조준선이 완벽히 정지함.
- [ ] `tests/mobile-sensor-stabilizer.test.ts` 테스트가 100% 통과함.
- [ ] 전체 테스트 스위트(`npm test`)가 깨짐 없이 전부 통과함.

## Validation
- `npx vitest run tests/mobile-sensor-stabilizer.test.ts` — 5개 이상 테스트 ALL PASS
- `npm test` — 전체 87개 이상 테스트 ALL PASS

## Commit Message
```text
feat(sensor): add mobile controller preset toggle and comprehensive E2E test suite

Plan: 2026-11-04-mobile-sensor-stabilizer
Phase: P02-pc-sensor-test-lab
Task: T03-mobile-preset-sync-and-e2e-tests

- Add one-touch stabilizer toggle button to GunGripPad
- Sync SENSOR_CONFIG_UPDATE from PC to mobile GunGripTracker
- Add comprehensive E2E tests simulating Galaxy A15 virtual gyro jitter and iPhone snap aiming
- Verify full test suite passes with zero regression
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done

