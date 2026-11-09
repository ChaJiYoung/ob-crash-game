import React from 'react';
import type { LobbyNextAction, LobbyStepState } from '../lobbyGuide';

export interface LobbyNextStepBannerProps {
  action: LobbyNextAction;
}

const STATE_STYLE: Record<LobbyStepState, { color: string; border: string; bg: string }> = {
  done: { color: '#4ade80', border: 'rgba(74, 222, 128, 0.5)', bg: 'rgba(74, 222, 128, 0.08)' },
  active: { color: '#fbbf24', border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.16)' },
  todo: { color: '#64748b', border: 'rgba(100, 116, 139, 0.4)', bg: 'transparent' },
};

/** 로비 위쪽의 "지금 할 일" 배너: 단계 줄과 큰 글씨 한 문장. 한 줄 높이에 가깝게 유지한다. */
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
      alignItems: 'center',
      gap: '16px',
      flexWrap: 'wrap',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {action.steps.map((step, i) => {
        const st = STATE_STYLE[step.state];
        return (
          <React.Fragment key={step.id}>
            {i > 0 && <span style={{ color: '#475569', fontWeight: 900 }}>›</span>}
            <span
              data-testid={`lobby-step-${step.id}`}
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
    <div style={{ flex: 1, minWidth: '240px' }}>
      <div data-testid="lobby-next-headline" style={{ fontSize: '17px', fontWeight: 900, color: '#fbbf24' }}>
        {action.headline}
      </div>
      {action.detail && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{action.detail}</div>}
    </div>
  </div>
);
