# Task: T07 Decouple HUD and Shot FX from React

## Status: pending

## Goal
페이지 전체 리렌더를 초당 약 25~50회에서 크게 줄이고, 사격 이펙트와 소리를 React state 없이 바로 실행한다. 메인 스레드 여유를 만들고, 처치 폭발이 빠지는 경우와 효과음 중복을 없앤다.

## Decision Summary
- D06: 값이 바뀔 때만 HUD를 갱신하고, HP바는 직접 DOM으로 그리고, 사격 이펙트는 캔버스 핸들로 호출한다.
- D15: 발사음은 `handleShootEvent`, 스킬음은 `executeSkill`에서만 재생한다.
- D01 확인 사항: 이펙트가 React effect에서 실행되면 렌더 루프가 메시를 먼저 지워 폭발이 빠질 수 있다.

## Implementation

### I01. HUD 스냅샷 비교

- Related Files:
  - `src/pc/hudSnapshot.ts` :: `HudSnapshot`, `buildHudSnapshot`, `isHudSnapshotEqual` — 순수 함수; new
  - `src/pc/PCGamePage.tsx` :: Engine HUD Tick — 변경 시에만 갱신; modify
  - `tests/hud-snapshot.test.ts` :: 비교 함수 검증; new

#### Details
- **Signatures & Types**:
  ```typescript
  export interface HudSnapshot {
    score: number; combo: number; comboMultiplier: number; lives: number; wave: number;
    ammo: number; maxAmmo: number; isReloading: boolean;
    feverGauge: number; isFeverReady: boolean; isFeverActive: boolean;
    activeBuffs: ActiveBuffState[];
    isWideScopeActive: boolean; isPowerShotActive: boolean;
    waveProgress?: WaveProgressInfo;
    weaponKind: WeaponKind; weaponLevel: WeaponLevel;
    skillStock: number; maxSkillStock: number; skillCooldownRemainingMs: number;
  }

  export function buildHudSnapshot(engine: BeerCrusherEngine, nowMs: number): HudSnapshot;
  export function isHudSnapshotEqual(a: HudSnapshot, b: HudSnapshot): boolean;
  ```
- **Execution Flow / Logic**:
  1. `skillCooldownRemainingMs`와 버프 남은 시간을 100ms 단위로 반올림한다.
  2. 원시 값은 `===`, `activeBuffs`와 `waveProgress`는 `JSON.stringify`로 비교한다.
  3. HUD Tick 주기를 50ms에서 100ms로 늘린다.
  4. `setHudState((prev) => (isHudSnapshotEqual(prev, next) ? prev : next));`
  5. 같은 인터벌 안의 금색 캔 알림, 피버 자동 발사 타이머, 모바일 동기화, 승패 전환은 그대로 둔다.
- **테스트**: 같은 값이면 `true`. 점수, 탄약, 체력이 바뀌면 `false`. 쿨다운 40ms 차이는 `true`, 200ms 차이는 `false`.

### I02. HP바 레이어

- Related Files:
  - `src/pc/components/MonsterHpBarLayer.tsx` :: `MonsterHpBarLayer`, `MonsterHpBarLayerHandle` — 직접 DOM 갱신; new
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `monsterProjections` prop과 JSX — 제거; modify
  - `src/pc/PCGamePage.tsx` :: `monsterProjections` 상태 — 제거; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface MonsterHpBarLayerHandle {
    update(projections: MonsterHudProjection[]): void;
  }
  ```
- **Execution Flow / Logic**:
  1. 컨테이너 div 하나만 React로 렌더한다. `pointerEvents: 'none'`, `position: 'absolute'`, `inset: 0`.
  2. `Map<id, { root, fill, stunTag, slowTag }>`로 DOM을 관리한다. 없으면 `document.createElement`로 만들고, 목록에서 빠진 id는 제거한다.
  3. 표시 조건과 화면 밖 판단은 기존 JSX(`ArcadeOverlayHUD.tsx:226-315`)와 같다. `shouldRenderMonsterHpBar`와 `MonsterHudProjection`은 `ArcadeOverlayHUD.tsx`에 그대로 둔다.
  4. 값이 바뀐 스타일만 쓴다. `left`, `top`, 채움 너비, 색상, STUN·SLOW 표시.
  5. `PCGamePage`는 `hpLayerRef`를 만들고 `onMonsterProjectionsUpdate={handleProjections}`로 넘긴다. `handleProjections`는 `useCallback`으로 고정한다. `<ArcadeOverlayHUD>` 바로 앞에 `<MonsterHpBarLayer>`를 렌더한다.

### I03. 사격 이펙트 직접 호출과 효과음 중복 제거

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `GameCanvas3DHandle`, `lastShootResult` effect, `lastSkillTriggered` effect, `triggerSkillEffect` — 핸들로 이동; modify
  - `src/pc/PCGamePage.tsx` :: `handleShootEvent`, `executeSkill`, `lastShootResult`, `lastJudgment` — 상태 제거; modify
  - `src/pc/components/JudgmentBanner.tsx` :: `JudgmentBanner`, `JudgmentBannerHandle` — 핸들 추가; modify
  - `src/pc/components/CrosshairOverlay.tsx` :: `CrosshairOverlayHandle.kick`, `shotTriggerKey` — prop 제거; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface GameCanvas3DHandle {
    setAim: (aimX: number, aimY: number, immediate?: boolean) => void;
    triggerSkillEffect?: (kind: WeaponKind, level?: WeaponLevel) => void;
    playShotFx: (result: EngineShootResult) => void; // 추가
  }
  export interface JudgmentBannerHandle { show(grade: JudgmentGrade): void; }
  export interface CrosshairOverlayHandle { /* 기존 */ kick(): void; }
  ```
