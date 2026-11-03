import React, { useState } from 'react';
import { TARGET_SPECS, ITEM_BUFF_SPECS } from '../../shared/constants';
import { TargetKind, ItemBuffKind } from '../../shared/types';

export interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTutorial?: () => void;
  showTutorialButton?: boolean;
}

type TabType = 'controls' | 'monsters' | 'items';

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
    role: '공중 유영형 · S자 회피 비행',
    speedText: '2.6 m/s',
    description: '부드러운 곡선 S자 유영 궤적으로 좌우로 흔들리며 날아오는 고래 캐릭터 알루미늄 캔.',
    tip: '1HP이므로 곡선 유영 중심을 예측 조준하여 신속하게 요격하세요.',
    imageSrc: '/docs/screens/monster-01-pilgood.png',
  },
  caslight: {
    role: '공중 비행형 · 날개 펄럭임 & 고속 회피',
    speedText: '2.4 m/s',
    description: '양 측면 반투명 시안 날개를 펄럭이며 날렵한 곡선 지그재그 궤적으로 날아오는 라이트 캔.',
    tip: '지상 표적보다 조준선을 약간 높여 공중 회피 각도로 조준하세요.',
    imageSrc: '/docs/screens/monster-02-caslight.png',
  },
  obi: {
    role: '지상 바운스 · 랄라베어 정통 보병',
    speedText: '1.9 m/s',
    description: '왕관을 쓴 오비 랄라베어 마스코트가 그려진 앰버 골드 캔. 바닥을 안정적으로 전진합니다.',
    tip: '2HP이므로 2연타 사격 또는 파워 샷(💥) 원샷으로 격파하세요.',
    imageSrc: '/docs/screens/monster-03-obi.png',
  },
  hanmac: {
    role: '지상 돌진형 · 버서커 가속',
    speedText: '2.0 m/s',
    description: '100% 국산 쌀 벼 이삭 크레스트가 새겨진 딥 에메랄드 캔 맥주 타겟.',
    tip: '1타 피격 시 분노하여 이동 속도가 30% 빨라지므로 연속 격발로 빠르게 처치하세요.',
    imageSrc: '/docs/screens/monster-04-hanmac.png',
  },
  bottle: {
    role: '지상 대형 탱커 · 카스 500ml 투명병',
    speedText: '1.5 m/s',
    description: '2.45배 대형화된 압도적 크기와 좌우로 활기차게 통통 튀며 바운스 전진하는 3HP 탱커.',
    tip: '크기가 크고 피격 판정이 넓어 맞추기 쉽지만, 3발을 침착하게 명중시켜야 합니다.',
    imageSrc: '/docs/screens/monster-05-cass-bottle.png',
  },
  boss: {
    role: '최종 레이드 보스 · 업소용 냉각기',
    speedText: '0.85 m/s',
    description: '스테인리스 헤어라인 패널, 듀얼 골드 탭, 디지털 온도계를 장착한 거대 캐비닛 보스.',
    tip: '체력 50! 방어선에 도달하면 즉시 게임오버되므로 피버 모드로 집중 난사하세요!',
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
  const [activeTab, setActiveTab] = useState<TabType>('controls');

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
          width: '920px',
          maxWidth: '92vw',
          maxHeight: '90vh',
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
            padding: '24px 32px 18px',
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
              📖 비어 크러셔 3D 가이드 & 도감
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
              조작법, 몬스터 6종 스펙, 소품형 아이템 및 피버 모드 공략 가이드
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
            gap: '8px',
            padding: '12px 32px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {[
            { id: 'controls' as TabType, label: '🎮 조작 방법', icon: '🎮' },
            { id: 'monsters' as TabType, label: '👾 몬스터 도감 (6종)', icon: '👾' },
            { id: 'items' as TabType, label: '✨ 아이템 & 피버 룰', icon: '✨' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: isActive
                    ? '1px solid #f59e0b'
                    : '1px solid transparent',
                  background: isActive
                    ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.15))'
                    : 'transparent',
                  color: isActive ? '#fbbf24' : '#94a3b8',
                  fontSize: '14px',
                  fontWeight: isActive ? 800 : 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Body (Scrollable) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 32px',
          }}
        >
          {/* TAB 1: CONTROLS */}
          {activeTab === 'controls' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '20px',
                }}
              >
                {/* PC Controls Card */}
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '16px',
                    padding: '20px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: '#38bdf8',
                      marginBottom: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    🖱️ PC 마우스 & 키보드 조작
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '20px',
                      fontSize: '14px',
                      lineHeight: '1.8',
                      color: '#cbd5e1',
                    }}
                  >
                    <li>
                      <strong>조준 (Aim)</strong>: 마우스 커서를 움직여 조준선 이동
                    </li>
                    <li>
                      <strong>단발 사격 (Fire)</strong>: 마우스 좌클릭 (단발 탭)
                    </li>
                    <li>
                      <strong>연사 사격 (Rapid Fire)</strong>: 좌클릭 유지(홀드) 시 0.25초 간격 연속 발사
                    </li>
                    <li>
                      <strong>자동 재장전</strong>: 10발 탄창 소진 시 1.2초간 자동 재장전
                    </li>
                    <li>
                      <strong>피버 발동</strong>: 게이지 100% 충전 시 <kbd style={kbdStyle}>Space</kbd> 키 입력
                    </li>
                  </ul>
                </div>

                {/* Mobile Gun Grip Controls Card */}
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '16px',
                    padding: '20px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: '#10b981',
                      marginBottom: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    🔫 스마트폰 건 그립 컨트롤러 조작
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '20px',
                      fontSize: '14px',
                      lineHeight: '1.8',
                      color: '#cbd5e1',
                    }}
                  >
                    <li>
                      <strong>자이로 조준</strong>: 폰을 권총처럼 쥐고 모니터를 향해 겨누어 조준
                    </li>
                    <li>
                      <strong>단발 탭 사격</strong>: 화면을 가볍게 탭하면 즉시 "탕!" 1발 격발 (0ms 딜레이)
                    </li>
                    <li>
                      <strong>피버 모드 발동</strong>: 100% 충전 시 화면을 빠르게 따닥 더블탭 (10초간 무제한 자동 난사)
                    </li>
                    <li>
                      <strong>게임 시작 (Start)</strong>: 대기 화면에서 모니터 중앙의 [SHOOT TO START] 과녁을 조준 사격
                    </li>
                    <li>
                      <strong>영점 조절</strong>: 조준이 빗나갈 때 화면 상단 주황색 [영점 맞추기] 바 탭
                    </li>
                  </ul>
                </div>
              </div>

              {/* Tips Banner */}
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  fontSize: '13px',
                  color: '#fbbf24',
                  lineHeight: '1.6',
                }}
              >
                💡 <strong>플레이 꿀팁</strong>: 타겟 중앙에 명중시킬수록 <span style={{ color: '#ec4899', fontWeight: 800 }}>PERFECT</span> 판정이 발생하며 콤보 배율과 피버 게이지가 대폭 상승합니다! 10발 소진 후 자동 재장전 중에는 사격할 수 없으니 탄창 관리에 주의하세요.
              </div>
            </div>
          )}

          {/* TAB 2: MONSTERS */}
          {activeTab === 'monsters' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '16px',
                }}
              >
                {(['pilgood', 'caslight', 'obi', 'hanmac', 'bottle', 'boss'] as TargetKind[]).map(
                  (kind) => {
                    const spec = TARGET_SPECS[kind];
                    const detail = MONSTER_DETAILS[kind];
                    return (
                      <div
                        key={kind}
                        style={{
                          background: 'rgba(15, 23, 42, 0.7)',
                          border: `1px solid ${spec.brandColorHex}`,
                          borderRadius: '16px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: spec.brandColorHex,
                              color: '#ffffff',
                            }}
                          >
                            {detail.role}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#f59e0b' }}>
                            +{spec.killBonusScore}점
                          </span>
                        </div>

                        <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
                          {spec.displayName}
                        </div>

                        {/* Stats Row */}
                        <div
                          style={{
                            display: 'flex',
                            gap: '12px',
                            background: 'rgba(0, 0, 0, 0.3)',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        >
                          <div>
                            <span style={{ color: '#94a3b8' }}>체력(HP): </span>
                            <strong style={{ color: '#38bdf8' }}>{spec.maxHp}</strong>
                          </div>
                          <div>
                            <span style={{ color: '#94a3b8' }}>속도: </span>
                            <strong style={{ color: '#10b981' }}>{detail.speedText}</strong>
                          </div>
                        </div>

                        <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5' }}>
                          {detail.description}
                        </div>

                        <div
                          style={{
                            fontSize: '11px',
                            color: '#fbbf24',
                            background: 'rgba(245, 158, 11, 0.08)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            borderLeft: '3px solid #f59e0b',
                          }}
                        >
                          🎯 {detail.tip}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ITEMS & FEVER */}
          {activeTab === 'items' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* Items Section */}
              <div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: '#f59e0b', marginBottom: '12px' }}>
                  🍺 오비 펍 소품형 아이템 4종 (원거리 사격 시 즉시 발동)
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '14px',
                  }}
                >
                  {(
                    ['power_shot', 'wide_scope', 'ice_freeze', 'bar_repair'] as ItemBuffKind[]
                  ).map((itemKind) => {
                    const spec = ITEM_BUFF_SPECS[itemKind];
                    const detail = ITEM_DETAILS[itemKind];
                    return (
                      <div
                        key={itemKind}
                        style={{
                          background: 'rgba(15, 23, 42, 0.7)',
                          border: `1px solid ${spec.auraColorHex}`,
                          borderRadius: '14px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '16px', fontWeight: 800, color: spec.auraColorHex }}>
                            {spec.icon} {spec.displayName}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(255,255,255,0.1)',
                              color: '#cbd5e1',
                            }}
                          >
                            {detail.durText}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                          {detail.effectText}
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>{detail.tip}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fever Rules Section */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(239, 68, 68, 0.15))',
                  border: '1px solid rgba(245, 158, 11, 0.5)',
                  borderRadius: '16px',
                  padding: '20px',
                }}
              >
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 900,
                    color: '#fbbf24',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  🔥 피버 모드 (FEVER MODE) 시스템 룰
                </div>
                <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: '1.7' }}>
                  1. 몬스터를 연속으로 정확히 타격하면 <strong>콤보와 함께 피버 게이지가 누적</strong>됩니다. (PERFECT +8%, GREAT +4%)
                  <br />
                  2. 게이지가 <strong>100% 충전</strong>되면 HUD에 <strong>[🔥 FEVER READY]</strong> 락온 알림이 점등됩니다.
                  <br />
                  3. <strong>Space 키</strong> 또는 모바일의 <strong>[🔥 FEVER]</strong> 버튼을 누르면 발동됩니다!
                  <br />
                  4. <strong>8초 동안 탄창 무제한(재장전 없음) & 사격 데미지 2배 증폭</strong>의 초강력 버프가 유지됩니다!
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '20px 32px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(0, 0, 0, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '14px 28px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#cbd5e1',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            닫기
          </button>

          {showTutorialButton && onStartTutorial && (
            <button
              onClick={() => {
                onClose();
                onStartTutorial();
              }}
              style={{
                flex: 1,
                maxWidth: '480px',
                padding: '14px 28px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(245, 158, 11, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'transform 0.1s',
              }}
            >
              🎯 지금 바로 사격 연습하기 (3단계 훈련 코스)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const kbdStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.15)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '4px',
  padding: '2px 6px',
  fontSize: '12px',
  fontWeight: 700,
  color: '#ffffff',
};
