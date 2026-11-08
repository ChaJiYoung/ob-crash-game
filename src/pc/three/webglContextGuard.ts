/**
 * WebGL 컨텍스트 손실 감시(2026-11-08-webgl-context-loss D02).
 * 손실 이벤트에서 preventDefault로 복구를 요청하고, 대기 시간 안에 복구되면 onRestored, 아니면 onGiveUp을 부른다.
 * 브라우저 API에 직접 묶이지 않도록 EventTarget과 타이머를 주입받는다(테스트는 WebGL 없이 돈다).
 */
export const CONTEXT_RESTORE_WAIT_MS = 3000;

export interface ContextLossGuardOptions {
  /** true를 반환하면 손실 이벤트를 무시한다(정리 중 forceContextLoss로 생긴 손실). */
  isDisposed: () => boolean;
  /** 손실 직후 한 번: 게임 일시정지 등. */
  onLost: () => void;
  /** 대기 시간 안에 복구됨. */
  onRestored: () => void;
  /** 대기 시간 안에 복구되지 않음. */
  onGiveUp: () => void;
  waitMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

export interface ContextLossGuard {
  /** 손실 상태면 true. 렌더 루프는 이때 그리기를 건너뛴다. */
  isLost: () => boolean;
  /** 리스너와 대기 타이머를 제거한다. */
  detach: () => void;
}

export function attachContextLossGuard(canvas: EventTarget, opts: ContextLossGuardOptions): ContextLossGuard {
  const waitMs = opts.waitMs ?? CONTEXT_RESTORE_WAIT_MS;
  const setTimer = opts.setTimer ?? ((fn: () => void, ms: number) => window.setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((id: unknown) => window.clearTimeout(id as number));
  let lost = false;
  let gaveUp = false;
  let timer: unknown = null;

  const onLostEvt = (e: Event) => {
    if (opts.isDisposed()) return;
    // preventDefault를 하지 않으면 브라우저가 복구를 시도하지 않아 webglcontextrestored가 오지 않는다.
    e.preventDefault();
    const first = !lost;
    lost = true;
    if (timer === null && !gaveUp) {
      timer = setTimer(() => {
        timer = null;
        if (opts.isDisposed()) return;
        gaveUp = true;
        opts.onGiveUp();
      }, waitMs);
    }
    if (first) opts.onLost();
  };

  const onRestoredEvt = () => {
    if (opts.isDisposed()) return;
    lost = false;
    if (gaveUp) return; // 이미 안내 화면이 떴다: 새로고침 버튼에 맡긴다.
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    opts.onRestored();
  };

  canvas.addEventListener('webglcontextlost', onLostEvt);
  canvas.addEventListener('webglcontextrestored', onRestoredEvt);

  return {
    isLost: () => lost,
    detach: () => {
      canvas.removeEventListener('webglcontextlost', onLostEvt);
      canvas.removeEventListener('webglcontextrestored', onRestoredEvt);
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
    },
  };
}
