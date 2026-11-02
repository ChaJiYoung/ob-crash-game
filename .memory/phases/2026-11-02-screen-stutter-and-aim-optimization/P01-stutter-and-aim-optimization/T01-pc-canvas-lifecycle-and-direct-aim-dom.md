# Task: T01 PC 3D 캔버스 생명주기 격리, 2K HDRI 싱글톤 캐싱 및 직접 DOM 조준선 갱신

## Status: done

## Goal
마우스 및 모바일 센서 조준 시 발생하던 `GameCanvas3D`의 WebGL 컨텍스트 무한 파괴·재생성 루프와 `buildBreweryStage3D`의 2K HDRI 반복 다운로드를 차단하고, 조준 좌표를 React State 리렌더링 없이 `Ref`와 직접 DOM 스타일 갱신으로 처리하여 60~120fps의 끊김 없는 화면과 정상적인 몬스터 전진을 보장한다.

## Decision Summary
- **D01**: `GameCanvas3D`의 Three.js 초기화 `useEffect`에서 `onAimChange`, `onShoot` 의존성을 제거하고 `useRef`로 최신 콜백을 참조하도록 격리한다.
- **D02**: `BreweryStage3D`의 `/hdri/pub_interior_2k.hdr` 로딩을 모듈 레벨 싱글톤 캐시로 감싸 최초 1회만 다운로드·디코딩하고 재사용한다.
- **D03**: `CrosshairOverlay`에 `forwardRef` 기반 `updatePosition(aimX, aimY)` 핸들과 `GameCanvas3D`에 `setTargetAim(aimX, aimY)` 핸들을 제공하여, `PCGamePage`가 마우스/센서 이동 시 `setAimX/setAimY` React 리렌더링을 발생시키지 않고 직접 좌표를 갱신하며 프레임 내 부드러운 보간(Lerp)을 수행한다.

## Implementation

### I01. 2K HDRI 환경 텍스처 싱글톤 캐싱 (`BreweryStage3D.ts`)

- Related Files:
  - `src/pc/three/BreweryStage3D.ts` :: `buildBreweryStage3D`, `applyCachedHdriToScene` — 2K HDRI 텍스처 1회 로드 및 메모리 캐시; modify

#### Details
- **Signatures & Types**:
  ```typescript
  let cachedHdriTexture: THREE.DataTexture | null = null;
  let hdriLoadCallbacks: Array<(tex: THREE.DataTexture) => void> | null = null;

  export function applyCachedHdriToScene(scene: THREE.Scene): void;
  export function buildBreweryStage3D(scene: THREE.Scene): BreweryStageRig;
  ```
- **Data & Schema Fields**:
  - `cachedHdriTexture`: `THREE.DataTexture | null` — 로드 완료된 2K HDRI 텍스처 싱글톤 인스턴스
  - `hdriLoadCallbacks`: `Array<(tex: THREE.DataTexture) => void> | null` — 로딩 중 추가 요청된 씬들에 텍스처를 일괄 적용하기 위한 대기 큐
- **Execution Flow / Logic**:
  1. `applyCachedHdriToScene(scene)` 호출 시 `cachedHdriTexture`가 이미 존재하면 즉시 `scene.environment = cachedHdriTexture`, `scene.background = cachedHdriTexture`, `scene.backgroundBlurriness = 0.08`, `scene.backgroundIntensity = 0.72`를 설정하고 반환한다.
  2. 아직 로드되지 않았고 `typeof window !== 'undefined'`이면, `hdriLoadCallbacks`가 이미 진행 중인지 확인하여 진행 중이면 콜백 큐에 현재 `scene` 적용 함수를 추가한다.
  3. 최초 호출이면 `new RGBELoader().load('/hdri/pub_interior_2k.hdr', (texture) => { ... })`를 1회만 실행하고, 로드 완료 시 `texture.mapping = THREE.EquirectangularReflectionMapping` 설정 후 `cachedHdriTexture = texture`에 저장하며 큐의 모든 콜백을 실행한다.

