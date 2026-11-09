import React from 'react';
import { PLAYER_COLORS } from '../../shared/constants';
import type { LobbyNextAction, LobbyStepState } from '../lobbyGuide';

export interface LobbyNextStepBannerProps {
  action: LobbyNextAction;
}

const STATE_STYLE: Record<LobbyStepState, { color: string; border: string; bg: string }> = {
  done: { color: '#4ade80', border: 'rgba(74, 222, 128, 0.5)', bg: 'rgba(74, 222, 128, 0.08)' },
  active: { color: '#fbbf24', border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.16)' },
  todo: { color: '#64748b', border: 'rgba(100, 116, 139, 0.4)', bg: 'transparent' },
};

/** 로비 위쪽의 "지금 할 일" 배너: 플레이어(1P/2P)마다 한 줄씩 단계 뱃지를 보여 준다. */
export const LobbyNextStepBanner: React.FC<LobbyNextStepBannerProps> = ({ action }) => (
  <div
    data-testid="lobby-next-step"
    style={{
      width: '100%',
      boxSizing: 'border-box',
      marginBottom: '16px',
      padding: '10px 16px',
      borderRadius: '14px',
      background: 'rgba(15, 23, 42, 0.65)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: '6px',
    }}
  >
    {action.rows.map((row) => (
      <div
        key={row.slot}
        data-testid={`lobby-row-${row.slot}`}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}
      >
        <span
          style={{
            minWidth: '64px',
            textAlign: 'center',
            padding: '3px 10px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 900,
            color: '#ffffff',
            backgroundColor: PLAYER_COLORS[row.slot],
            opacity: row.optional ? 0.7 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {row.label}
        </span>
        {row.steps.map((step, i) => {
          const st = STATE_STYLE[step.state];
          return (
            <React.Fragment key={step.id}>
              {i > 0 && <span style={{ color: '#475569', fontWeight: 900 }}>›</span>}
              <span
                data-testid={`lobby-step-${row.slot}-${step.id}`}
                data-state={step.state}
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  border: `1.5px solid ${st.border}`,
                  background: st.bg,
                  color: st.color,
                  fontSize: '12px',
                  fontWeight: step.state === 'active' ? 900 : 700,
                  whiteSpace: 'nowrap',
                }}
              >
                {step.state === 'done' ? '✓ ' : `${i + 1}. `}
                {step.label}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    ))}
  </div>
);
