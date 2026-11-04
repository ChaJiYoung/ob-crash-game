import React, { useState } from 'react';
import { TARGET_SPECS, ITEM_BUFF_SPECS, WEAPON_ARCHETYPE_SPECS, REWARD_CARD_SPECS } from '../../shared/constants';
import { TargetKind, ItemBuffKind } from '../../shared/types';

export interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTutorial?: () => void;
  showTutorialButton?: boolean;
}

type TabType = 'weapons' | 'monsters' | 'cards' | 'items';

const MONSTER_DETAILS: Record<
  TargetKind,
  {
    role: string;
    speedText: string;
    description: string;
    tip: string;
    imageSrc?: string;
  }
> = {
  pilgood: {
    role: '공중 유영형 · S자 회피 비행 (1HP)',
    speedText: '2.6 m/s',
    description: '부드러운 곡선 S자 유영 궤적으로 좌우로 흔들리며 날아오는 고래 캐릭터 알루미늄 캔.',
    tip: '체력 1이므로 곡선 유영 중심을 예측 조준하여 신속하게 요격하세요.',
    imageSrc: '/docs/screens/monster-01-pilgood.png',
  },
  caslight: {
    role: '공중 비행형 · 날개 펄럭임 & 고속 회피 (1HP)',
    speedText: '2.4 m/s',
    description: '양 측면 반투명 시안 날개를 펄럭이며 날렵한 곡선 지그재그 궤적으로 날아오는 라이트 캔.',
    tip: '체력 1! 지상 표적보다 조준선을 약간 높여 공중 회피 각도로 조준하세요.',
    imageSrc: '/docs/screens/monster-02-caslight.png',
  },
  obi: {
    role: '지상 바운스 · 랄라베어 정통 보병 (2HP)',
    speedText: '1.9 m/s',
    description: '왕관을 쓴 오비 랄라베어 마스코트가 그려진 앰버 골드 캔. 바닥을 안정적으로 전진합니다.',
    tip: '체력 2! 머리 위에 100% 연속 슬림 체력바가 표시됩니다. 2연타 사격이나 샷건 산탄으로 제압하세요.',
    imageSrc: '/docs/screens/monster-03-obi.png',
  },
  hanmac: {
    role: '지상 돌진형 · 버서커 가속 & 투사체 발사 (3HP)',
    speedText: '2.0 m/s',
    description: '100% 국산 쌀 벼 이삭 크레스트가 새겨진 딥 에메랄드 캔. 3HP로 강화되었습니다.',
    tip: '피격 시 분노하여 속도가 30% 증가하며, 전방으로 거품 투사체를 날립니다! 투사체를 요격하고 처치하세요.',
    imageSrc: '/docs/screens/monster-04-hanmac.png',
  },
  bottle: {
    role: '지상 대형 탱커 · 카스 500ml 투명병 (4HP)',
    speedText: '1.5 m/s',
    description: '2.45배 대형화된 압도적 크기와 좌우 통통 튀며 바운스 전진하는 4HP 엘리트 탱커.',
    tip: '체력 4! 100% 연속 슬림 체력바를 확인하며 관통 리볼버나 샷건 넉백을 적극 활용하세요.',
    imageSrc: '/docs/screens/monster-05-cass-bottle.png',
  },
  boss: {
    role: '최종 레이드 보스 · 업소용 냉각기 (60HP)',
    speedText: '0.85 m/s (10m 안전 정지)',
    description: '스테인리스 캐비닛, 듀얼 골드 탭, 디지털 온도계를 장착한 60HP 보스. 방어선 전방 10m에 안전 정지하며 탭 레버를 당겨 부하 맥주 미니웨이브를 주기적으로 소환합니다.',
    tip: '전방 10m에 멈추므로 방어선 즉사는 없습니다! 탭 레버 액션과 함께 소환되는 부하들을 처치해 아이템과 피버를 얻고 4초 피버 2배 난사로 보스를 격파하세요. 보스 격파 시 즉시 승리합니다!',
    imageSrc: '/docs/screens/monster-06-boss-dispenser.png',
  },
};

const ITEM_DETAILS: Record<
  ItemBuffKind,
  {
    role: string;
    durText: string;
    effectText: string;
    tip: string;
    imageSrc?: string;
  }
