import React, { useState } from 'react';
import { TARGET_SPECS, ITEM_BUFF_SPECS, WEAPON_ARCHETYPE_SPECS, REWARD_CARD_SPECS } from '../../shared/constants';
import { TargetKind, ItemBuffKind } from '../../shared/types';
import { GAME_TUNING } from '../../shared/gameTuning';

export interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTutorial?: () => void;
  showTutorialButton?: boolean;
}

type TabType = 'weapons' | 'monsters' | 'cards' | 'items';

type WeaponKindKey = 'shotgun' | 'revolver' | 'gatling';

/** 무기 도감의 "성능" 줄을 무기 표(`WEAPON_ARCHETYPE_SPECS`, GAME_TUNING 반영)에서 만든다. 수치를 조정해도 안내가 어긋나지 않는다. */
function levelSeries(byLevel: Record<1 | 2 | 3 | 4, number>): string {
  return ([1, 2, 3, 4] as const).map((l) => byLevel[l]).join(' / ');
}

function weaponPerformanceText(kind: WeaponKindKey): string {
  const lv = WEAPON_ARCHETYPE_SPECS[kind].levels;
  const levels = [1, 2, 3, 4] as const;
  return levels
    .map((l) => {
      const spec = lv[l];
      const label = l === 4 ? 'MAX' : `Lv.${l}`;
      const parts: string[] = [];
      if (kind === 'shotgun') {
        parts.push(`${spec.damagePerHit.toFixed(2)}×${spec.pelletCount}=${(spec.damagePerHit * spec.pelletCount).toFixed(2)} DMG`);
        if (spec.knockbackM > 0) parts.push(`${spec.knockbackM}m 넉백`);
        if (spec.slowDurationMs > 0) parts.push('둔화');
      } else if (kind === 'revolver') {
        parts.push(`${spec.damagePerHit.toFixed(2)} DMG`);
        if (spec.pierceCount > 0) {
          parts.push(`${spec.pierceCount}체 관통(관통 피해 ${Math.round(spec.pierceDamageRatio * 100)}%)`);
        }
      } else {
        parts.push(`${spec.damagePerHit.toFixed(2)} DMG`, `${spec.maxAmmo}발`, `${spec.fireIntervalMs}ms`);
      }
      return `${label}(${parts.join(', ')})`;
    })
    .join(' ➔ ');
}

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
    role: '지상 돌격형 · 가까워지면 가속 (1HP)',
    speedText: `2.6 m/s (${GAME_TUNING.monsters.pilgood.chargeRadiusM}m 안에서 ×${GAME_TUNING.monsters.pilgood.chargeSpeedMult})`,
    description: '땅 위를 굴러 달려오는 고래 캐릭터 알루미늄 캔. 방어선 12m 안으로 들어오면 갑자기 빨라집니다.',
    tip: '체력 1! 멀리서 미리 잡으세요. 가까워지면 속도가 올라 조준할 시간이 부족합니다.',
    imageSrc: '/docs/screens/monster-01-pilgood.png',
  },
  caslight: {
    role: '유일한 공중 비행형 · 크게 흔들리는 회피 비행 (1HP)',
    speedText: '2.4 m/s',
    description: '양 측면 반투명 시안 날개를 펄럭이며 좌우로 크게 흔들리며 날아오는 라이트 캔. 공중에 떠 있는 몬스터는 이 캔뿐입니다.',
    tip: '체력 1! 흔들림의 가장자리에서 방향을 바꾸는 순간을 노리세요. 조준선을 지상 표적보다 높게 잡아야 합니다.',
    imageSrc: '/docs/screens/monster-02-caslight.png',
  },
  obi: {
    role: '지상 방패병 · 방패를 들었다 내리는 타이밍형 (2HP)',
    speedText: '2.2 m/s',
    description: `푸른 방패를 ${GAME_TUNING.monsters.obi.guardUpMs / 1000}초 들고 ${GAME_TUNING.monsters.obi.guardDownMs / 1000}초 내리기를 반복합니다. 방패가 올라가 있으면 총알이 튕겨 나가고(점수·피버 없음) 탄약만 소모됩니다.`,
    tip: '방패가 내려간 순간에만 쏘세요! 액티브 스킬은 방패를 뚫습니다. 개체마다 방패 타이밍이 달라 다른 오비를 먼저 노리는 것도 방법입니다.',
    imageSrc: '/docs/screens/monster-03-obi.png',
  },
  hanmac: {
    role: '지상 포격형 · 멈춰 서서 투사체 발사 (3HP)',
    speedText: `2.0 m/s (${GAME_TUNING.monsters.hanmac.stopRadiusM}m에서 정지)`,
    description: `100% 국산 쌀 벼 이삭 크레스트가 새겨진 딥 에메랄드 캔. ${GAME_TUNING.monsters.hanmac.stopRadiusM}m에서 멈춰 서서 ${GAME_TUNING.monsters.hanmac.fireIntervalMs / 1000}초마다 자기 위치에서 갈색 똥 투사체를 날립니다.`,
    tip: '갈색 똥 투사체를 요격하면 터지며 점수를 줍니다. 한맥은 방어선을 넘지 않으니 투사체가 날아오기 전에 우선 처치하세요.',
    imageSrc: '/docs/screens/monster-04-hanmac.png',
  },
  bottle: {
    role: '지상 대형 탱커 · 깨지면 작은 병 2마리로 분열 (4HP)',
    speedText: '2.0 m/s',
    description: '대형 카스 500ml 투명병. 깨지는 순간 작고 빠른 병 2마리(체력 1)로 갈라져 양옆에서 달려옵니다. 작은 병은 다시 나뉘지 않습니다.',
    tip: '체력 4! 큰 병을 깬 뒤 양옆으로 갈라지는 작은 병을 바로 이어서 잡으세요. 작은 병까지 잡아야 웨이브가 끝납니다.',
    imageSrc: '/docs/screens/monster-05-cass-bottle.png',
  },
  boss: {
    role: '보스 · 업소용 냉각기 (3·5·7웨이브, 마지막에 대왕 냉각기)',
    speedText: '0.85 m/s (14m 정지, 좌우 이동)',
    description: `앞면에 탭이 달린 업소용 냉각기 보스. 소형은 은색 1구, 대왕은 검정 3구에 금색 왕관을 썼습니다. 3웨이브는 1대, 5웨이브는 2대, 7웨이브는 2대 + 대왕 냉각기(1.5배 크기)가 등장합니다. 좌우로 움직이며 체력이 ${GAME_TUNING.boss.summonHpThresholds.map((v) => Math.round(v * 100)).join('% / ')}% 아래로 내려갈 때마다 부하를 소환하고(${GAME_TUNING.boss.summonCount}마리씩 필드 ${GAME_TUNING.boss.minionDrop.minRadiusM}~${GAME_TUNING.boss.minionDrop.maxRadiusM}m에 위에서 떨어집니다. 시간이 아니라 체력 기준이라 빨리 잡아도 소환을 봅니다) 투사체를 쏩니다. 넉백·기절·둔화가 통하지 않습니다.`,
    tip: '보스 몸통을 맞혀도 피버가 차지 않습니다! 소환된 부하를 잡아 피버와 아이템을 모으세요. 7웨이브는 냉각기와 대왕을 모두 잡아야 승리합니다.',
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
                  • <strong>PERFECT (오차 25% 이내):</strong> <strong>{GAME_TUNING.judgment.perfectDamage.toFixed(1)}배 데미지</strong> 폭딜 (+{Math.round(150 * GAME_TUNING.score.scale)} PTS & 피버 +{GAME_TUNING.fever.perfectDelta}% 충전)<br />
                  • <strong>GREAT (오차 55% 이내):</strong> <strong>{GAME_TUNING.judgment.greatDamage.toFixed(1)}배 정타 데미지</strong> (+{Math.round(100 * GAME_TUNING.score.scale)} PTS) — 샷건·리볼버는 1레벨에서 기본 캔(1HP)을 원샷으로 제압합니다.<br />
                  • <strong>GOOD (오차 100% 이내):</strong> <strong>{GAME_TUNING.judgment.goodDamage.toFixed(1)}배 스침 데미지</strong> (+{Math.round(50 * GAME_TUNING.score.scale)} PTS) — 스쳐 살아남은 캔은 머리 위에 잔여 체력바가 즉시 표시됩니다.<br />
                  • <strong>웨이브 시간 보너스:</strong> 웨이브마다 정해진 기준 시간 안에 끝내면 웨이브당 최대 {GAME_TUNING.score.timeBonus.maxPerWave}점(보스 웨이브는 {GAME_TUNING.score.timeBonus.maxPerWave * GAME_TUNING.score.timeBonus.bossWaveWeight}점)을 받고, 기준 시간의 {GAME_TUNING.score.timeBonus.zeroAtParMult}배에서 0점이 될 때까지 줄어듭니다. 보스를 살려 두고 부하만 잡으며 시간을 끌면 시간 보너스가 줄어듭니다.<br />
                  • <strong>정밀도 보너스:</strong> 클리어하면 한 판 동안의 판정 비율(PERFECT 100% · GREAT 50% · GOOD 20% 가중, MISS 포함)에 따라 최대 약 {GAME_TUNING.score.precisionBonus.k.toLocaleString()}점이 더해집니다. 많이 쏘는 것보다 정확히 맞히는 것이 랭킹에 유리합니다.<br />
                  • <strong>MISS:</strong> 점수나 콤보가 깎이지는 않지만, 빗나간 탄약과 <strong>긴 장전 시간</strong>(재장전 약 {GAME_TUNING.fire.reloadScale.toFixed(1)}배)이 그대로 손해입니다. 판정 범위가 좁아 난사로는 깨기 어렵습니다!<br />
                  • <strong>누르고 쏘기:</strong> 버튼을 누른 채 쏘는 연사는 피해가 줄어듭니다(샷건·리볼버 {Math.round(GAME_TUNING.fire.holdDamageByWeapon.shotgun * 100)}%, 개틀링 {Math.round(GAME_TUNING.fire.holdDamageByWeapon.gatling * 100)}%). 한 발씩 정확히 누르세요.
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
                        넓은 명중 범위 & 한 발 강한 화력
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
                    넓은 범위 산탄
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>
                  • <strong>외형 진화:</strong> 리얼 고무 벨 뚫어뻥 장착 ➔ Lv.2 듀얼 고압관 ➔ Lv.3 호박색 맥주관 순환 ➔ Lv.4 쿼드 배럴 + 둔화 파동<br />
                  • <strong>성능:</strong> {weaponPerformanceText('shotgun')}<br />
                  • <strong>⚡ 전용 액티브 스킬 [사방 뚫어뻥 폭풍]:</strong> 총구를 위로 '휙!' 젖히면 화면 8방향에서 12~22개의 미니 뚫어뻥이 포물선으로 날아가 몬스터를 1.0~2.0초간 부착 기절(Stun)시킵니다! (빗나간 탄은 바닥에서 통통 튕김) 보스에게는 피해만 줍니다.
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
                        초정밀 일직선 관통탄 & 부채꼴 칼날
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
                  • <strong>성능:</strong> {weaponPerformanceText('revolver')}<br />
                  • <strong>⚡ 전용 액티브 스킬 [오프너 참격]:</strong> 총구를 위로 '휙!' 젖히면 황금 칼날이 부채꼴로 곧게 날아가 닿은 몬스터를 베고 날아오는 포탄도 벱니다. 칼날 {levelSeries(GAME_TUNING.skills.blade.countByLevel)}개, 관통 {levelSeries(GAME_TUNING.skills.blade.pierceByLevel)}마리. 칼날 하나의 피해는 평타 한 발과 같습니다.
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
                        초고속 탄산 기포 난사 & 거품 해일
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
                  • <strong>성능:</strong> {weaponPerformanceText('gatling')}<br />
                  • <strong>⚡ 전용 액티브 스킬 [거품 해일]:</strong> 작은 거품이 필드 전체로 쓸고 나가며 닿은 몬스터를 {levelSeries(GAME_TUNING.skills.foam.knockbackMByLevel)}m 뒤로 밀어내고 둔화시킵니다. 밀어내기 전용이라 피해는 낮고, 레벨이 오를수록 거품이 많아집니다.
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
                  • <strong>🌟 황금 캔 (보너스 타겟):</strong> 웨이브마다 1회 원경을 고속 횡단! 격추 시 +{Math.round(500 * GAME_TUNING.score.scale)}점과 함께 액티브 스킬 1회 충전, 피버 게이지 +{GAME_TUNING.goldenCan.feverGain}%를 받습니다.<br />
                  • <strong>💩 똥 투사체 요격:</strong> 한맥과 보스가 쏘는 갈색 똥 덩어리(아이템과 달리 빛나지 않고 맞으면 체력이 깎입니다)가 바닥을 따라 다가올 때 사격하면 몬스터처럼 터지며 요격음과 점수를 얻습니다. 놓쳐서 방어선을 통과하면 바 생명이 1 차감됩니다.
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
                  웨이브를 클리어할 때, 그리고 4웨이브(22킬)·6웨이브(26킬) 중간에 전장이 즉시 일시정지(Combat Freeze)되며 <strong>9종 중 무작위 3장</strong>의 3D 홀로그램 카드가 소환됩니다. 이미 최대치인 카드는 나오지 않고, 무기 레벨 상한은 1웨이브 Lv.2 · 2~4웨이브 Lv.3 · 5웨이브부터 MAX입니다. 카드를 고르는 동안 피버·버프·쿨다운 시간은 모두 멈추고, <strong>누르고 있던 입력은 무시</strong>되니 버튼을 뗐다가 새로 눌러 <strong>직접 사격</strong>하여 획득하세요! (카드 등장 후 0.8초는 입력 잠금)
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
                    • <strong>🔥 4초 피버 버스트:</strong> PERFECT(+{GAME_TUNING.fever.perfectDelta}%) 및 몬스터 처치(+{GAME_TUNING.fever.killDelta}%) 충전 후 100% 게이지에서 <strong>따닥 더블 탭</strong> (4초간 무한 탄창 자동 연사 & 명중 점수 1.5배, 명중은 모두 GREAT 판정!)<br />
                    • <strong>영점 보정:</strong> 상단 주황색 띠 탭
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.7' }}>
                    <strong>💻 PC 단독 플레이 키보드/마우스:</strong><br />
                    • <strong>조준 & 사격:</strong> 마우스 이동 및 좌클릭 톡 탭 / 좌클릭 홀드 시 모든 무기 <strong>'투두두두' 자동 연발 지원!</strong><br />
                    • <strong>⚡ 필살 액티브 스킬:</strong> <strong>R 키</strong> 또는 <strong>마우스 우클릭</strong><br />
                    • <strong>🔥 4초 피버 버스트:</strong> PERFECT(+{GAME_TUNING.fever.perfectDelta}%) 및 몬스터 처치(+{GAME_TUNING.fever.killDelta}%) 충전 후 <strong>Space 키</strong> 누르기 (4초간 무한 탄창 자동 연사 & 명중 점수 1.5배, 명중은 모두 GREAT 판정)
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
