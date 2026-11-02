# Task: T01 "철컥 탕!" 코킹 장전(화면 터치 Aim Lock & 사운드/햅틱) + 위로 휙 채기(Snap Up) 사격 메커니즘

## Status: done

## Goal
스마트폰 화면을 엄지로 터치하는 순간 기계식 권총 슬라이드를 당기는 금속성 "철컥!" 코킹 사운드와 햅틱 진동이 발생하며 조준선이 타겟에 안정적으로 고정(Aim Lock)되고, 화면을 누른 채로 손목을 위로 채 올릴 때(Snap Up) "탕!" 하고 탄환이 격발되는 아케이드 건슈팅 손맛을 구현한다. 손을 대지 않고 폰을 흔들 때의 오발을 100% 차단하고, 손목을 꺾을 때 총구가 위로 들려 허공으로 빗나가던 오차를 방지한다.

## Decision Summary
- [D01](../../decisions/2026-11-02-aimlock-snap-fevercombo-startflow.md): 화면 터치 홀드 코킹 장전(Aim Lock) 상태에서만 위로 휙 채기(Snap Up) 격발 허용.
- [D04](../../decisions/2026-11-02-aimlock-snap-fevercombo-startflow.md): 화면 터치 다운 시 묵직한 "철컥!" 기계식 코킹 효과음(`playCocking`) 및 모바일 35ms 햅틱 진동 연동.

## Implementation

### I01. 센서 페이로드 확장 및 코킹 상태 정의

- Related Files:
  - `src/shared/types.ts` :: `SensorFramePayload` — `isCocked: boolean` 추가; modify
  - `src/pc/audio/SoundSynthesizer.ts` :: `SoundSynthesizer.playCocking` — 금속성 "철컥!" 오디오 합성 추가; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/shared/types.ts
  export interface SensorFramePayload {
    ...
    isCocked: boolean; // 화면 터치 홀드로 코킹(장전) 및 조준 고정 상태 여부
  }
  ```
- **SoundSynthesizer.playCocking**:
  - Web Audio API Oscillator 노드(삼각파 180Hz에서 520Hz로 급상승하는 금속성 클릭 + 노이즈 버스트)로 권총 슬라이드 후퇴 전진 "철컥!" 사운드 구현.

### I02. 컨트롤러 터치패드 코킹 상태 연동 및 스냅 격발 조건 제어

- Related Files:
  - `src/controller/components/GunGripPad.tsx` :: `GunGripPad` — 터치 포인터 다운/업 시 코킹 상태 전달; modify
  - `src/controller/MobileControllerPage.tsx` :: `MobileControllerPage` — 코킹 상태 관리 및 코킹 중 스냅 감지 시 즉시 격발; modify

#### Details
- **Execution Flow / Logic**:
  1. `GunGripPad` 포인터 다운(`onPointerDown`):
     - `onCockingChange(true)` 호출
     - `triggerHaptic(35)` 호출 (손에 착 감기는 금속 클릭 촉각)
     - `flushSensorFrame()` 즉시 전송
  2. `GunGripPad` 포인터 업(`onPointerUp`):
     - `onCockingChange(false)` 호출
     - `flushSensorFrame()` 전송
  3. `onMotion` 스냅 감지 시:
     - **오직 `isCockedRef.current === true` 일 때만** `snapFireRef.current = true` 격발 허용!
     - 폰을 그냥 들고 흔들 때는 코킹 상태가 아니므로 오발 발생 0%.
     - 스냅 직전의 안정된 조준선 좌표를 보존하여 탄환 빗나감 방지.

### I03. PCGamePage 코킹 사운드 및 조준선 락온 연동

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — `p.isCocked` 수신 시 코킹 사운드 재생 및 조준선 비주얼 갱신; modify

#### Details
- **Execution Flow / Logic**:
  1. `SENSOR_RELAY` 수신부에서:
     - 만약 직전 프레임은 `!isCocked` 였는데 현재 `p.isCocked === true` 라면:
       `soundSynth.playCocking()` 재생.
     - `p.snapFire === true` 라면:
       `engine.shootAt(effectiveAimX, effectiveAimY, performance.now())` 실행 후 `handleShootEvent` 호출 ("탕!" 사운드 및 피격 판정).

## Acceptance Criteria
- [x] 폰 화면을 누르지 않은 상태에서 손목을 흔들어도 총알이 나가지 않는다.
- [x] 화면을 엄지로 누르는 순간 PC에서 "철컥!" 코킹 사운드가 나고 폰에서 햅틱 진동이 울린다.
- [x] 화면을 누른 채 손목을 위로 채면 "탕!" 하고 즉시 정확한 위치로 탄환이 발사된다.
- [x] `tests/controller-sensors.test.ts` 통과.

## Validation
- `npx vitest run tests/controller-sensors.test.ts` — 코킹 상태 및 스냅 격발 검증
- `npx vitest run tests/shared-protocol.test.ts` — 페이로드 인터페이스 무결성 검증

## Commit Message
```text
feat(gunplay): implement cocking-snap shooting mechanism ("철컥 탕!")

Plan: 2026-11-02-cocking-snap-fevercombo-startflow
Phase: P01-cocking-snap-fevercombo-startflow
Task: T01-cocking-snap-gunplay

- Add isCocked field to SensorFramePayload
- Add metallic cocking sound synthesizer playCocking
- Restrict snap fire to cocked state with aim rollback to eliminate recoil shake
- Trigger cocking haptic and audio on touch down
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
