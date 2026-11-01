# Task: T03 병뚜껑 뻥(Pop) 오디오 합성 및 뚜껑 솟구침/맥주 분수 파티클 연출, 레거시 mug 완전 제거

## Status: done

## Goal
Web Audio API 기반의 경쾌한 "뻥!" 병뚜껑 개봉 사운드를 합성하고, 은색 왕관 뚜껑이 위로 솟구치며 유리 파편과 황금빛 맥주 분수가 뿜어져 나오는 크러시 파티클 연출을 연동하며, 코드베이스 전체에서 레거시 `'mug'` 식별자를 완전 제거하여 모든 단위 테스트(32+개)와 TypeScript 타입 검사를 100% 무결하게 통과시킨다.

## Decision Summary
- D04/D05 반영: `SoundSynthesizer.ts`에 `playBottlePopSound()`를 구현하여 Web Audio API로 800Hz -> 180Hz 급강하 지수 주파수 스윕과 고음역 팝 임펄스를 합성한다.
- `ParticleEffects3D.ts`에 `triggerBottleCrash()`를 구현하여 은색 왕관 뚜껑이 상향(+Y)으로 솟구치며 고속 회전하는 파티클 1개, 유리 파편 16개, 황금빛 맥주 방울 14개를 방출한다.
- `TargetKind`에서 `'mug'`를 제거하여 `'pilgood' | 'caslight' | 'obi' | 'hanmac' | 'bottle' | 'boss'`로 완전 통일하고, `TARGET_SPECS.mug` 및 레거시 참조를 전면 정리한다.

## Implementation

### I01. Web Audio API "뻥!" 병뚜껑 팝 사운드 합성기 구현

- Related Files:
  - `src/pc/audio/SoundSynthesizer.ts` :: `SoundSynthesizer` — `playBottlePopSound` 메서드 추가; modify

#### Details
- **Signatures & Types (`src/pc/audio/SoundSynthesizer.ts`)**:
  ```typescript
  public playBottlePopSound(): void
  ```
- **Synthesis Logic**:
  1. `AudioContext` 활성화 및 마스터 게인 연결
  2. **오실레이터 (Pop 음)**:
     - Sine wave Oscillator 생성
     - 주파수: `850Hz`에서 시작하여 `0.065초` 동안 지수 감쇠(`exponentialRampToValueAtTime`)로 `160Hz`까지 급락
  3. **엔벨로프 (Gain Envelope)**:
     - 순간 어택(`gain = 0.85`), `0.08초` 동안 `0.001`로 급격히 감쇠
  4. **고음역 팝 임펄스 (Snappy click)**:
     - Triangle 파형 `1600Hz` 초단기 펄스(0.015초)를 병렬 믹싱해 "탁!" 하는 뚜껑 따개 쾌감을 가미

### I02. 은색 왕관 뚜껑 솟구침 및 유리·맥주 분수 파티클 구현

- Related Files:
  - `src/pc/three/ParticleEffects3D.ts` :: `triggerBottleCrash` — 병맥주 전용 크러시 파티클 메서드 신설; modify
  - `src/pc/components/GameCanvas3D.tsx` :: 타겟 파괴 이벤트 핸들러 — `kind === 'bottle'`일 때 팝 사운드 및 뚜껑 파티클 연동; modify

#### Details
- **Signatures & Particle Logic (`src/pc/three/ParticleEffects3D.ts`)**:
  ```typescript
  public triggerBottleCrash(pos: THREE.Vector3, velocity?: THREE.Vector3): void
  ```
  1. **은색 왕관 뚜껑 솟구침 파티클 (Pop Crown Cap)**:
     - 원통 실린더 메시(`CylinderGeometry(0.125, 0.125, 0.04, 16)`, 실버 메탈 재질) 1개 생성
     - 초기 속도: `vy = 6.0 + Math.random() * 2.0` (위로 높이 솟구침), `vx = (Math.random() - 0.5) * 2.0`, `vz = (Math.random() - 0.5) * 2.0`
     - 회전 각속도: `rx = 15.0`, `rz = 20.0` (공중에서 빠르게 회전)
     - 수명: 1.2초 (중력 `gravity = -9.8` 적용)
  2. **투명 유리 파편 (Glass Shards)**:
     - 반투명 유리 재질 삼각형 파편 16개 사방 방사형 분출 (`speed = 4.0 ~ 7.5 m/s`)
  3. **황금빛 맥주 물보라 (Beer Splash)**:
     - 황금 앰버 구체(`SphereGeometry(0.06, 6, 6)`) 14개 상향 분출
- **Canvas / Engine Trigger (`src/pc/components/GameCanvas3D.tsx`)**:
  - 타겟 체력이 0이 되어 파괴될 때, `target.kind === 'bottle'`이면:
    ```typescript
    audio.playBottlePopSound();
    particles.triggerBottleCrash(targetGroup.position);
    ```

### I03. 레거시 `mug` 식별자 완전 제거 및 전체 테스트 정합성 확보

- Related Files:
  - `src/shared/types.ts` :: `TargetKind` — `'mug'` 제거 (`'pilgood' | 'caslight' | 'obi' | 'hanmac' | 'bottle' | 'boss'`); modify
  - `src/shared/constants.ts` :: `TARGET_SPECS` — `mug` 프로퍼티 완전 제거; modify
  - `src/pc/three/TargetModels3D.ts` — `kind === 'mug'` 레거시 분기 및 타입 선언 정리; modify
  - `tests/shared-protocol.test.ts` — `mug` 검증 구문을 `bottle`로 교체; modify
  - `tests/three-stage-and-models.test.ts` — `mug` 검증 구문을 `bottle`로 교체; modify

#### Details
- 모든 코드베이스에서 `mug` 잔재를 일소하고 순수 `bottle` 체계로 전환
- TypeScript 정적 타입 검사 `npx tsc --noEmit` 무결성 검증

## Acceptance Criteria
- [x] `SoundSynthesizer.ts`에 `playBottlePopSound()`가 추가되어 호출 시 에러 없이 Web Audio 팝 사운드를 합성한다.
- [x] `ParticleEffects3D.ts`의 `triggerBottleCrash()`가 위로 솟구쳐 회전하는 은색 왕관 뚜껑 파티클과 투명 유리 파편, 맥주 분수를 정상 생성한다.
- [x] `src/shared/types.ts`, `src/shared/constants.ts`, `TargetModels3D.ts`에서 레거시 `'mug'`가 완전히 제거되고 `'bottle'`로 통일된다.
- [x] `npm test` 실행 시 전체 테스트(8개 파일, 32+개 테스트)가 100% 통과한다.
- [x] `npx tsc --noEmit` 실행 시 타입 에러가 0건이다.

## Validation
- `npm test` — 전체 테스트 스위트 통과 확인
- `npx tsc --noEmit` — TypeScript 컴파일 에러 없음 확인

## Commit Message
```text
feat(fx): add bottle pop Web Audio synthesizer, flying cap particle, and purge legacy mug

Plan: 2026-11-01-cass-bottle-target
Phase: P01-cass-bottle-target
Task: T03-audio-particle-and-cleanup

- Add playBottlePopSound Web Audio synthesizer in SoundSynthesizer.ts
- Implement triggerBottleCrash with flying crown cap, glass shards, and beer spray in ParticleEffects3D.ts
- Wire bottle destruction events to pop audio and cap particle in GameCanvas3D
- Purge legacy 'mug' from TargetKind, TARGET_SPECS, TargetModels3D, and tests
- Validate entire test suite passes and zero TypeScript compilation errors
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