- **Execution Flow / Logic**:
  1. `GameCanvas3D`의 `lastShootResult` `useEffect` 본문을 `playShotFx`로 옮긴다. `soundSynth.playWeaponShoot`(`:231`)은 **삭제**한다.
  2. `triggerSkillEffect`의 `soundSynth.playSkillActivation`(`:146`)을 삭제하고, `lastSkillTriggered` prop과 effect(`:153-160`)도 지운다.
  3. `PCGamePage`:
     ```typescript
     const handleShootEvent = useCallback((result: EngineShootResult) => {
       if (!result.fired) return;
       const isFever = engine.scoreManager.getState().isFeverActive;
       const currentWeapon = result.weaponKind || engine.weaponSystem.getState().weaponKind;
       soundSynth.playWeaponShoot(currentWeapon, isFever);
       if (result.grade !== 'MISS') {
         soundSynth.playHit(result.grade);
         judgmentRef.current?.show(result.grade);
       }
       if (result.interceptedProjectile) {
         soundSynth.playInterceptSound();
         setInterceptedBannerKey(Date.now()); // P02-T02에서 제거
       }
       canvasRef.current?.playShotFx(result);
       crosshairRef.current?.kick();
     }, [engine, soundSynth]);
     ```
  4. `lastShootResult`, `lastJudgment` 상태와 prop 전달을 지운다.
  5. `onAimChange` 인라인 함수를 `useCallback`으로 고정해 `GameCanvas3D`의 `React.memo`가 동작하게 한다.
  6. `JudgmentBanner`: 자체 상태로 grade와 key를 관리하고 `show`에서 갱신한다. 표시 로직과 `getJudgmentBannerSpec`은 유지한다.
  7. `CrosshairOverlay`: `kick()`에서 `setIsKicking(true)`와 120ms 타이머를 실행한다. `shotTriggerKey` prop과 effect(`:234-240`)를 지운다.
- **함정**: `playShotFx`는 `shootAt` 직후 동기로 호출되어야 한다. 렌더 루프가 죽은 대상의 메시를 지우기 전에 위치를 읽어야 폭발이 빠지지 않는다.

### I04. 회귀 방지

- Related Files:
  - `tests/hud-render-cost.test.ts` — 소스 검사 추가; modify

#### Details
- `PCGamePage.tsx`에 `setLastShootResult`, `setMonsterProjections`가 없다.
- `GameCanvas3D.tsx`에 `playWeaponShoot`, `playSkillActivation`가 없다.
- `PCGamePage.tsx`에서 `playWeaponShoot`, `playSkillActivation`이 각각 한 번만 나온다.

## Acceptance Criteria
- [ ] 발사음과 스킬음이 한 번씩만 들린다.
- [ ] 처치 폭발이 빠지지 않는다.
- [ ] HP바가 몬스터를 부드럽게 따라간다.
- [ ] 판정 배너와 크로스헤어 반동이 그대로 동작한다.
- [ ] 전투 중 React 커밋이 크게 줄어든다(T08에서 측정).

## Validation
- `npx vitest run tests/hud-snapshot.test.ts tests/hud-render-cost.test.ts tests/pc-hud-and-banner.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- `npm run dev`로 샌드박스(`/sensor-test`)와 본 게임에서 사격 확인

## Commit Message
```text
perf(pc): decouple HUD ticks and shot effects from React renders

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P01-render-and-stutter
Task: T07-decouple-hud-and-shot-fx-from-react

- Update HUD state only when values change
- Draw monster HP bars through a direct DOM layer
- Play shot effects synchronously through canvas handles
- Remove duplicate shoot and skill sounds
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