### I02. 직접 DOM 업데이트를 지원하는 조준선 컴포넌트 (`CrosshairOverlay.tsx`)

- Related Files:
  - `src/pc/components/CrosshairOverlay.tsx` :: `CrosshairOverlay`, `CrosshairOverlayHandle` — React 리렌더링 없는 조준선 위치 직접 제어 및 CSS transition 지연 제거; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface CrosshairOverlayHandle {
    updatePosition: (aimX: number, aimY: number) => void;
  }

  export interface CrosshairOverlayProps {
    aimX: number;
    aimY: number;
    isFeverActive?: boolean;
    isWideScopeActive?: boolean;
    isPowerShotActive?: boolean;
    shotTriggerKey?: number;
  }

  export const CrosshairOverlay: React.ForwardRefExoticComponent<
    CrosshairOverlayProps & React.RefAttributes<CrosshairOverlayHandle>
  >;
  ```
- **Execution Flow / Logic**:
  1. 루트 `<div>`에 `containerRef = useRef<HTMLDivElement>(null)`를 연결한다.
  2. `useImperativeHandle(ref, () => ({ updatePosition(nextAimX: number, nextAimY: number) { ... } }))`를 구현하여, 호출 시 `aimToViewportPercent(nextAimX, nextAimY)`를 계산하고 `containerRef.current.style.left = `${leftPercent}%``, `containerRef.current.style.top = `${topPercent}%``를 직접 반영한다.
  3. 루트 `<div>`의 `transition` 스타일에서 조준 지연을 유발하던 `left 0.04s linear, top 0.04s linear`를 제거하고 `'transform 0.08s ease-out'`만 남겨 마우스/자이로 이동 시 즉각적으로 따라오도록 수정한다.
  4. `React.memo`로 감싸 상위 컴포넌트의 HUD 상태 변경 시에도 조준선 관련 props(`isFeverActive`, `isWideScopeActive`, `isPowerShotActive`, `shotTriggerKey`)가 동일하면 리렌더링을 건너뛴다.

### I03. Three.js 생명주기 격리 및 조준 프레임 보간 (`GameCanvas3D.tsx`)

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `GameCanvas3D`, `GameCanvas3DHandle` — WebGL 컨텍스트 재생성 루프 차단 및 60~120fps 조준 보간; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface GameCanvas3DHandle {
    setAim: (aimX: number, aimY: number, immediate?: boolean) => void;
  }

  export const GameCanvas3D: React.ForwardRefExoticComponent<
    GameCanvas3DProps & React.RefAttributes<GameCanvas3DHandle>
  >;
  ```
- **Execution Flow / Logic**:
  1. `onAimChange`, `onShoot` props를 각각 `onAimChangeRef = useRef(onAimChange)`, `onShootRef = useRef(onShoot)`에 동기화하여 이벤트 리스너 내부에서 항상 최신 콜백을 호출하도록 변경한다.
  2. `targetAimRef = useRef({ aimX, aimY })`와 `currentAimRef = useRef({ aimX, aimY })`를 유지한다.
  3. `useImperativeHandle(ref, () => ({ setAim(x, y, immediate = false) { targetAimRef.current = { aimX: x, aimY: y }; if (immediate) { currentAimRef.current = { aimX: x, aimY: y }; } } }))`를 제공한다.
  4. 마우스 이동(`handleMouseMove`) 시에는 `targetAimRef.current = { aimX: normX, aimY: normY }`, `currentAimRef.current = { aimX: normX, aimY: normY }`로 즉시 갱신하고 `onAimChangeRef.current?.(normX, normY)`를 호출한다.
  5. `animate(time)` 루프 안에서 `currentAimRef.current`가 `targetAimRef.current`를 향해 `const lerpFactor = Math.min(1, dtSec * 28)`로 부드럽게 보간되도록 계산하여 모바일 60Hz 패킷 수신 시에도 120fps 모니터에서 끊김 없이 부드럽게 조준되도록 만든다.
  6. 사격(`executeShot`) 시에는 `targetAimRef.current`의 정확한 좌표를 사용해 `engine.shootAt`을 호출한다.
  7. Three.js 씬을 생성하는 `useEffect`의 의존성 배열을 `[engine, soundSynth]`로 고정하여 마우스 이동이나 부모 리렌더링 시 캔버스가 절대 파괴되지 않도록 보장한다.

