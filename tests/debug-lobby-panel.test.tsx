import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DebugLobbyPanel, formatDebugRunReach, stepDebugCard } from '../src/pc/components/DebugLobbyPanel';
import { QRPairingModal } from '../src/pc/components/QRPairingModal';
import { createInitialSlots } from '../src/pc/coopSlots';
import { getStartGate } from '../src/pc/coopSlots';
import { presetForStart } from '../src/pc/debug/debugMode';
import type { DebugRunEntry } from '../src/shared/types';

const run = (over: Partial<DebugRunEntry> = {}): DebugRunEntry => ({
  gameId: 7, mode: 'solo', endedAt: '2026-11-17T00:00:00Z', outcome: 'VICTORY', totalScore: 12345, waveReached: 10,
  damageTaken: 6, config: presetForStart('EX'), waves: [{ wave: 8, damageTaken: 2 }],
  members: [{ slot: 1, nickname: '테스터', weaponKind: 'gatling', score: 12345 }],
  ...over,
});

const panel = (props: Partial<React.ComponentProps<typeof DebugLobbyPanel>> = {}) =>
  renderToStaticMarkup(
    <DebugLobbyPanel config={presetForStart('W6')} onChangeConfig={() => {}} runs={[]} onRequestRuns={() => {}} {...props} />,
  );

describe('DebugLobbyPanel', () => {
  it('formatDebugRunReach', () => {
    expect(formatDebugRunReach(7)).toBe('W7');
    expect(formatDebugRunReach(10)).toBe('DANGER 3');
  });

  it('stepDebugCard는 0..상한을 넘지 않는다', () => {
    const w1 = presetForStart('W1');
    expect(stepDebugCard(w1, 'damage_up', -1)).toBe(w1);
    const ex = presetForStart('EX');
    expect(stepDebugCard(ex, 'hit_zone_up', 1)).toBe(ex);
    expect(stepDebugCard(w1, 'hit_zone_up', 1).cards.hit_zone_up).toBe(1);
  });

  it('시작 조건 탭: 현재 값과 상한을 보여준다', () => {
    const html = panel();
    expect(html).toContain('debug-start-W6');
    expect(html).toContain('2/3');
    expect(html).not.toContain('EX는 MAX 고정');
  });

  it('EX면 레벨·카드가 비활성', () => {
    const html = panel({ config: presetForStart('EX') });
    expect(html).toContain('EX는 MAX 고정');
    expect(html).toMatch(/data-testid="debug-level-1"[^>]*disabled=""|disabled=""[^>]*data-testid="debug-level-1"/);
  });

  it('최근 기록 탭: 로딩·빈·데이터', () => {
    expect(panel({ initialTab: 'records', runs: null })).toContain('불러오는 중');
    expect(panel({ initialTab: 'records', runs: [] })).toContain('디버그 기록 없음');
    const html = panel({ initialTab: 'records', runs: [run()] });
    expect(html).toContain('12,345점');
    expect(html).toContain('DANGER 3');
    expect(html).toContain('피격 6');
    expect(html).toContain('개틀링');
    expect(html).toContain('시작 EX');
  });
});

describe('QRPairingModal debugPanel', () => {
  const render = (debugPanel?: React.ReactNode) => {
    const slots = createInitialSlots();
    return renderToStaticMarkup(
      <QRPairingModal
        roomId="ROOM" slots={slots} startGate={getStartGate(slots)} topRankings={[]}
        onEditMouseNickname={() => {}} onChooseInput={() => {}} onSubmitMouseNickname={() => {}} onStart={() => {}}
        debugPanel={debugPanel}
      />,
    );
  };
  it('debugPanel이 있으면 랭킹 대신 패널과 배지', () => {
    const html = render(<div>PANEL</div>);
    expect(html).toContain('PANEL');
    expect(html).toContain('DEBUG MODE · 랭킹 미등록');
    expect(html).not.toContain('개인 랭킹');
  });
  it('없으면 기존 랭킹', () => {
    const html = render();
    expect(html).toContain('개인 랭킹');
    expect(html).not.toContain('DEBUG MODE');
  });
});
