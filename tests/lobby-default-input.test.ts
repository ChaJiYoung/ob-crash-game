import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { QRPairingModal } from '../src/pc/components/QRPairingModal';
import { createInitialSlots, createLobbySlots, chooseSlotInput, getStartGate } from '../src/pc/coopSlots';
import { LOBBY_INPUT_STORAGE_KEY, loadLastInput, saveLastInput } from '../src/pc/lobbyInputMemory';

const fakeStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

describe('lobby input memory (1P)', () => {
  it('defaults to mobile when nothing is saved or the value is wrong', () => {
    const s = fakeStorage();
    expect(loadLastInput(s)).toBe('mobile');
    s.setItem(LOBBY_INPUT_STORAGE_KEY, 'foo');
    expect(loadLastInput(s)).toBe('mobile');
    s.setItem(LOBBY_INPUT_STORAGE_KEY, '');
    expect(loadLastInput(s)).toBe('mobile');
  });

  it('round-trips mobile and mouse', () => {
    const s = fakeStorage();
    saveLastInput('mouse', s);
    expect(loadLastInput(s)).toBe('mouse');
    saveLastInput('mobile', s);
    expect(loadLastInput(s)).toBe('mobile');
    expect(s.getItem(LOBBY_INPUT_STORAGE_KEY)).toBe('mobile');
  });

  it('never throws when the storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadLastInput(blocked)).toBe('mobile');
    expect(() => saveLastInput('mouse', blocked)).not.toThrow();
  });
});

describe('createLobbySlots', () => {
  it('preselects 1P and leaves 2P empty', () => {
    const mobile = createLobbySlots('mobile');
    expect(mobile[0].input).toBe('mobile');
    expect(mobile[1].input).toBeNull();
    expect(mobile[0].isZeroCalibrated).toBe(false);
    const mouse = createLobbySlots('mouse');
    expect(mouse[0].input).toBe('mouse');
    expect(mouse[1].input).toBeNull();
    expect(chooseSlotInput(mouse, 2, 'mouse').rejected).toBe('MOUSE_TAKEN');
  });

  it('createInitialSlots keeps its contract: both slots empty', () => {
    const s = createInitialSlots();
    expect(s[0].input).toBeNull();
    expect(s[1].input).toBeNull();
  });

  it('a mobile 1P lobby shows the QR area and only one empty slot card', () => {
    const slots = createLobbySlots('mobile');
    const html = renderToStaticMarkup(
      React.createElement(QRPairingModal, {
        roomId: 'TEST_ROOM',
        slots,
        startGate: getStartGate(slots),
        topRankings: [],
        onEditMouseNickname: () => {},
        onChooseInput: () => {},
        onSubmitMouseNickname: () => {},
        onStart: () => {},
      })
    );
    // QR 이미지는 비동기로 만들어져서 정적 렌더에는 '생성 중' 문구가 보인다.
    expect(html.includes('Slot 1 QR Code') || html.includes('QR 생성 중')).toBe(true);
    expect(html.match(/비어 있음/g)).toHaveLength(1);
  });
});
