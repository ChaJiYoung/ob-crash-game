import { readGuideSource } from './helpers/guideSource';
import { describe, it, expect } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildControllerPairingUrl, QRPairingModal } from '../src/pc/components/QRPairingModal';
import { createInitialSlots, getStartGate } from '../src/pc/coopSlots';
import { PlayerProfile } from '../src/shared/types';
import {
  DEFAULT_TUNING_CONFIG,
  loadSavedTuningConfig,
  saveTuningConfig,
} from '../src/pc/components/MobileSensorLabModal';

describe('PC QR Pairing URL & Leaderboard Modal Helpers', () => {
  it('should format pairing URL correctly with or without trailing slash', () => {
    expect(buildControllerPairingUrl('https://192.168.0.15:5173/', 'AB12')).toBe(
      'https://192.168.0.15:5173/controller?room=AB12&slot=1'
    );
    expect(buildControllerPairingUrl('http://localhost:5173', 'CR77')).toBe(
      'http://localhost:5173/controller?room=CR77&slot=1'
    );
    expect(buildControllerPairingUrl('https://beer.example.com///', 'Z999')).toBe(
      'https://beer.example.com/controller?room=Z999&slot=1'
    );
    // LAN IP substitution for mobile QR scanning
    expect(buildControllerPairingUrl('https://localhost:5173', 'ROOM1', '172.30.1.31')).toBe(
      'https://172.30.1.31:5173/controller?room=ROOM1&slot=1'
    );
    expect(buildControllerPairingUrl('https://127.0.0.1:5173/', 'ROOM2', '192.168.1.10')).toBe(
      'https://192.168.1.10:5173/controller?room=ROOM2&slot=1'
    );
  });

  it('should identify player record status in rankings', () => {
    const dummyRankings: PlayerProfile[] = [
      {
        deviceId: 'dev-1',
        nickname: '맥주왕',
        bestScore: 8900,
        totalGames: 4,
        lastPlayedAt: '2026-11-01',
      },
      {
        deviceId: 'dev-2',
        nickname: '치맥러버',
        bestScore: 6400,
        totalGames: 2,
        lastPlayedAt: '2026-11-01',
      },
      {
        deviceId: 'dev-3',
        nickname: '카스마스터',
        bestScore: 4200,
        totalGames: 1,
        lastPlayedAt: '2026-11-01',
      },
    ];

    const currentDevice = 'dev-2';
    const isPlayerInRankings = dummyRankings.some((r) => r.deviceId === currentDevice);
    expect(isPlayerInRankings).toBe(true);

    const playerRecord = dummyRankings.find((r) => r.deviceId === currentDevice)!;
    expect(playerRecord.nickname).toBe('치맥러버');

    // Record check
    const newScore = 7500;
    const isNewRecord = newScore > playerRecord.bestScore;
    expect(isNewRecord).toBe(true);
  });

  it('should detect shoot-to-start hit when crosshair is aimed near monitor center', () => {
    const isShootToStartHit = (aimX: number, aimY: number) => {
      return Math.abs(aimX) < 0.65 && Math.abs(aimY) < 0.65;
    };

    // Center aim hits the start target
    expect(isShootToStartHit(0, 0)).toBe(true);
    expect(isShootToStartHit(0.2, -0.3)).toBe(true);
    expect(isShootToStartHit(-0.4, 0.4)).toBe(true);

    // Aiming way outside does not trigger start
    expect(isShootToStartHit(0.85, 0)).toBe(false);
    expect(isShootToStartHit(0, -0.9)).toBe(false);
  });

  it('should ignore shoot-to-start when active phase is PLAYING, TUTORIAL, or SANDBOX', () => {
    const handleShoot = (phase: string, aimX: number, aimY: number) => {
      if (phase === 'PAIRING' || phase === 'ZEROING') {
        if (Math.abs(aimX) < 0.65 && Math.abs(aimY) < 0.65) {
          return 'START_GAME';
        }
      }
      return 'INGAME_SHOT';
    };

    // Pairing or zeroing triggers start
    expect(handleShoot('PAIRING', 0, 0)).toBe('START_GAME');
    expect(handleShoot('ZEROING', 0, 0)).toBe('START_GAME');

    // In-game phases must NEVER trigger start game or reset
    expect(handleShoot('PLAYING', 0, 0)).toBe('INGAME_SHOT');
    expect(handleShoot('TUTORIAL', 0, 0)).toBe('INGAME_SHOT');
    expect(handleShoot('SANDBOX', 0, 0)).toBe('INGAME_SHOT');
  });

  it('should manage MobileSensorLabModal tuning presets and live jitter classification', () => {
    const defaultTuning = DEFAULT_TUNING_CONFIG;
    expect(defaultTuning.isStabilizedMode).toBe(false); // iPhone 13 mini original behavior preserved
    expect(defaultTuning.preset).toBe('default_iphone');

    // Jitter RMS stability classification
    const classifyStability = (rms: number) => {
      if (rms >= 0.018) return 'RED_NOISY';
      if (rms >= 0.006) return 'YELLOW_NORMAL';
      return 'GREEN_STABLE';
    };

    expect(classifyStability(0.002)).toBe('GREEN_STABLE'); // iPhone level
    expect(classifyStability(0.010)).toBe('YELLOW_NORMAL');
    expect(classifyStability(0.025)).toBe('RED_NOISY'); // Galaxy A15 virtual gyro jitter

    // Storage persistence test with mock storage
    const memoryStore: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => memoryStore[key] || null,
      setItem: (key: string, val: string) => {
        memoryStore[key] = val;
      },
    };

    const customConfig = {
      ...defaultTuning,
      isStabilizedMode: true,
      minCutoff: 0.4,
      beta: 2.0,
      preset: 'stabilized_galaxy' as const,
    };
    saveTuningConfig(customConfig, mockStorage);
    const loaded = loadSavedTuningConfig(mockStorage);
    expect(loaded.isStabilizedMode).toBe(true);
    expect(loaded.preset).toBe('stabilized_galaxy');
    expect(loaded.minCutoff).toBe(0.4);
  });
});

