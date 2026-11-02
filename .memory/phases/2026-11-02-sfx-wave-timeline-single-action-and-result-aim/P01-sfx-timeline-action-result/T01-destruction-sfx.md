# Task: T01 Beer Destruction Variety SFX

## Status: pending

## Goal
맥주 몬스터 피격(HP 감소) 시 금속 찌그러짐 전조음, 처치(HP 0 파괴) 시 캔 파열음, 병 유리 파쇄음, 보스 대폭발음을 Web Audio API 신디사이저로 구현하고 3D 피격 렌더러에 연동하여 청각적 타격감을 극대화한다.

## Decision Summary
- 피격(HP 감소) 시 `playMetallicHitSound()`, 파괴(HP 0) 시 캔 4종은 `playCanCrushSound()`, 병은 `playBottleShatterSound()`, 보스는 `playBossExplosionSound()`로 분기 연출 ([D01](../../decisions/2026-11-02-sfx-wave-timeline-single-action-and-result-aim.md)).

## Implementation

### I01. SoundSynthesizer SFX Extension

- Related Files:
  - `src/pc/audio/SoundSynthesizer.ts` :: `SoundSynthesizer` — 신규 오디오 합성 메서드 추가; modify

#### Details
- **Signatures & Methods**:
  ```typescript
  export class SoundSynthesizer {
    // 1. 금속 타격/찌그러짐 전조음 (HP 깎일 때)
    public playMetallicHitSound(): void;
    // 2. 알루미늄 캔 통쾌한 파열음 (캔 4종 처치 시)
    public playCanCrushSound(): void;
    // 3. 유리병 산산조각 파쇄음 (병 처치 시)
    public playBottleShatterSound(): void;
    // 4. 거대 생맥주 냉각기 보스 폭발음 (보스 처치 시)
    public playBossExplosionSound(): void;
  }
  ```
- **Web Audio API Synthesis Recipes**:
  1. `playMetallicHitSound`:
     - 고주파 메탈릭 임팩트: triangle/square 오실레이터 (1200Hz ➔ 300Hz 급하강, 0.05s).
     - 게인 엔벨로프: 0.3에서 0.001로 0.06s 내 지수 감쇄.
  2. `playCanCrushSound`:
     - 2중 오실레이터 복합음: 알루미늄 판 찌그러짐 (sawtooth 420Hz ➔ 140Hz) + 날카로운 캔 뚜껑/바디 파열음 (square 980Hz ➔ 220Hz, 0.12s).
     - 게인: 0.45 ➔ 0.001 (0.13s 감쇄).
  3. `playBottleShatterSound`:
     - 기존 `playBottlePopSound`의 뻥 뚫리는 탄산 소리(850Hz ➔ 160Hz)에 더해, 깨지는 유리 파편 고주파 아르페지오 (sine 2400Hz, 1800Hz, 3200Hz 노이즈 펄스, 0.15s).
     - 게인: 0.55 ➔ 0.001 (0.18s 감쇄).
  4. `playBossExplosionSound`:
     - 묵직한 서브베이스 폭발음: sine 120Hz ➔ 30Hz sweep (0.45s) + sawtooth 350Hz ➔ 60Hz 둔탁한 파열 충격파 (0.35s).
     - 게인: 0.7 ➔ 0.001 (0.5s 감쇄).

### I02. 3D Canvas Hit & Destruction Audio Dispatch

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `GameCanvas3D` — 피격 및 처치 시 몬스터 종류별 사운드 분기; modify

#### Details
- **Execution Flow / Logic**:
  1. `result.grade !== 'MISS' && result.target`:
     - 타겟이 존재하고 유효 명중인 경우:
       - Case A: `!result.killed` (체력만 감소한 경우):
         - `soundSynth.playMetallicHitSound();` 호출 (피격 전조음).
       - Case B: `result.killed` (처치된 경우):
         - `result.target.kind === 'bottle'`: `soundSynth.playBottleShatterSound();` 및 파티클 트리거.
         - `result.target.kind === 'golden_boss'`: `soundSynth.playBossExplosionSound();` 및 거대 파티클.
         - 그 외 캔 종류 (`'caslight' | 'pilgood' | 'obi' | 'hanmac'`): `soundSynth.playCanCrushSound();`.
  2. 에러 및 예외: `soundSynth`가 null이거나 AudioContext가 suspended인 경우 안전하게 방어 (`unlockAudio` 또는 try-catch).

## Acceptance Criteria
- [ ] 캔 4종을 쏠 때 타격/처치 시 알루미늄 찌그러지는 사운드가 명확히 출력된다.
- [ ] 병을 쏠 때 유리 파쇄 사운드가 청량하게 출력된다.
- [ ] 보스 피격 시 금속 타격음이 나고, 최종 처치 시 웅장한 폭발음이 출력된다.
- [ ] 브라우저 오디오 정책 오류 없이 부드럽게 사운드가 재생된다.

## Validation
- `pnpm test` — 기존 53개 유닛 테스트 전체 통과
- `pnpm build` — TypeScript 컴파일 및 번들링 성공

## Commit Message
```text
feat(audio): add specialized destruction and hit sfx for cans, bottles, and boss

Plan: 2026-11-02-sfx-wave-timeline-single-action-and-result-aim
Phase: P01-sfx-timeline-action-result
Task: T01-destruction-sfx

- Implement playMetallicHitSound, playCanCrushSound, playBottleShatterSound, and playBossExplosionSound in SoundSynthesizer
- Dispatch specific sound synthesis based on monster kind and killed state in GameCanvas3D
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
