# Task: T01 컨텍스트 손실 감시·안내 오버레이·정리 시 반납

## Status: pending

## Goal
`GameCanvas3D`가 (1) 언마운트 때 WebGL 컨텍스트를 즉시 반납하고, (2) 게임 중 손실을 감지해 일시정지·복구 대기·새로고침 또는 안내를 하며, (3) 렌더러 생성 실패 시 안내 오버레이를 띄운다. 지금은 콘솔 경고만 남고 화면이 검거나 하얗게 남는다.

## Decision Summary
- decisions `2026-11-08-webgl-context-loss` D01~D03.
- 브라우저 이벤트·타이머 로직은 순수 헬퍼(`webglContextGuard.ts`)로 빼서 vitest(node, WebGL 없음)에서 가짜 EventTarget과 가짜 타이머로 검증한다. GameCanvas3D는 연결만 한다.
- 조준경·HUD 파일에 적용되는 `hud-render-cost` 필터 금지 규칙은 새 오버레이와 무관하지만, 일관성을 위해 `boxShadow`·`backdropFilter`를 쓰지 않는다.

## Implementation

### I01. 손실 감시 헬퍼
- Related Files:
  - `src/pc/three/webglContextGuard.ts` :: `attachContextLossGuard`, `CONTEXT_RESTORE_WAIT_MS` — new
#### Details
- **Signatures & Types**:
  ```ts
  export const CONTEXT_RESTORE_WAIT_MS = 3000;

  export interface ContextLossGuardOptions {
    /** true를 반환하면 손실 이벤트를 무시한다(정리 중 forceContextLoss로 생긴 손실). */
    isDisposed: () => boolean;
    /** 손실 직후 1번: 게임 일시정지 등. */
    onLost: () => void;
    /** 대기 시간 안에 복구됨: 기본은 window.location.reload(). */
    onRestored: () => void;
    /** 대기 시간 안에 복구되지 않음: 안내 오버레이('lost'). */
    onGiveUp: () => void;
    waitMs?: number; // 기본 CONTEXT_RESTORE_WAIT_MS
    setTimer?: (fn: () => void, ms: number) => unknown;   // 기본 window.setTimeout
    clearTimer?: (id: unknown) => void;                    // 기본 window.clearTimeout
  }

  export interface ContextLossGuard {
    /** 손실 상태면 true. 렌더 루프는 이때 renderer.render를 건너뛴다. */
    isLost: () => boolean;
    /** 리스너와 대기 타이머를 제거한다. */
    detach: () => void;
  }

  export function attachContextLossGuard(canvas: EventTarget, opts: ContextLossGuardOptions): ContextLossGuard;
  ```
- **Execution Flow / Logic**:
  1. `canvas.addEventListener('webglcontextlost', onLostEvt)`, `'webglcontextrestored', onRestoredEvt`.
  2. `onLostEvt(e)`: `opts.isDisposed()`가 true면 return(preventDefault도 하지 않는다). 아니면 `e.preventDefault()`(복구 요청, 필수), `lost = true`, 이미 타이머가 있으면 그대로 두고 없으면 `timer = setTimer(() => { timer = null; if (!opts.isDisposed()) opts.onGiveUp(); }, waitMs)`, 그리고 처음 손실일 때만 `opts.onLost()`.
  3. `onRestoredEvt()`: disposed면 return. `lost = false`, 타이머가 있으면 clear 후 `opts.onRestored()`. 타이머가 이미 만료되어 giveUp 후라면(타이머 null & giveUp 발생) `onRestored`를 부르지 않는다(`gaveUp` 플래그).
  4. `detach()`: 리스너 둘 제거, 타이머 clear.

### I02. 안내 오버레이
- Related Files:
  - `src/pc/components/WebGLErrorOverlay.tsx` :: `WebGLErrorOverlay`, `WebGLErrorReason` — new
#### Details
- ```tsx
  export type WebGLErrorReason = 'blocked' | 'lost';
  export const WebGLErrorOverlay: React.FC<{ reason: WebGLErrorReason; onReload?: () => void }>;
  ```
- 루트: `data-testid="webgl-error-overlay"`, `role="alert"`, `position: absolute; inset: 0; zIndex: 50; background: #0b0f17; color: #e5e7eb; display: flex; flexDirection: column; alignItems: center; justifyContent: center; gap: 14px; padding: 24px; textAlign: center`.
- 제목: blocked → "그래픽(WebGL)을 켤 수 없습니다", lost → "그래픽이 중단됐습니다".
- 원인 문장: blocked → "브라우저가 이 사이트의 그래픽(WebGL)을 차단했습니다. 그래픽 오류가 여러 번 나면 Chrome이 사이트를 막습니다.", lost → "그래픽 장치가 응답하지 않아 화면을 다시 그릴 수 없습니다."
- 해결 목록(`<ol>`, 둘 공통): "Chrome을 ⌘Q(Windows는 창 모두 닫기)로 완전히 종료한 뒤 다시 실행하세요. 탭 새로고침만으로는 풀리지 않습니다." / "`chrome://gpu`에서 WebGL이 Hardware accelerated인지, 설정 → 시스템 → '가능한 경우 그래픽 가속 사용'이 켜져 있는지 확인하세요."
- 버튼 `data-testid="webgl-error-reload"` "새로고침", onClick: `onReload ?? (() => window.location.reload())`. 스타일 `background: #f59e0b; color: #111; border: none; borderRadius: 10px; padding: 10px 22px; fontWeight: 800; cursor: pointer`.

