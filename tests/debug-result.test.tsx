import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResultRankingModal } from '../src/pc/components/ResultRankingModal';
import { PauseMenuOverlay } from '../src/pc/components/PauseMenuOverlay';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';
import { buildDebugResultInfo, presetForStart } from '../src/pc/debug/debugMode';

const result = (debugInfo?: React.ComponentProps<typeof ResultRankingModal>['debugInfo']) =>
  renderToStaticMarkup(
    <ResultRankingModal gamePhase="GAMEOVER" score={100} maxCombo={1} kills={1} waveReached={3} rankings={[]}
      onRestart={() => {}} onReturnToLobby={() => {}} debugInfo={debugInfo} />,
  );

describe('ResultRankingModal debugInfo', () => {
  it('배지와 피격 상세', () => {
    const html = result({ damageTaken: 5, waves: [{ label: 'W1', damageTaken: 0 }, { label: 'DANGER 2', damageTaken: 3 }] });
    expect(html).toContain('DEBUG · 랭킹 미등록');
    expect(html).toContain('피격 총 5');
    expect(html).toContain('DANGER 2 · 3');
    expect(html).toContain('W1 · 0');
  });
  it('없으면 배지 없음', () => {
    expect(result()).not.toContain('DEBUG');
  });
});

describe('debug run end', () => {
  it('endDebugRun은 디버그 판만 끝내고 결과 상세를 만든다', () => {
    const e: any = new BeerCrusherEngine();
    e.startGame({ withWeaponSelect: false });
    expect(e.endDebugRun()).toBe(false);
    expect(e.gamePhase).toBe('PLAYING');

    e.debugInvincible = true;
    e.debugStart = presetForStart('EX');
    e.startGame({ withWeaponSelect: true });
    for (const p of e.players) {
      const t = e.activeTargets.find((x: any) => !!x.weaponSelectKind && x.ownerIndex === p.index);
      const aim = e.computeTargetAimCoords(t, 1.0, p.index);
      e.shootCardSelect(aim.targetNormX, aim.targetNormY, 1000, p.index);
    }
    expect(e.endDebugRun()).toBe(true);
    expect(e.gamePhase).toBe('GAMEOVER');
    const stats = e.getPlayRunStats(0);
    expect(stats.outcome).toBe('VICTORY');
    const info = buildDebugResultInfo(e);
    expect(info.waves.map((w) => w.label)).toContain('DANGER 1');
  });

  it('일시정지 메뉴는 onEndDebugRun이 있을 때만 버튼을 보인다', () => {
    const base = {
      reason: 'USER' as const, isControllerConnected: true, onResume: () => {}, onRestart: () => {},
      isExitConfirmOpen: false, onRequestExit: () => {}, onCancelExit: () => {}, onConfirmExit: () => {},
    };
    expect(renderToStaticMarkup(<PauseMenuOverlay {...base} onEndDebugRun={() => {}} />)).toContain('디버그 판 종료');
    expect(renderToStaticMarkup(<PauseMenuOverlay {...base} />)).not.toContain('디버그 판 종료');
  });
});
