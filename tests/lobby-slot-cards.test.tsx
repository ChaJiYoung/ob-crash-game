import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { QRPairingModal } from '../src/pc/components/QRPairingModal';
import {
  createInitialSlots,
  createLobbySlots,
  chooseSlotInput,
  updateSlot,
  getStartGate,
} from '../src/pc/coopSlots';

describe('lobby slot cards UI (P04-T03)', () => {
  it('renders two empty slot cards and player connect notice when both slots are empty', () => {
    const slots = createInitialSlots();
    const startGate = getStartGate(slots);

    const html = renderToStaticMarkup(
      <QRPairingModal
        roomId="TEST_ROOM"
        slots={slots}
        startGate={startGate}
        topRankings={[]}
        onEditMouseNickname={() => {}}
        onChooseInput={() => {}}
        onSubmitMouseNickname={() => {}}
        onStart={() => {}}
      />
    );

    // Should contain "비어 있음" twice (1P and 2P)
    const matches = html.match(/비어 있음/g);
    expect(matches).toHaveLength(2);

    // Disabled start button that carries the overall status
    expect(html).toContain('data-testid="lobby-start-button"');
    expect(html).toContain('(플레이어를 연결하세요)');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('data-shootable="start"');
    expect(html).not.toContain('▶');
  });

  it('renders 1P ready mouse, 2P mobile waiting with slot=2 QR and 2P mouse disabled', () => {
    let slots = createInitialSlots();
    // 1P mouse joined
    slots = chooseSlotInput(slots, 1, 'mouse').slots;
    slots = updateSlot(slots, 1, {
      player: {
        deviceId: 'dev_m',
        nickname: '마우스선수',
        bestScore: 0,
        totalGames: 1,
        lastPlayedAt: '2026-11-07T00:00:00.000Z',
      },
    });

    // 2P mobile chosen but not connected yet
    slots = chooseSlotInput(slots, 2, 'mobile').slots;
    const startGate = getStartGate(slots);

    const html = renderToStaticMarkup(
      <QRPairingModal
        roomId="TEST_ROOM"
        lanIp="192.168.0.5"
        slots={slots}
        startGate={startGate}
        topRankings={[]}
        onEditMouseNickname={() => {}}
        onChooseInput={() => {}}
        onSubmitMouseNickname={() => {}}
        onStart={() => {}}
      />
    );

    // 1P has ready status
    expect(html).toContain('마우스선수 · 마우스로 플레이');
    expect(html).toContain('닉네임 변경');
    expect(html).toContain('data-testid="mouse-nickname-edit-1"');
    expect(html).toContain('● 준비 완료');

    // 2P waiting status is optional because 1P is already ready; the start button works without 2P
    expect(html).toContain('● 스마트폰 연결 대기 (선택)');
    expect(html).not.toContain('● 스마트폰 연결 대기 중…');
    expect(html).toContain('slot=2');
    expect(html).toContain('data-shootable="start"');
    expect(html).toContain('(2P 없이 1인 시작)');
  });

  it('renders waiting chip when 2P is joined but not ready (zero not calibrated)', () => {
    let slots = createInitialSlots();
    slots = chooseSlotInput(slots, 1, 'mouse').slots;
    slots = updateSlot(slots, 1, {
      player: {
        deviceId: 'dev_m',
        nickname: '마우스선수',
        bestScore: 0,
        totalGames: 1,
        lastPlayedAt: '2026-11-07T00:00:00.000Z',
      },
    });

    slots = chooseSlotInput(slots, 2, 'mobile').slots;
    slots = updateSlot(slots, 2, {
      player: {
        deviceId: 'dev_phone2',
        nickname: '폰선수2',
        bestScore: 0,
        totalGames: 1,
        lastPlayedAt: '2026-11-07T00:00:00.000Z',
      },
      isConnected: true,
      isZeroCalibrated: false,
    });

    const startGate = getStartGate(slots);
    expect(startGate.canStart).toBe(false);
    expect(startGate.waitingSlots).toEqual([2]);

    const html = renderToStaticMarkup(
      <QRPairingModal
        roomId="TEST_ROOM"
        lanIp="192.168.0.5"
        slots={slots}
        startGate={startGate}
        topRankings={[]}
        onEditMouseNickname={() => {}}
        onChooseInput={() => {}}
        onSubmitMouseNickname={() => {}}
        onStart={() => {}}
      />
    );

    // Waiting chip
    expect(html).toContain('(2P 준비 중…)');
    expect(html).toContain('data-enabled="false"');
    expect(html).not.toContain('data-shootable="start"');
    expect(html).not.toContain('(선택)');
  });

  it('renders start button when only 1P is joined and ready', () => {
    let slots = createInitialSlots();
    slots = chooseSlotInput(slots, 1, 'mouse').slots;
    slots = updateSlot(slots, 1, {
      player: {
        deviceId: 'dev_m',
        nickname: '솔로선수',
        bestScore: 0,
        totalGames: 1,
        lastPlayedAt: '2026-11-07T00:00:00.000Z',
      },
    });

    const startGate = getStartGate(slots);
    expect(startGate.canStart).toBe(true);

    const html = renderToStaticMarkup(
      <QRPairingModal
        roomId="TEST_ROOM"
        slots={slots}
        startGate={startGate}
        topRankings={[]}
        onEditMouseNickname={() => {}}
        onChooseInput={() => {}}
        onSubmitMouseNickname={() => {}}
        onStart={() => {}}
      />
    );

    // Start button rendered
    expect(html).toContain('data-shootable="start"');
    expect(html).toContain('게임 시작');
    expect(html).toContain('(클릭으로 시작)');
  });

  it('keeps the orange "waiting" status on both cards while 1P is not ready yet', () => {
    const slots = createLobbySlots('mobile');
    const html = renderToStaticMarkup(
      <QRPairingModal
        roomId="TEST_ROOM"
        slots={slots}
        startGate={getStartGate(slots)}
        topRankings={[]}
        onEditMouseNickname={() => {}}
        onChooseInput={() => {}}
        onSubmitMouseNickname={() => {}}
        onStart={() => {}}
      />
    );
    expect(html.match(/● 스마트폰 연결 대기 중…/g)).toHaveLength(2);
    expect(html).not.toContain('(선택)');
  });

  it('shows the per-player next-step banner for the default mobile lobby', () => {
    const slots = createLobbySlots('mobile');
    const html = renderToStaticMarkup(
      <QRPairingModal
        roomId="TEST_ROOM"
        slots={slots}
        startGate={getStartGate(slots)}
        topRankings={[]}
        onEditMouseNickname={() => {}}
        onChooseInput={() => {}}
        onSubmitMouseNickname={() => {}}
        onStart={() => {}}
      />
    );
    expect(html).toContain('data-testid="lobby-next-step"');
    expect(html).toContain('data-testid="lobby-step-1-connect" data-state="active"');
    expect(html).toContain('data-testid="lobby-step-2-connect" data-state="active"');
    expect(html).not.toContain('lobby-next-headline');
  });

  it('a player-less 2P that lost its socket still reads as waiting, a paired one reads as dropped', () => {
    const render = (slots: ReturnType<typeof createLobbySlots>) =>
      renderToStaticMarkup(
        <QRPairingModal
          roomId="TEST_ROOM"
          slots={slots}
          startGate={getStartGate(slots)}
          topRankings={[]}
          onEditMouseNickname={() => {}}
          onChooseInput={() => {}}
          onSubmitMouseNickname={() => {}}
          onStart={() => {}}
        />
      );
    const unregistered = updateSlot(createLobbySlots('mobile'), 2, { isConnected: false });
    expect(render(unregistered)).not.toContain('● 연결 끊김');
    const paired = updateSlot(createLobbySlots('mobile'), 2, {
      isConnected: false,
      player: { deviceId: 'p2', nickname: '폰2', bestScore: 0, totalGames: 0, lastPlayedAt: '2026-11-07T00:00:00.000Z' },
    });
    expect(render(paired)).toContain('● 연결 끊김');
  });

  describe('tutorial button follows the start button', () => {
    const render = (slots: ReturnType<typeof createLobbySlots>) =>
      renderToStaticMarkup(
        <QRPairingModal
          roomId="TEST_ROOM"
          slots={slots}
          startGate={getStartGate(slots)}
          topRankings={[]}
          onEditMouseNickname={() => {}}
          onChooseInput={() => {}}
          onSubmitMouseNickname={() => {}}
          onStart={() => {}}
          onStartTutorial={() => {}}
          onOpenGuide={() => {}}
        />
      );
    const profile = (id: string) => ({ deviceId: id, nickname: id, bestScore: 0, totalGames: 0, lastPlayedAt: '2026-11-07T00:00:00.000Z' });

    it('is disabled with a reason while nobody is connected', () => {
      const html = render(createLobbySlots('mobile'));
      expect(html).toContain('data-testid="lobby-tutorial-button" data-enabled="false"');
      expect(html).toContain('튜토리얼 시작 (기기 연결 후 가능)');
    });

    it('is enabled once the start button is enabled, even with 2P not connected', () => {
      const slots = updateSlot(createLobbySlots('mobile'), 1, { player: profile('p1'), isConnected: true, isZeroCalibrated: true });
      const html = render(slots);
      expect(html).toContain('data-testid="lobby-tutorial-button" data-enabled="true"');
      expect(html).not.toContain('(기기 연결 후 가능)');
    });

    it('is disabled again while a joined 2P is still zeroing', () => {
      let slots = updateSlot(createLobbySlots('mobile'), 1, { player: profile('p1'), isConnected: true, isZeroCalibrated: true });
      slots = updateSlot(slots, 2, { player: profile('p2'), isConnected: true });
      expect(render(slots)).toContain('data-testid="lobby-tutorial-button" data-enabled="false"');
    });
  });
});
