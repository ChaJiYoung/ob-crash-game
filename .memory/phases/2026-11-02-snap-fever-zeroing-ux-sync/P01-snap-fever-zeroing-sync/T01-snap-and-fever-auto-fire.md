# Task: T01 스냅 사격 3D 가속도 벡터화 & 피버 타임 전자동 연사 루프 및 오디오 언락

## Status: done

## Goal
손목 스냅(위로 휙 채기) 단발 사격 감지를 기존 단일 X축 검사에서 3차원 가속도 크기 벡터($\sqrt{x^2+y^2+z^2} \ge 8.0 \text{ m/s}^2$)로 전면 교체하여 어떤 파지세에서도 100% 인식되도록 개선하고, 피버 타임 활성화 시 사용자가 손을 대지 않아도 현재 조준선 좌표로 초당 10발(95ms 간격)씩 쏟아지는 100% 전자동 연사(Auto-Rapid-Fire) 루프 및 PC 오디오 언락을 구현한다.

## Decision Summary
- [D01](../../decisions/2026-11-02-snap-fever-zeroing-ux-sync.md): 3D 가속도 벡터 노름 $\sqrt{x^2+y^2+z^2} \ge 8.0 \text{ m/s}^2$ 스냅 감지 및 180ms 쿨다운.
- [D02](../../decisions/2026-11-02-snap-fever-zeroing-ux-sync.md): 피버 타임 7초 동안 95ms 간격 전자동 연사 타이머 루프 가동.
- [D05](../../decisions/2026-11-02-snap-fever-zeroing-ux-sync.md): PC 오디오 자동 재생 정책 해제(AudioContext.resume) 보장.

## Implementation

### I01. 상수 정의 및 GunGripTracker 스냅 사격 3D 벡터화

- Related Files:
  - `src/shared/constants.ts` :: `WEAPON_CONSTANTS` — 스냅 임계치(8.0) 및 피버 자동연사 간격(95ms) 추가/조정; modify
  - `src/controller/sensors/GunGripTracker.ts` :: `GunGripTracker.detectSnapFire` — 3D 가속도 크기 벡터 계산으로 교체; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/shared/constants.ts
  export const WEAPON_CONSTANTS = {
    ...
    SNAP_ACCEL_THRESHOLD_MPS2: 8.0, // 12.0 -> 8.0 완화
    FEVER_AUTO_FIRE_INTERVAL_MS: 95, // 초당 약 10.5발 전자동 연사
    ...
  };
  ```
- **Execution Flow / Logic (`detectSnapFire`)**:
  1. `const magnitude = Math.hypot(sample.x, sample.y, sample.z);`
  2. `if (magnitude >= WEAPON_CONSTANTS.SNAP_ACCEL_THRESHOLD_MPS2) {`
  3. `  if (sample.timestampMs - this.lastSnapTimeMs >= cooldownMs) {`
  4. `    this.lastSnapTimeMs = sample.timestampMs; return true;`
  5. `  }`
  6. `}`
  7. `return false;`

### I02. PCGamePage 피버 타임 100% 전자동 연사 루프 구현

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — 피버 활성화 시 95ms 자동 연사 루프 가동; modify
  - `src/pc/audio/SoundSynthesizer.ts` :: `SoundSynthesizer` — 오디오 언락 안전 메서드 보강; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // PCGamePage.tsx 내부
  const feverAutoFireTimerRef = useRef<NodeJS.Timeout | null>(null);
  ```
- **Execution Flow / Logic**:
  1. Engine HUD 틱(50ms) 또는 Fever 상태 변경 시점:
     - `const isFever = feverState.isFeverActive;`
     - 만약 `isFever === true` 이고 `gamePhase === 'PLAYING'`:
       - `if (!feverAutoFireTimerRef.current)`:
         - `feverAutoFireTimerRef.current = setInterval(() => {`
         - `  const cur = latestAimRef.current;`
         - `  const res = engine.shootAt(cur.aimX, cur.aimY, performance.now());`
         - `  handleShootEvent(res);`
         - `}, WEAPON_CONSTANTS.FEVER_AUTO_FIRE_INTERVAL_MS);`
     - 만약 `isFever === false`:
       - `if (feverAutoFireTimerRef.current) { clearInterval(feverAutoFireTimerRef.current); feverAutoFireTimerRef.current = null; }`
  2. 사운드 언락:
     - `soundSynth.unlockAudio()`를 모바일 컨트롤러 연결(`CONTROLLER_PAIRED`) 및 게임 시작 요청 수신 시 안전 호출.

## Acceptance Criteria
- [ ] 폰을 위로 채 올렸을 때 Y/Z축 가속도($\sqrt{x^2+y^2+z^2} \ge 8.0$)로 스냅 사격이 100% 감지된다.
- [ ] 피버 타임이 시작되면 사용자가 조작하지 않아도 95ms마다 실시간 조준점 위치로 탄환이 자동 발사된다.
- [ ] 피버 타임이 종료되면 자동 연사 타이머가 즉시 멈추고 메모리 누수가 발생하지 않는다.
- [ ] `SoundSynthesizer`의 `unlockAudio()`로 브라우저 무음 차단이 해제된다.

## Validation
- `npx vitest run tests/controller-sensors.test.ts` — 스냅 임계치 8.0 및 3축 가속도 검증 통과
- `npx vitest run tests/engine-judgment-and-spawn.test.ts` — 피버 및 탄환 발사 로직 통과

## Commit Message
```text
feat(gameplay): implement 3d snap fire vector norm and fever auto-rapid-fire loop

Plan: 2026-11-02-snap-fever-zeroing-ux-sync
Phase: P01-snap-fever-zeroing-sync
Task: T01-snap-and-fever-auto-fire

- Update snap fire detection to 3D acceleration norm with 8.0 m/s^2 threshold
- Add 95ms auto-rapid-fire loop during active fever mode
- Add audioContext unlock helper to prevent browser autoplay silencing
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
