import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { MonsterHudProjection, shouldRenderMonsterHpBar } from './ArcadeOverlayHUD';

export interface MonsterHpBarLayerHandle {
  update(projections: MonsterHudProjection[]): void;
}

interface BarDom {
  root: HTMLDivElement;
  fill: HTMLDivElement;
  stunTag: HTMLSpanElement;
  slowTag: HTMLSpanElement;
  tags: HTMLDivElement;
  // last written values (skip redundant style writes)
  left: string;
  top: string;
  width: string;
  color: string;
  stun: boolean;
  slow: boolean;
}

function createTag(text: string, background: string): HTMLSpanElement {
  const tag = document.createElement('span');
  tag.textContent = text;
  Object.assign(tag.style, {
    fontSize: '9px',
    fontWeight: '900',
    color: '#111827',
    background,
    padding: '1px 4px',
    borderRadius: '4px',
    letterSpacing: '0.5px',
    display: 'none',
  });
  return tag;
}

function createBar(): BarDom {
  const root = document.createElement('div');
  Object.assign(root.style, {
    position: 'absolute',
    transform: 'translate(-50%, -100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    pointerEvents: 'none',
    zIndex: '10',
  });

  const tags = document.createElement('div');
  Object.assign(tags.style, { display: 'none', gap: '3px', marginBottom: '1px' });
  const stunTag = createTag('⚡STUN', '#fbbf24');
  const slowTag = createTag('❄️SLOW', '#67e8f9');
  tags.append(stunTag, slowTag);

  const track = document.createElement('div');
  Object.assign(track.style, {
    width: '44px',
    height: '6px',
    background: 'rgba(15, 23, 42, 0.96)',
    borderRadius: '3px',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
    padding: '1px',
    boxSizing: 'content-box',
  });
  const fill = document.createElement('div');
  Object.assign(fill.style, {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.12s ease-out',
  });
  track.appendChild(fill);

  root.append(tags, track);
  return { root, fill, stunTag, slowTag, tags, left: '', top: '', width: '', color: '', stun: false, slow: false };
}

/**
 * 몬스터 머리 위 체력바. 매 프레임 바뀌는 위치를 React state로 돌리지 않고 DOM을 직접 갱신한다.
 */
export const MonsterHpBarLayer = React.memo(
  forwardRef<MonsterHpBarLayerHandle>((_props, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const barsRef = useRef<Map<string, BarDom>>(new Map());

    useImperativeHandle(
      ref,
      () => ({
        update(projections: MonsterHudProjection[]) {
          const container = containerRef.current;
          if (!container) return;
          const bars = barsRef.current;
          const seen = new Set<string>();

          for (const proj of projections) {
            if (!shouldRenderMonsterHpBar(proj.maxHp, proj.isItem, proj.isProjectile, proj.hp)) continue;
            if (proj.leftPercent < -5 || proj.leftPercent > 105 || proj.topPercent < -5 || proj.topPercent > 105) continue;

            seen.add(proj.id);
            let bar = bars.get(proj.id);
            if (!bar) {
              bar = createBar();
              bars.set(proj.id, bar);
              container.appendChild(bar.root);
            }

            const left = `${proj.leftPercent}%`;
            const top = `${proj.topPercent}%`;
            if (bar.left !== left) {
              bar.left = left;
              bar.root.style.left = left;
            }
            if (bar.top !== top) {
              bar.top = top;
              bar.root.style.top = top;
            }

            const safeMaxHp = Math.max(0.001, proj.maxHp);
            const hpRatio = Math.max(0, Math.min(1, proj.hp / safeMaxHp));
            const color = hpRatio > 0.5 ? '#10b981' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
            const width = `${proj.hp > 0 ? Math.max(2, Math.round(hpRatio * 100)) : 0}%`;
            if (bar.width !== width) {
              bar.width = width;
              bar.fill.style.width = width;
            }
            if (bar.color !== color) {
              bar.color = color;
              bar.fill.style.background = color;
            }

            const stun = !!proj.isStunned;
            const slow = !!proj.isSlowed;
            if (bar.stun !== stun || bar.slow !== slow) {
              bar.stun = stun;
              bar.slow = slow;
              bar.stunTag.style.display = stun ? 'inline' : 'none';
              bar.slowTag.style.display = slow ? 'inline' : 'none';
              bar.tags.style.display = stun || slow ? 'flex' : 'none';
            }
          }

          if (bars.size !== seen.size) {
            for (const [id, bar] of bars) {
              if (!seen.has(id)) {
                bar.root.remove();
                bars.delete(id);
              }
            }
          }
        },
      }),
      []
    );

    return (
      <div
        ref={containerRef}
        data-testid="monster-hp-bar-layer"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}
      />
    );
  })
);