### I03. GameCanvas3D 연결
- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `GameCanvas3D`(useEffect 본체 약 330~935행, return JSX 약 937행) — modify
#### Details
- import 추가: `useState`(react), `attachContextLossGuard, ContextLossGuard`(`../three/webglContextGuard`), `WebGLErrorOverlay, WebGLErrorReason`(`./WebGLErrorOverlay`).
- 컴포넌트 상단: `const [glError, setGlError] = useState<WebGLErrorReason | null>(null);`
- 렌더러 생성 catch(약 366행 `console.warn('WebGL initialization failed:', e);`) 다음 줄에 `setGlError('blocked');`. 이 경로에서 renderer는 null로 남고 기존 코드가 null 렌더러를 견디므로(이미 `if (renderer && camera)` 가드) 다른 변경은 없다.
- `let disposed = false;` 선언(약 371행)이 렌더러 생성 뒤에 있다. 가드가 참조하므로 **선언을 렌더러 생성 try 블록 위로 옮긴다**. 기존 사용처는 그대로 동작한다.
- 렌더러 생성 성공 후(같은 try 블록 밖, `disposed` 선언 뒤):
  ```ts
  let contextGuard: ContextLossGuard | null = null;
  if (renderer) {
    contextGuard = attachContextLossGuard(renderer.domElement, {
      isDisposed: () => disposed,
      onLost: () => {
        console.warn('WebGL context lost: pausing and waiting for restore');
        engine.setPaused(true, performance.now());
      },
      onRestored: () => window.location.reload(),
      onGiveUp: () => setGlError('lost'),
    });
  }
  ```
- 렌더 호출 두 곳(약 393행 셰이더 워밍업 `renderer.compile`·`renderer.render`, 약 866행 프레임 `renderer.render`)을 `!contextGuard?.isLost()` 조건으로 감싼다. 워밍업은 `if (contextGuard?.isLost()) return;`을 워밍업 함수 첫 줄에 둔다.
- 정리(약 929~933행)를 다음으로 교체한다(D01: canvas가 container에 없어도 반납):
  ```ts
  contextGuard?.detach();
  if (renderer) {
    if (renderer.domElement && container.contains(renderer.domElement)) {
      container.removeChild(renderer.domElement);
    }
    renderer.dispose();
    renderer.forceContextLoss();
  }
  ```
  `disposed = true`는 이미 정리 첫 부분(약 894행)에서 세팅되므로 forceContextLoss로 생기는 lost 이벤트는 가드가 무시한다(detach가 먼저라 리스너도 없다).
- JSX: 기존 `<div ref={mountRef} ...>`를 self-closing에서 children을 가지도록 바꾸고 `{glError && <WebGLErrorOverlay reason={glError} />}`를 넣는다. renderer.domElement는 `appendChild`로 붙으므로 React children과 공존한다(오버레이가 나중 형제라 위에 그려지고, zIndex 50으로 보장).

### I04. 테스트
- Related Files:
  - `tests/webgl-context-guard.test.ts` — new
  - `tests/webgl-error-overlay.test.tsx` — new
  - `tests/webgl-context-cleanup.test.ts` — new (소스 텍스트 검사, `hud-render-cost.test.ts`와 같은 방식)
#### Details
- guard (가짜 `EventTarget` + 수동 타이머 큐):
  - lost 이벤트 → `defaultPrevented === true`, `onLost` 1회, `isLost()` true.
  - 대기 시간 전 restored → 타이머 해제, `onRestored` 1회, `onGiveUp` 0회, `isLost()` false.
  - 타이머 만료 → `onGiveUp` 1회. 그 뒤 restored가 와도 `onRestored` 0회.
  - `isDisposed` true일 때 lost → `defaultPrevented` false, 콜백 0회.
  - lost 두 번 연속 → `onLost` 1회, 타이머 1개.
  - `detach()` 뒤 이벤트 → 콜백 0회.
- overlay(`renderToStaticMarkup`): blocked/lost 제목 문구, `chrome://gpu`, `webgl-error-reload` 포함.
- cleanup 소스 검사: `GameCanvas3D.tsx`에 `forceContextLoss()`, `attachContextLossGuard(`, `setGlError('blocked')`, `<WebGLErrorOverlay`가 들어 있다.

## Acceptance Criteria
- [ ] 언마운트 시 `renderer.forceContextLoss()`가 호출된다
- [ ] 손실 시 일시정지, 3초 안 복구 시 새로고침, 실패 시 'lost' 안내
- [ ] 렌더러 생성 실패 시 'blocked' 안내와 새로고침 버튼

## Validation
- `npx tsc --noEmit` — 0 오류
- `npx vitest run` — 전부 통과(새 테스트 3개 파일 포함)
- 수동(가능하면): 개발 서버에서 콘솔 `__scene`이 있는 상태로 `document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()` 실행 → 일시정지, 3초 뒤 'lost' 안내(restoreContext를 부르지 않으면).

## Commit Message
```text
feat(render): WebGL 컨텍스트 손실·차단 시 복구 대기와 안내 화면

Plan: 2026-11-09-webgl-context-loss
Phase: P01-context-guard
Task: T01-context-guard-and-overlay

- 손실 감시 헬퍼(attachContextLossGuard): preventDefault 복구 요청, 3초 대기, 정리 중 손실 무시
- WebGLErrorOverlay: 차단·중단 원인, 해결 방법, 새로고침 버튼
- GameCanvas3D: 생성 실패 안내, 손실 시 일시정지·렌더 건너뛰기, 정리 때 forceContextLoss
- 가드·오버레이·정리 테스트
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