describe('lobby controls hint', () => {
  const defaultSlots = createInitialSlots();
  const defaultGate = getStartGate(defaultSlots);

  const html = renderToStaticMarkup(
    React.createElement(QRPairingModal, {
      roomId: 'AB12',
      slots: defaultSlots,
      startGate: defaultGate,
      topRankings: [],
      onEditMouseNickname: () => {},
      onChooseInput: () => {},
      onSubmitMouseNickname: () => {},
      onStart: () => {},
    })
  );

  it('explains the phone and mouse controls', () => {
    expect(html).toContain('조작법');
    expect(html).toContain('더블탭');
    expect(html).toContain('더블클릭');
    expect(html).toContain('우클릭');
  });

  it('no longer mentions the removed Space and R keys anywhere in the player-facing text', () => {
    expect(html).not.toContain('Space');
    for (const f of [
      'src/pc/components/ArcadeOverlayHUD.tsx',
      'src/pc/components/TutorialGuideOverlay.tsx',
    ]) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src).not.toMatch(/\[Space|Space 키|Space로|R 키|R키/);
    }
    // 가이드는 GuideModal.tsx와 guide/ 폴더에 나뉘어 있으므로 합친 소스로 검사한다.
    expect(readGuideSource()).not.toMatch(/\[Space|Space 키|Space로|R 키|R키/);
  });
});

describe('lobby tutorial and guide buttons', () => {
  const defaultSlots = createInitialSlots();
  const defaultGate = getStartGate(defaultSlots);

  const render = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      React.createElement(QRPairingModal, {
        roomId: 'AB12',
        slots: defaultSlots,
        startGate: defaultGate,
        topRankings: [],
        onEditMouseNickname: () => {},
        onChooseInput: () => {},
        onSubmitMouseNickname: () => {},
        onStart: () => {},
        ...props,
      } as any)
    );

  it('shows both buttons side by side when both callbacks exist', () => {
    const html = render({ onStartTutorial: () => {}, onOpenGuide: () => {} });
    expect(html).toContain('튜토리얼 시작');
    expect(html).toContain('게임 가이드');
  });

  it('shows only the button that has a callback', () => {
    expect(render({ onOpenGuide: () => {} })).not.toContain('튜토리얼 시작');
    expect(render({ onStartTutorial: () => {} })).not.toContain('게임 가이드');
  });

  it('the guide modal no longer has its own tutorial button', () => {
    const src = readGuideSource();
    expect(src).not.toContain('showTutorialButton');
    expect(src).not.toContain('튜토리얼 플레이');
  });
});

describe('unsupported device notice chip', () => {
  const slots = createInitialSlots();
  const render = (unsupportedNotice?: string | null) =>
    renderToStaticMarkup(
      React.createElement(QRPairingModal, {
        roomId: 'AB12',
        slots,
        startGate: getStartGate(slots),
        topRankings: [],
        onEditMouseNickname: () => {},
        onChooseInput: () => {},
        onSubmitMouseNickname: () => {},
        onStart: () => {},
        unsupportedNotice,
      })
    );

  it('안내가 있으면 문구와 칩이 보인다', () => {
    const html = render('1P에 연결한 폰은 센서가 지원되지 않아요. 다른 폰으로 접속해 주세요');
    expect(html).toContain('data-testid="unsupported-notice-chip"');
    expect(html).toContain('다른 폰으로 접속해 주세요');
  });

  it('안내가 없거나 null이면 칩이 없다', () => {
    expect(render()).not.toContain('unsupported-notice-chip');
    expect(render(null)).not.toContain('unsupported-notice-chip');
  });
});