> = {
  power_shot: {
    role: '황금 병따개 소품',
    durText: '8초 지속',
    effectText: '사격 공격력 2배 증폭 (라거 원샷 원킬, 보스 폭딜)',
    tip: '생맥주 탭 건이 황금 골든 캐논으로 진화하며 붉은 레이저가 발사됩니다.',
    imageSrc: '/docs/screens/item-01-power-shot.png',
  },
  wide_scope: {
    role: '오비 맥주 코스터 소품',
    durText: '8초 지속',
    effectText: '조준경 88px ➔ 140px (1.6배) 확대 & 판정 반경 1.6배',
    tip: '모든 몬스터 머리 위에 홀로그램 록온 마커가 점등되어 PERFECT 판정이 쉬워집니다.',
    imageSrc: '/docs/screens/item-02-wide-scope.png',
  },
  ice_freeze: {
    role: '은색 얼음 버킷 소품',
    durText: '8초 지속',
    effectText: '전장에 출현한 모든 몬스터 이동속도 50% 감속 (Slow)',
    tip: '몬스터가 서리 틴트(하늘색)로 결빙되고 발밑에 회전 얼음 링이 생깁니다.',
    imageSrc: '/docs/screens/item-03-ice-freeze.png',
  },
  bar_repair: {
    role: '초록 홉 열매 다발 소품',
    durText: '즉시 발동',
    effectText: '바 방어선 체력 +1 즉시 회복 (최대 5개 맥주잔)',
    tip: '방어선에 닿으면 에메랄드 치유 펄스 파동이 바 전체로 퍼져나갑니다.',
    imageSrc: '/docs/screens/item-04-bar-repair.png',
  },
};

