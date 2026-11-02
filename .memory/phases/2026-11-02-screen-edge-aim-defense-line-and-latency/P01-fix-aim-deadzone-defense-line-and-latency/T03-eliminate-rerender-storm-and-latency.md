# Task: T03 Eliminate Re-render Storm and Latency

## Status: pending

## Goal
PC 쪽에서 초당 60회 발생하던 최상위 페이지(`PCGamePage`)의 React 전체 리렌더링 폭풍(`setDiagnostics`)을 차단(디버그 패널용 250ms 스로틀링)하여 브라우저 메인 스레드 부하와 프레임 드랍(버벅임)을 원천 해결하고, 모바일 `GunGripTracker`의 조준 스무딩 필터를 `0.72`에서 `0.92`로 상향하여 고무줄처럼 뒤처지던 입력 지연(Floaty feel)을 없애 아케이드 건슈팅 1:1 칼반응을 구현한다.

## Decision Summary
- **D03**:
  - `PCGamePage.tsx`: `SENSOR_RELAY`에서 `setDiagnostics` 호출을 250ms(초당 4회)로 스로틀링. 조준선(`crosshairRef.updatePosition`)과 3D 총구(`canvasRef.setAim`)는 direct DOM 및 Three.js rAF 루프를 통해 120fps 즉시 갱신.
  - `GunGripTracker.ts`: `smoothingAlpha` 기본값을 `0.72` ➔ `0.92`로 상향.

## Implementation

### I01. PC 센서 수신 루프의 React 리렌더링 스로틀링
- Related Files:
  - `src/pc/PCGamePage.tsx` :: `socket.onmessage` — modify

#### Details
- **Throttled Diagnostics State Update**:
  - `lastDiagUpdateTimeRef = useRef<number>(0)` 추가.
  - `SENSOR_RELAY` 수신 시:
    ```typescript
    // Direct DOM & 3D Aim 업데이트는 지연 없이 매 패킷마다 60~120fps로 즉시 실행
    updateAimDirect(effectiveAimX, effectiveAimY, false);

    // React 상태 변경(setDiagnostics)은 250ms(초당 4회)로 스로틀링하여 리렌더링 폭풍 차단
    if (now - lastDiagUpdateTimeRef.current >= 250) {
      lastDiagUpdateTimeRef.current = now;
      setDiagnostics((prev) => ({
        ...prev,
        aimX: effectiveAimX,
        aimY: effectiveAimY,
        yawDeg: p.yawDeg,
        pitchDeg: p.pitchDeg,
        rollDeg: p.rollDeg,
        rapidFireHold: p.rapidFireHold,
        lastSnapFireAt: p.snapFire ? Date.now() : prev.lastSnapFireAt,
      }));
    }
    ```

### I02. 모바일 조준 평활화 필터 초저지연화
- Related Files:
  - `src/controller/sensors/GunGripTracker.ts` :: `getEffectiveAim`, `computeAim` — modify
  - `tests/controller-sensors.test.ts` — modify

#### Details
- **Low-Latency Smoothing Alpha**:
  - `smoothingAlpha = 0.92` (기존 0.72에서 대폭 상향, 미세 손떨림만 부드럽게 유지하고 빠른 손목 조준 이동 시 잔류 지연 없이 1:1 즉각 추적).

## Acceptance Criteria
- [x] `PCGamePage`에서 `setDiagnostics`가 250ms 주기로 스로틀링되어 React 리렌더링 폭풍이 완전히 제거된다.
- [x] 조준선 위치(`CrosshairOverlay`) 및 3D 총구 방향은 여전히 60~120fps로 매끄럽고 즉각적으로 반응한다.
- [x] `GunGripTracker`의 기본 스무딩 알파가 0.92로 적용되어 모바일 조준 지연이 체감상 즉시 반응 수준으로 단축된다.
- [x] 전체 테스트 통과 및 `npm run build` 성공.

## Validation
- `npx vitest run tests/controller-sensors.test.ts` — 완화된 스무딩 및 센서 추적 테스트 통과
- `npx vitest run` — 9개 테스트 파일 전체 통과
- `npm run build` — 프로덕션 빌드 성공

## Commit Message
```text
perf(aim): throttle diagnostics re-renders to 250ms and raise mobile smoothing alpha to 0.92

Plan: 2026-11-02-screen-edge-aim-defense-line-and-latency
Phase: P01-fix-aim-deadzone-defense-line-and-latency
Task: T03-eliminate-rerender-storm-and-latency

- Throttle setDiagnostics to 250ms in PCGamePage to prevent 60Hz React reconciliation storm
- Keep direct DOM and Three.js 60-120fps aim updates zero-delay
- Raise GunGripTracker smoothingAlpha to 0.92 for instant 1:1 arcade wrist responsiveness
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
