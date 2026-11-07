import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PCGamePage } from '../src/pc/PCGamePage';

describe('PCGamePage smoke test (P05 review regression guard)', () => {
  const origWindow = (globalThis as any).window;
  const origWebSocket = (globalThis as any).WebSocket;

  beforeEach(() => {
    if (typeof window === 'undefined') {
      (globalThis as any).window = {
        location: { protocol: 'http:', host: 'localhost:5173', hostname: 'localhost' },
        localStorage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        innerWidth: 1920,
        innerHeight: 1080,
      };
    }
    if (typeof (globalThis as any).WebSocket === 'undefined') {
      (globalThis as any).WebSocket = class MockWebSocket {
        static OPEN = 1;
        readyState = 1;
        send = vi.fn();
        close = vi.fn();
      };
    }
  });

  afterEach(() => {
    if (origWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = origWindow;
    }
    if (origWebSocket === undefined) {
      delete (globalThis as any).WebSocket;
    } else {
      (globalThis as any).WebSocket = origWebSocket;
    }
  });

  it('renders PCGamePage lobby without initialization errors (TDZ guard)', () => {
    let html = '';
    expect(() => {
      html = renderToString(<PCGamePage />);
    }).not.toThrow();

    expect(html).toContain('BEER CRUSHER 3D');
    expect(html).toContain('1P 슬롯');
    expect(html).toContain('2P 슬롯');
    expect(html).toContain('입력 방식을 선택하세요');
    expect(html).toContain('개인 랭킹');
    expect(html).toContain('팀 랭킹');
  });

  it('renders PCGamePage in PAIRING phase with QR modal and ranking tabs', () => {
    const html = renderToString(<PCGamePage initialPhase="PAIRING" />);
    expect(html).toBeDefined();
    expect(html).toContain('BEER CRUSHER 3D');
    expect(html).toContain('1P 슬롯');
    expect(html).toContain('2P 슬롯');
    expect(html).toContain('개인 랭킹');
    expect(html).toContain('팀 랭킹');
    expect(html).toContain('플레이어를 연결하세요');
  });

  it('renders PCGamePage in ZEROING phase without throwing', () => {
    expect(() => {
      const html = renderToString(<PCGamePage initialPhase="ZEROING" />);
      expect(html).toBeDefined();
    }).not.toThrow();
  });

  it('renders PCGamePage across different phases (PLAYING, VICTORY, SANDBOX) without throwing', () => {
    for (const phase of ['PLAYING', 'VICTORY', 'GAMEOVER', 'SANDBOX', 'TUTORIAL'] as const) {
      expect(() => {
        const html = renderToString(<PCGamePage initialPhase={phase} />);
        expect(html).toBeDefined();
      }).not.toThrow();
    }
  });
});