export const GuideModal: React.FC<GuideModalProps> = ({
  isOpen,
  onClose,
  onStartTutorial,
  showTutorialButton = true,
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
              3종 무기 & 스냅 액티브 스킬, 6종 몬스터 체력바 & 요격 기믹, 사격 선택 카드
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
          {activeTab === 'weapons' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Accuracy Damage Multiplier & No-Miss Arcade Banner */}
              <div
                style={{
                  background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.18), rgba(56, 189, 248, 0.18))',
                  border: '1.5px solid #fbbf24',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#fbbf24' }}>
                  🎯 명중 정밀도 데미지 배율 & 노-미스(No-Miss) 아케이드 판정
                </div>
                <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: '1.6' }}>
                  • <strong>PERFECT (중심 75% 이내):</strong> <strong>1.5배 데미지</strong> 폭딜 (+150 PTS & 피버 +8% 충전)<br />
                  • <strong>GREAT (중심 100% 이내):</strong> <strong>1.0배 정타 데미지</strong> (+100 PTS) — 1레벨 모든 무기로 기본 캔(1HP) 원샷 제압!<br />
                  • <strong>GOOD (외곽 125% 이내):</strong> <strong>0.8배 스침 데미지</strong> (+50 PTS) — 스쳐 살아남은 캔은 머리 위에 잔여 체력바가 즉시 표시됩니다.<br />
                  • <strong>MISS 페널티 완전 폐지:</strong> 빗나가도 콤보 초기화 페널티 없이 호쾌하고 통쾌하게 난사할 수 있습니다!
                </div>
              </div>

              {/* Shotgun */}
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1.5px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '28px' }}>🪠</span>
                    <div>
                      <span style={{ fontSize: '18px', fontWeight: 900, color: '#ef4444' }}>
                        맥주관 뚫어뻥 샷건 (Shotgun)
                      </span>
                      <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '8px' }}>
                        근접 산탄 폭딜 & 넉백 밀쳐내기
                      </span>
                    </div>
                  </div>
                  <span
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    근접 산탄
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>
                  • <strong>외형 진화:</strong> 리얼 고무 벨 뚫어뻥 장착 ➔ Lv.2 듀얼 고압관 ➔ Lv.3 호박색 맥주관 순환 ➔ Lv.4 쿼드 배럴 + 둔화 파동<br />
                  • <strong>성능:</strong> Lv.1(0.35×3=1.05 DMG) ➔ Lv.2(1.60 DMG + 0.3m 넉백) ➔ Lv.3(2.50 DMG) ➔ MAX(0.60×6=3.60 DMG + 둔화)<br />
                  • <strong>⚡ 전용 액티브 스킬 [사방 뚫어뻥 폭풍]:</strong> 총구를 위로 '휙!' 젖히면 화면 8방향에서 12~22개의 미니 뚫어뻥이 포물선으로 날아가 몬스터를 1.0~2.0초간 부착 기절(Stun)시킵니다! (빗나간 탄은 바닥에서 통통 튕김)
                </div>
              </div>

              {/* Revolver */}
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1.5px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '28px' }}>🍾</span>
                    <div>
                      <span style={{ fontSize: '18px', fontWeight: 900, color: '#fbbf24' }}>
                        황금 병따개 리볼버 (Revolver)
                      </span>
                      <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '8px' }}>
                        초정밀 일직선 관통탄 & 불릿 타임
                      </span>
                    </div>
                  </div>
                  <span
                    style={{
                      background: '#f59e0b',
                      color: '#111827',
                      fontWeight: 800,
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    일직선 관통
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>
                  • <strong>외형 진화:</strong> 병따개 해머 & 실린더 ➔ Lv.2 롱배럴 ➔ Lv.3 시안 네온 레이저 스코프 ➔ Lv.4 4각 머즐 브레이크<br />
                  • <strong>성능:</strong> Lv.1(1.00 DMG + 후열 1체 관통) ➔ Lv.2(1.35 DMG) ➔ Lv.3(1.75 DMG + 2체 관통) ➔ MAX(2.20 DMG + 100% 2관통)<br />
                  • <strong>⚡ 전용 액티브 스킬 [오프너 불릿 타임 & 참격]:</strong> 거대한 황금 병따개 블레이드가 전방을 회전하며 모든 몬스터를 베고 지나가며, 3.5~5.0초간 전장을 40~60% 슬로우 모션 상태로 만듭니다.
                </div>
              </div>

              {/* Gatling */}
              <div
                style={{
                  background: 'rgba(6, 182, 212, 0.08)',
                  border: '1.5px solid rgba(6, 182, 212, 0.4)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '28px' }}>🍺</span>
                    <div>
                      <span style={{ fontSize: '18px', fontWeight: 900, color: '#06b6d4' }}>
                        탄산 탭 개틀링 (Gatling)
                      </span>
                      <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '8px' }}>
                        초고속 탄산 기포 난사 & 160도 거품 해일
                      </span>
                    </div>
                  </div>
                  <span
                    style={{
                      background: '#06b6d4',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    초고속 연사
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>
                  • <strong>외형 진화:</strong> 6총열 묶음 ➔ Lv.2 카스 블루 냉각 재킷 ➔ Lv.3 듀얼 탄산 드럼통 ➔ Lv.4 12총열 아크 스파크<br />
                  • <strong>성능:</strong> Lv.1(0.25 DMG, 12발, 150ms) ➔ Lv.2(0.32 DMG, 16발) ➔ Lv.3(0.40 DMG, 20발) ➔ MAX(0.50 DMG, 24발, 83ms)<br />
                  • <strong>⚡ 전용 액티브 스킬 [거품 해일 160도 오버히트]:</strong> 160도 부채꼴 각도로 반투명 거품 해일이 밀려나가며 전방의 모든 몬스터를 1.0~1.4m 뒤로 밀어내고 둔화시킵니다.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MONSTERS & GIMMICKS */}
          {activeTab === 'monsters' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Special Gimmicks Banner */}
              <div
                style={{
                  background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.15), rgba(56, 189, 248, 0.15))',
                  border: '1.5px solid #fbbf24',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#fbbf24' }}>
                  ✨ 전장 특수 기믹 & 체력바 시스템
                </div>
                <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: '1.6' }}>
                  • <strong>100% 비례 슬림 게이지 체력바:</strong> 모든 몬스터는 100% 비례 연속 게이지 바로 체력이 표시됩니다. 1HP 캔(필굿, 카스라이트)도 스쳐 맞았을 때(hp &lt; maxHp) 즉시 머리 위에 잔여 체력바가 나타납니다!<br />
                  • <strong>🌟 황금 캔 (보너스 타겟):</strong> 웨이브마다 1회 원경을 고속 횡단! 격추 시 +500점 및 액티브 스킬과 피버 게이지가 즉시 100% 충전됩니다.<br />
                  • <strong>🫧 거품/병뚜껑 투사체 요격:</strong> 한맥과 보스가 플레이어를 향해 날리는 투사체를 공중에서 사격하여 격추하세요! 방어선 통과 시 바 생명이 1 차감됩니다.
                </div>
              </div>

              {/* Monster Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '16px',
                }}
              >
                {Object.entries(MONSTER_DETAILS).map(([k, detail]) => {
                  const spec = TARGET_SPECS[k as TargetKind];
                  return (
                    <div
                      key={k}
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: `1.5px solid ${spec.brandColorHex}`,
                        borderRadius: '16px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '16px', fontWeight: 900, color: spec.brandColorHex }}>
                          {spec.displayName}
                        </span>
                        <span
                          style={{
                            background: spec.accentColorHex,
                            color: '#111827',
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          HP: {spec.maxHp}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {detail.role} | {detail.speedText}
                      </div>
                      <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5' }}>
                        {detail.description}
                      </div>
                      <div
                        style={{
                          marginTop: 'auto',
                          background: 'rgba(0, 0, 0, 0.3)',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: '#f8fafc',
                        }}
                      >
                        💡 {detail.tip}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: CARDS & CONTROLS */}
          {activeTab === 'cards' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Shoot-to-Select Reward Cards */}
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1.5px solid rgba(56, 189, 248, 0.4)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ fontSize: '17px', fontWeight: 900, color: '#38bdf8' }}>
                  🃏 킬 게이지 보상 카드 (Shoot-to-Select & 전장 일시정지)
                </div>
                <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>
                  웨이브 진행 중 킬 게이지(10/14/18/20/15 KILL)를 채울 때마다 전장이 즉시 일시정지(Combat Freeze)되며 펍 공간에 3장의 3D 홀로그램 카드가 소환됩니다. 원하는 카드에 조준선을 맞추고 <strong>직접 사격</strong>하여 획득하세요!
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {Object.entries(REWARD_CARD_SPECS).map(([rk, cspec]) => (
                    <div
                      key={rk}
                      style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '12px',
                        padding: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      <span style={{ fontSize: '28px' }}>{cspec.badgeText}</span>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#fbbf24' }}>
                          {cspec.nameKo}
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {cspec.descriptionKo}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Controls Summary */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ fontSize: '17px', fontWeight: 900, color: '#fbbf24' }}>
                  🎮 조작법 & 액티브 스킬 발동 가이드
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.7' }}>
                    <strong>📱 모바일 건그립 컨트롤러:</strong><br />
                    • <strong>톡 탭 / 꾸욱 홀드:</strong> 화면 톡 탭 시 1발 단발, 화면을 꾸욱 누르면 무기별 속도로 <strong>'투두두두' 자동 연발!</strong><br />
                    • <strong>⚡ 필살 액티브 스킬:</strong> 총구를 위로 <strong>'휙!(Snap)'</strong> 젖히기 (스킬 완충 시 진동 알림!)<br />
                    • <strong>🔥 4초 피버 버스트:</strong> PERFECT(+8%) 및 몬스터 처치(+12%) 충전 후 100% 게이지에서 <strong>따닥 더블 탭</strong> (4초간 무한 연사 & 2배 데미지 폭딜!)<br />
                    • <strong>영점 보정:</strong> 상단 주황색 띠 탭
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.7' }}>
                    <strong>💻 PC 단독 플레이 키보드/마우스:</strong><br />
                    • <strong>조준 & 사격:</strong> 마우스 이동 및 좌클릭 톡 탭 / 좌클릭 홀드 시 모든 무기 <strong>'투두두두' 자동 연발 지원!</strong><br />
                    • <strong>⚡ 필살 액티브 스킬:</strong> <strong>R 키</strong> 또는 <strong>마우스 우클릭</strong><br />
                    • <strong>🔥 4초 피버 버스트:</strong> PERFECT(+8%) 및 몬스터 처치(+12%) 충전 후 <strong>Space 키</strong> 누르기 (4초간 무한 연사 & 2배 데미지)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ITEMS */}
          {activeTab === 'items' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '16px',
              }}
            >
              {Object.entries(ITEM_DETAILS).map(([ik, detail]) => {
                const spec = ITEM_BUFF_SPECS[ik as ItemBuffKind];
                return (
                  <div
                    key={ik}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: `1.5px solid ${spec.auraColorHex}`,
                      borderRadius: '16px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '16px', fontWeight: 900, color: spec.auraColorHex }}>
                        {spec.icon} {spec.displayName}
                      </span>
                      <span
                        style={{
                          background: spec.auraColorHex,
                          color: '#111827',
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {detail.durText}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {detail.role}
                    </div>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5' }}>
                      {detail.effectText}
                    </div>
                    <div
                      style={{
                        marginTop: 'auto',
                        background: 'rgba(0, 0, 0, 0.3)',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: '#f8fafc',
                      }}
                    >
                      💡 {detail.tip}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 32px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.25)',
          }}
        >
          {showTutorialButton && onStartTutorial ? (
            <button
              onClick={onStartTutorial}
              style={{
                background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                border: 'none',
                borderRadius: '12px',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '14px',
                padding: '10px 20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(56, 189, 248, 0.35)',
              }}
            >
              <span>🎓</span>
              <span>튜토리얼 플레이</span>
            </button>
          ) : (
            <div />
          )}

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
