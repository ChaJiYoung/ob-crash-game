import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { MonsterHudProjection, shouldRenderMonsterHpBar } from './ArcadeOverlayHUD';

export interface MonsterHpBarLayerHandle {
  update(projections: MonsterHudProjection[]): void;
}

const TRACK_INNER_WIDTH = 44;
const TRACK_INNER_HEIGHT = 6;
const TRACK_PADDING = 1;
const TRACK_TOTAL_WIDTH = TRACK_INNER_WIDTH + TRACK_PADDING * 2;
const TRACK_TOTAL_HEIGHT = TRACK_INNER_HEIGHT + TRACK_PADDING * 2;

export function getHpBarColor(hpRatio: number): '#10b981' | '#f59e0b' | '#ef4444' {
  if (hpRatio > 0.5) return '#10b981';
  if (hpRatio > 0.25) return '#f59e0b';
  return '#ef4444';
}

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    return;
  }
  ctx.fillRect(x, y, w, h);
}

function strokeRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.stroke();
    return;
  }
  ctx.strokeRect(x, y, w, h);
}

function drawStatusBadges(
  ctx: CanvasRenderingContext2D,
  cx: number,
  trackTopY: number,
  isStunned: boolean,
  isSlowed: boolean
): void {
  const tags: { text: string; bg: string }[] = [];
  if (isStunned) tags.push({ text: '⚡STUN', bg: '#fbbf24' });
  if (isSlowed) tags.push({ text: '❄️SLOW', bg: '#67e8f9' });
  if (tags.length === 0) return;

  ctx.font = '900 9px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const padX = 4;
  const chipHeight = 13;
  const gap = 3;
  const widths = tags.map((t) => Math.ceil(ctx.measureText(t.text).width) + padX * 2);
  const totalWidth = widths.reduce((sum, w) => sum + w, 0) + gap * (tags.length - 1);

  let cursorX = cx - totalWidth / 2;
  const chipY = trackTopY - 3 - chipHeight;

  for (let i = 0; i < tags.length; i++) {
    const w = widths[i];
    ctx.fillStyle = tags[i].bg;
    fillRoundedRect(ctx, cursorX, chipY, w, chipHeight, 4);
    ctx.fillStyle = '#111827';
    ctx.fillText(tags[i].text, cursorX + w / 2, chipY + chipHeight / 2 + 0.5);
    cursorX += w + gap;
  }
}

/**
 * 단일 2D Canvas에 모든 활성 몬스터의 HP 바와 상태이상 배지를 일괄 드로우한다.
 * DOM 노드를 생성·수정하지 않아 브라우저 레이아웃 재계산(Forced Reflow)을 0회로 유지한다.
 */
export function drawMonsterHpBars(
  ctx: CanvasRenderingContext2D,
  projections: MonsterHudProjection[],
  logicalWidth: number,
  logicalHeight: number
): number {
  ctx.clearRect(0, 0, logicalWidth, logicalHeight);
  if (logicalWidth <= 0 || logicalHeight <= 0) return 0;

  let drawn = 0;
  for (const proj of projections) {
    if (!shouldRenderMonsterHpBar(proj.maxHp, proj.isItem, proj.isProjectile, proj.hp)) continue;
    if (proj.leftPercent < -5 || proj.leftPercent > 105 || proj.topPercent < -5 || proj.topPercent > 105) continue;

    const cx = (proj.leftPercent / 100) * logicalWidth;
    const bottomY = (proj.topPercent / 100) * logicalHeight;
    const trackX = cx - TRACK_TOTAL_WIDTH / 2;
    const trackY = bottomY - TRACK_TOTAL_HEIGHT;

    // 트랙 배경 & 테두리
    ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
    fillRoundedRect(ctx, trackX, trackY, TRACK_TOTAL_WIDTH, TRACK_TOTAL_HEIGHT, 3);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    strokeRoundedRect(ctx, trackX, trackY, TRACK_TOTAL_WIDTH, TRACK_TOTAL_HEIGHT, 3);

    // 체력 게이지
    const safeMaxHp = Math.max(0.001, proj.maxHp);
    const hpRatio = Math.max(0, Math.min(1, proj.hp / safeMaxHp));
    if (proj.hp > 0) {
      const fillWidth = Math.max(1, Math.round(TRACK_INNER_WIDTH * hpRatio));
      ctx.fillStyle = getHpBarColor(hpRatio);
      fillRoundedRect(
        ctx,
        trackX + TRACK_PADDING,
        trackY + TRACK_PADDING,
        fillWidth,
        TRACK_INNER_HEIGHT,
        2
      );
    }

    if (proj.isStunned || proj.isSlowed) {
      drawStatusBadges(ctx, cx, trackY, !!proj.isStunned, !!proj.isSlowed);
    }

    drawn++;
  }

  return drawn;
}

/**
 * 몬스터 머리 위 체력바. 매 프레임 DOM을 생성/이동하는 대신 단일 2D Canvas에 일괄 드로우한다.
 */
export const MonsterHpBarLayer = React.memo(
  forwardRef<MonsterHpBarLayerHandle>((_props, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
    const hadDrawnRef = useRef(false);

    useEffect(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const syncSize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        sizeRef.current = { width: w, height: h, dpr };
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
      };

      syncSize();
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(syncSize);
        observer.observe(container);
        return () => observer.disconnect();
      }
      window.addEventListener('resize', syncSize);
      return () => window.removeEventListener('resize', syncSize);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        update(projections: MonsterHudProjection[]) {
          const canvas = canvasRef.current;
          const container = containerRef.current;
          if (!canvas || !container) return;

          if (sizeRef.current.width <= 0 || sizeRef.current.height <= 0) {
            const w = container.clientWidth;
            const h = container.clientHeight;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            sizeRef.current = { width: w, height: h, dpr };
            canvas.width = Math.max(1, Math.round(w * dpr));
            canvas.height = Math.max(1, Math.round(h * dpr));
          }

          if (projections.length === 0 && !hadDrawnRef.current) return;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const { width, height, dpr } = sizeRef.current;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const drawn = drawMonsterHpBars(ctx, projections, width, height);
          hadDrawnRef.current = drawn > 0;
        },
      }),
      []
    );

    return (
      <div
        ref={containerRef}
        data-testid="monster-hp-bar-layer"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 10 }}
      >
        <canvas
          ref={canvasRef}
          data-testid="monster-hp-bar-canvas"
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    );
  })
);
