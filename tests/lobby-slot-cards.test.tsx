import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { QRPairingModal } from '../src/pc/components/QRPairingModal';
import {
  createInitialSlots,
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

    // No start button
    expect(html).not.toContain('▶');
    expect(html).not.toContain('게임 시작');

    // Waiting notice
    expect(html).toContain('플레이어를 연결하세요');
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

    // 2P waiting status and slot=2 in url
    expect(html).toContain('● 스마트폰 연결 대기 중…');
    expect(html).toContain('slot=2');
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
    expect(html).toContain('2P 준비 중');
    expect(html).not.toContain('data-shootable="start"');
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
  });

  it('shows the next-step banner with the active step for a mobile 1P lobby', () => {
    const slots = chooseSlotInput(createInitialSlots(), 1, 'mobile').slots;
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
    expect(html).toContain('data-testid="lobby-step-connect" data-state="active"');
    expect(html).toContain('폰으로 QR을 스캔하세요');
  });
});
