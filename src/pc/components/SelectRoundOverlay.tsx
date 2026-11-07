import React, { useLayoutEffect, useRef } from 'react';
import { clampToViewport } from '../overlayClamp';
import type { PlayerIndex } from '../engine/PlayerCombatState';
import type { HudSnapshot } from '../hudSnapshot';
import type { PlayerPresentation } from '../playerPresentation';

export interface SelectRoundOverlayProps {
  selection: HudSnapshot['selection'];
  presentations: PlayerPresentation[];
  /** 카드 소유 배지를 카드 위에 띄우려고 엔진 표적의 화면 좌표를 받는다 */
  cardAnchors: { ownerIndex: PlayerIndex; leftPercent: number; topPercent: number }[];
}

export const SelectRoundOverlay: React.FC<SelectRoundOverlayProps> = ({
  selection,
  presentations,
  cardAnchors,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);

  // 카드 소유 배지는 카드 중심에 맞추되 화면 가장자리에서는 안쪽으로 민다.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const viewportW = root.clientWidth;
    root.querySelectorAll<HTMLElement>('[data-owner-badge]').forEach((el) => {
      const centerX = (Number(el.dataset.anchorPercent) / 100) * viewportW;
      el.style.left = `${clampToViewport(centerX, el.offsetWidth, viewportW)}px`;
    });
  });

  if (!selection || selection.kind === null) {
    return null;
  }

  // panelSide가 서로 다른 항목이 2개 이상일 때만 분할 화면(1인은 1개라 자연히 false)
  const isMultiSide =
    presentations.length >= 2 &&
    presentations.some((p) => p.panelSide === 'left') &&
    presentations.some((p) => p.panelSide === 'right');

  const doneCount = selection.done.filter(Boolean).length;
  const isPartialDone = doneCount > 0 && doneCount < selection.done.length;
  const doneIdx = selection.done.findIndex(Boolean);
  const waitingIdx = selection.done.findIndex((d) => !d);

  const donePres = doneIdx !== -1 ? presentations[doneIdx] : undefined;
  const waitingPres = waitingIdx !== -1 ? presentations[waitingIdx] : undefined;

  // 상단 배너 문구 계산
  let bannerTitle = '';
  let bannerSubtitle = '';

  if (isMultiSide) {
    if (isPartialDone && donePres && waitingPres) {
      const waitingLabel = waitingPres.slotLabel ?? `${waitingPres.index + 1}P`;
      const doneLabel = donePres.slotLabel ?? `${donePres.index + 1}P`;
      bannerTitle = `${waitingLabel} 선택 중 · ${doneLabel} 선택 완료`;
      bannerSubtitle = `${waitingLabel}가 고르면 게임이 ${
        selection.kind === 'weapon' ? '시작됩니다' : '다시 시작됩니다'
      }`;
    } else if (selection.kind === 'weapon') {
      bannerTitle = '각자 시작 무기를 쏴서 고르세요';
      bannerSubtitle = '내 색 십자선으로 내 카드만 맞힐 수 있어요';
    } else {
      bannerTitle = '보상 카드를 쏴서 고르세요';
      bannerSubtitle = '둘 다 고르면 게임이 다시 시작됩니다';
    }
  } else {
    if (selection.kind === 'weapon') {
      bannerTitle = '시작 무기를 쏴서 고르세요';
      bannerSubtitle = '카드를 맞히면 해당 무기로 게임이 시작됩니다';
    } else {
      bannerTitle = '보상 카드를 쏴서 고르세요';
      bannerSubtitle = '카드를 맞히면 강화 효과를 획득합니다';
    }
  }

  return (
    <div
      ref={rootRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 110,
        userSelect: 'none',
      }}
    >
      {/* 1. 좌우 절반 그라데이션 및 중앙 점선 (2인 이상일 때만) */}
      {isMultiSide && (
        <>
          <div
            data-testid="select-split-left"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '50%',
              height: '100%',
              background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.14), transparent)',
            }}
          />
          <div
            data-testid="select-split-right"
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: '50%',
              height: '100%',
              background: 'linear-gradient(270deg, rgba(255, 107, 61, 0.14), transparent)',
            }}
          />
          <div
            data-testid="select-split-divider"
            style={{
              position: 'absolute',
              left: '50%',
              top: '140px',
              bottom: '300px',
              width: 0,
              borderLeft: '2px dashed rgba(255, 255, 255, 0.35)',
              transform: 'translateX(-50%)',
            }}
          />
        </>
      )}

      {/* 2. 상단 안내 배너 */}
      <div
        data-testid="card-select-guide-banner"
        style={{
          position: 'absolute',
          top: '28px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 32px',
          borderRadius: '9999px',
          background: 'rgba(15, 23, 42, 0.92)',
          border: '2px solid #06b6d4',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        }}
      >
        <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.04em' }}>
          {bannerTitle}
        </span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.75)' }}>
          {bannerSubtitle}
        </span>
      </div>

      {/* 3. 먼저 완료한 쪽 절반 대기 상자 */}
      {isMultiSide && isPartialDone && donePres && (
        <div
          data-testid="select-done-box"
          style={{
            position: 'absolute',
            top: '48%',
            left: donePres.panelSide === 'left' ? '25%' : '75%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(17, 24, 39, 0.95)',
            border: `1.5px solid ${donePres.color}`,
            borderRadius: '16px',
            padding: '24px 32px',
            textAlign: 'center',
            boxShadow: `0 0 24px ${donePres.color}44`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            minWidth: '280px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {donePres.slotLabel && (
              <span
                style={{
                  background: donePres.color,
                  color: '#111',
                  fontWeight: 900,
                  fontSize: '12px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}
              >
                {donePres.slotLabel}
              </span>
            )}
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
              ✓ {selection.pickedLabels[doneIdx] ?? '선택 완료'} 선택 완료
            </span>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>
            {waitingPres?.slotLabel ?? '상대'} 선택을 기다리는 중…
          </span>
        </div>
      )}

      {/* 4. 카드 상단 1P / 2P 소유 배지 */}
      {cardAnchors.map((anchor, i) => {
        const pres = presentations[anchor.ownerIndex];
        if (!pres || !pres.slotLabel) return null;
        return (
          <div
            key={i}
            data-testid={`card-owner-badge-${pres.slotLabel}`}
            data-owner-badge
            data-anchor-percent={anchor.leftPercent}
            style={{
              position: 'absolute',
              left: `${anchor.leftPercent}%`,
              top: `calc(${anchor.topPercent}% - 22px)`,
              transform: 'translateY(-100%)',
              background: pres.color,
              color: '#111',
              fontSize: '13px',
              fontWeight: 900,
              padding: '2px 10px',
              borderRadius: '6px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
              letterSpacing: '0.5px',
            }}
          >
            {pres.slotLabel}
          </div>
        );
      })}
    </div>
  );
};
