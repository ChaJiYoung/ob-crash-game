import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MonsterHpBarLayer, drawMonsterHpBars, getHpBarColor } from '../src/pc/components/MonsterHpBarLayer';
import type { MonsterHudProjection } from '../src/pc/components/ArcadeOverlayHUD';

function createMockCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textBaseline: 'alphabetic',
    textAlign: 'start',
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 6 })),
  } as unknown as CanvasRenderingContext2D;
}

const makeProj = (over: Partial<MonsterHudProjection> = {}): MonsterHudProjection => ({
  id: 'm1',
  kind: 'bottle',
  hp: 50,
  maxHp: 100,
  leftPercent: 50,
  topPercent: 50,
  ...over,
});

describe('MonsterHpBarLayer (2D Canvas)', () => {
  it('단일 canvas 요소만 렌더링하고 개별 div 노드를 만들지 않는다', () => {
    const html = renderToStaticMarkup(<MonsterHpBarLayer />);
    expect(html).toContain('data-testid="monster-hp-bar-layer"');
    expect(html).toContain('<canvas');
    expect(html).toContain('data-testid="monster-hp-bar-canvas"');
  });

  it('getHpBarColor는 체력 비율 경계값에 따라 올바른 색상을 반환한다', () => {
    expect(getHpBarColor(0.51)).toBe('#10b981');
    expect(getHpBarColor(0.5)).toBe('#f59e0b');
    expect(getHpBarColor(0.26)).toBe('#f59e0b');
    expect(getHpBarColor(0.25)).toBe('#ef4444');
    expect(getHpBarColor(0.05)).toBe('#ef4444');
  });

  it('화면 범위 밖이거나 렌더링 제외 대상은 건너뛰고 유효한 몬스터만 그린다', () => {
    const ctx = createMockCtx();
    const list: MonsterHudProjection[] = [
      makeProj({ id: 'valid', leftPercent: 50, topPercent: 50 }),
      makeProj({ id: 'offscreen-left', leftPercent: -10, topPercent: 50 }),
      makeProj({ id: 'offscreen-bottom', leftPercent: 50, topPercent: 110 }),
      makeProj({ id: 'item', isItem: true }),
      makeProj({ id: 'proj', isProjectile: true }),
      makeProj({ id: 'one-hp', hp: 1, maxHp: 1 }),
    ];

    const drawn = drawMonsterHpBars(ctx, list, 1280, 720);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 1280, 720);
    expect(drawn).toBe(1);
  });

  it('기절(STUN)과 둔화(SLOW) 상태이상 배지를 캔버스 텍스트로 그린다', () => {
    const ctx = createMockCtx();
    const drawn = drawMonsterHpBars(
      ctx,
      [makeProj({ id: 'cc', isStunned: true, isSlowed: true })],
      1280,
      720
    );

    expect(drawn).toBe(1);
    const fillTextMock = ctx.fillText as unknown as ReturnType<typeof vi.fn>;
    const texts = fillTextMock.mock.calls.map((c) => c[0]);
    expect(texts).toContain('⚡STUN');
    expect(texts).toContain('❄️SLOW');
  });
});
