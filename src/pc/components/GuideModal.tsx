import React, { useState } from 'react';
import { TARGET_SPECS, ITEM_BUFF_SPECS, WEAPON_ARCHETYPE_SPECS, REWARD_CARD_SPECS } from '../../shared/constants';
import { TargetKind, ItemBuffKind } from '../../shared/types';
import { GAME_TUNING } from '../../shared/gameTuning';
import { WeaponsTab } from './guide/WeaponsTab';
import { MonstersTab } from './guide/MonstersTab';
import { CardsTab } from './guide/CardsTab';
import { ItemsTab } from './guide/ItemsTab';
import { CoopTab } from './guide/CoopTab';

export interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'weapons' | 'monsters' | 'cards' | 'items' | 'coop';

export const GuideModal: React.FC<GuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('weapons');

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 15, 0.85)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        fontFamily: "'Noto Sans KR', 'Pretendard', sans-serif",
        color: '#ffffff',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '960px',
          maxWidth: '94vw',
          maxHeight: '92vh',
          background: 'linear-gradient(145deg, #131b2e, #0c111d)',
          border: '2px solid rgba(245, 158, 11, 0.5)',
          borderRadius: '24px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8), 0 0 40px rgba(245, 158, 11, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '22px 32px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '26px',
                fontWeight: 900,
                background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              📖 비어 크러셔 로그라이크 무기 & 기믹 도감
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
              3종 무기 & 스냅 액티브 스킬, 몬스터 5종 + 보스 3회(7웨이브), 9종 사격 선택 카드
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '20px',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Buttons */}
        <div
          style={{
            display: 'flex',
            padding: '12px 32px 0',
            gap: '10px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <button
            onClick={() => setActiveTab('weapons')}
            style={{
              background: activeTab === 'weapons' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'weapons' ? '3px solid #fbbf24' : '3px solid transparent',
              color: activeTab === 'weapons' ? '#fbbf24' : '#94a3b8',
              padding: '12px 18px',
              fontSize: '15px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            🔫 3종 무기 & 스킬 도감
          </button>
          <button
            onClick={() => setActiveTab('monsters')}
            style={{
              background: activeTab === 'monsters' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'monsters' ? '3px solid #fbbf24' : '3px solid transparent',
              color: activeTab === 'monsters' ? '#fbbf24' : '#94a3b8',
              padding: '12px 18px',
              fontSize: '15px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            👾 몬스터 도감 & 체력바
          </button>
          <button
            onClick={() => setActiveTab('cards')}
            style={{
              background: activeTab === 'cards' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'cards' ? '3px solid #fbbf24' : '3px solid transparent',
              color: activeTab === 'cards' ? '#fbbf24' : '#94a3b8',
              padding: '12px 18px',
              fontSize: '15px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            🃏 보상 카드 & 조작법
          </button>
          <button
            onClick={() => setActiveTab('items')}
            style={{
              background: activeTab === 'items' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'items' ? '3px solid #fbbf24' : '3px solid transparent',
              color: activeTab === 'items' ? '#fbbf24' : '#94a3b8',
              padding: '12px 18px',
              fontSize: '15px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            🍺 펍 아이템 버프
          </button>
          <button
            onClick={() => setActiveTab('coop')}
            style={{
              background: activeTab === 'coop' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'coop' ? '3px solid #fbbf24' : '3px solid transparent',
              color: activeTab === 'coop' ? '#fbbf24' : '#94a3b8',
              padding: '12px 18px',
              fontSize: '15px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            👥 2인팟 협동 모드
          </button>
        </div>

        {/* Tab Content Area */}
        <div
          style={{
            padding: '24px 32px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* TAB 1: 3 WEAPONS & SKILLS */}
          {activeTab === 'weapons' && <WeaponsTab />}

          {/* TAB 2: MONSTERS & GIMMICKS */}
          {activeTab === 'monsters' && <MonstersTab />}

          {/* TAB 3: CARDS & CONTROLS */}
          {activeTab === 'cards' && <CardsTab />}

          {/* TAB 4: ITEMS */}
          {activeTab === 'items' && <ItemsTab />}

          {/* TAB 5: CO-OP */}
          {activeTab === 'coop' && <CoopTab />}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 32px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            background: 'rgba(0, 0, 0, 0.25)',
          }}
        >

          <button
            onClick={onClose}
            style={{
              background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
              border: 'none',
              borderRadius: '12px',
              color: '#111827',
              fontWeight: 900,
              fontSize: '14px',
              padding: '10px 24px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
            }}
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