### I04. PCGamePage 조준 상태 비-리렌더링 파이프라인 연결 (`PCGamePage.tsx`)

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — 마우스/센서 수신 시 React State 업데이트 제거 및 Ref 파이프라인 연결; modify

#### Details
- **Execution Flow / Logic**:
  1. `canvasRef = useRef<GameCanvas3DHandle>(null)` 및 `crosshairRef = useRef<CrosshairOverlayHandle>(null)`를 생성한다.
  2. `updateAimDirect(x: number, y: number, immediate: boolean)` 헬퍼 함수를 정의하여:
     - `latestAimRef.current = { aimX: x, aimY: y }` 갱신
     - `canvasRef.current?.setAim(x, y, immediate)` 호출
     - `crosshairRef.current?.updatePosition(x, y)` 호출
     - **주의**: 마우스 이동(`onAimChange`)이나 WebSocket `SENSOR_RELAY` 수신 시 `setAimX`, `setAimY`를 호출하지 않아 `PCGamePage` 리렌더링을 완전히 제거한다.
  3. WebSocket `ERROR` 메시지에서 `msg.code === 'CONTROLLER_DISCONNECTED'`인 경우 `if (rapidFireTimerRef.current) { clearInterval(rapidFireTimerRef.current); rapidFireTimerRef.current = null; }`를 실행하여 연결 끊김 시 잔여 연사 타이머를 안전하게 종료한다.
  4. `handleShootEvent`, `handleStartGame`, `handleStartTutorial`, `handleExitTutorial`, `handleReturnToLobby`를 `useCallback`으로 메모이제이션한다.

### I05. 단위 테스트 검증 (`tests/three-stage-and-models.test.ts`, `tests/pc-hud-and-banner.test.ts`)

- Related Files:
  - `tests/three-stage-and-models.test.ts` — Stage3D 다중 생성 시에도 에러 없이 안정적으로 동작하는지 검증; modify
  - `tests/pc-hud-and-banner.test.ts` — 조준선 좌표 변환 및 스펙 검증 유지; read-only

## Acceptance Criteria
- [ ] `GameCanvas3D.tsx`의 Three.js 초기화 `useEffect` 의존성 배열에 `onAimChange`, `onShoot`이 포함되지 않아 마우스나 센서 이동 시 WebGLRenderer가 재생성되지 않는다.
- [ ] `BreweryStage3D.ts`에서 2K HDRI 로더가 싱글톤 캐시로 동작하여 중복 네트워크 요청 및 배경 깜빡임이 발생하지 않는다.
- [ ] `PCGamePage.tsx`에서 마우스 이동 및 `SENSOR_RELAY` 수신 시 React State 리렌더링 없이 `CrosshairOverlay`와 `GameCanvas3D`의 조준 위치가 즉시 갱신된다.
- [ ] 게임 시작(`PLAYING`) 및 튜토리얼(`TUTORIAL`) 모드에서 몬스터가 끊김 없이 플레이어를 향해 전진한다.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts tests/pc-hud-and-banner.test.ts` — 모든 테스트 통과

## Commit Message
```text
perf(pc): isolate Three.js canvas lifecycle and optimize aim updates via direct DOM refs

Plan: 2026-11-02-screen-stutter-and-aim-optimization
Phase: P01-stutter-and-aim-optimization
Task: T01-pc-canvas-lifecycle-and-direct-aim-dom

- Remove onAimChange and onShoot from GameCanvas3D useEffect dependencies using refs to prevent WebGL context recreation on mouse/sensor move
- Cache 2K pub HDRI texture as a module singleton in BreweryStage3D to eliminate background flickering
- Add forwardRef imperative handles to CrosshairOverlay and GameCanvas3D to update aim coordinates without triggering React state re-renders
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
