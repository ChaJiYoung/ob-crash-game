import React from 'react';
import { TARGET_SPECS } from '../../../shared/constants';
import { TargetKind } from '../../../shared/types';
import { GAME_TUNING } from '../../../shared/gameTuning';
import { GuideCard, GuideThumb } from './GuideCard';

export const MONSTER_DETAILS: Record<
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
    imageSrc: '/guide/monster-01-pilgood.png',
  },
  caslight: {
    role: '유일한 공중 비행형 · 크게 흔들리는 회피 비행 (1HP)',
    speedText: '2.4 m/s',
    description: '양 측면 반투명 시안 날개를 펄럭이며 좌우로 크게 흔들리며 날아오는 라이트 캔. 공중에 떠 있는 몬스터는 이 캔뿐입니다.',
    tip: '체력 1! 흔들림의 가장자리에서 방향을 바꾸는 순간을 노리세요. 조준선을 지상 표적보다 높게 잡아야 합니다.',
    imageSrc: '/guide/monster-02-caslight.png',
  },
  obi: {
    role: '지상 방패병 · 방패를 들었다 내리는 타이밍형 (2HP)',
    speedText: '2.2 m/s',
    description: `푸른 방패를 ${GAME_TUNING.monsters.obi.guardUpMs / 1000}초 들고 ${GAME_TUNING.monsters.obi.guardDownMs / 1000}초 내리기를 반복합니다. 방패가 올라가 있으면 총알이 튕겨 나가고(점수·피버 없음) 탄약만 소모됩니다.`,
    tip: '방패가 내려간 순간에만 쏘세요! 액티브 스킬은 방패를 뚫습니다. 개체마다 방패 타이밍이 달라 다른 오비를 먼저 노리는 것도 방법입니다.',
    imageSrc: '/guide/monster-03-obi.png',
  },
  hanmac: {
    role: '지상 폭탄형 · 잡으면 주변이 터짐 (3HP)',
    speedText: '2.0 m/s',
    description: `100% 국산 쌀 벼 이삭 크레스트가 새겨진 딥 에메랄드 캔에 빨간 띠와 심지를 단 폭탄 캔. 처치하면 터져서 반경 ${GAME_TUNING.monsters.hanmac.blastRadiusM}m 안 몬스터에게 피해 ${GAME_TUNING.monsters.hanmac.blastDamage}를 줍니다(보스 제외, 다른 한맥이 죽으면 연쇄 폭발).`,
    tip: '몬스터가 뭉쳤을 때 한맥을 노리면 한꺼번에 정리할 수 있습니다. 놓치면 방어선을 넘어 체력이 깎입니다.',
    imageSrc: '/guide/monster-04-hanmac.png',
  },
  bottle: {
    role: '지상 대형 탱커 · 깨지면 작은 병 2마리로 분열 (4HP)',
    speedText: '2.0 m/s',
    description: `대형 카스 500ml 투명병. 깨지는 순간 작고 빠른 병 2마리(체력 1, ${GAME_TUNING.monsters.bottle.childSpeedMps} m/s)로 갈라져 양옆에서 달려옵니다. 작은 병은 다시 나뉘지 않습니다.`,
    tip: '체력 4! 큰 병을 깬 뒤 양옆으로 갈라지는 작은 병을 바로 이어서 잡으세요. 작은 병까지 잡아야 웨이브가 끝납니다.',
    imageSrc: '/guide/monster-05-cass-bottle.png',
  },
  boss: {
    role: '보스 · 업소용 냉각기 (3·5·7웨이브, 마지막에 대왕 냉각기)',
    speedText: '0.85 m/s (14m 정지, 좌우 이동)',
    description: `앞면에 탭이 달린 업소용 냉각기 보스. 소형은 은색 1구, 대왕은 검정 3구에 금색 왕관을 썼습니다. 3웨이브는 1대(체력 ${GAME_TUNING.waves[2].boss!.coolerHp[0]}), 5웨이브는 2대(각 ${GAME_TUNING.waves[4].boss!.coolerHp[0]}), 7웨이브는 2대(각 ${GAME_TUNING.waves[6].boss!.coolerHp[0]}) + 대왕 냉각기(체력 ${GAME_TUNING.waves[6].boss!.kingHp}, 1.5배 크기)가 등장합니다. 웨이브의 일반 몬스터가 ${Math.round(GAME_TUNING.boss.encounterStartRatio * 100)}% 나온 시점에 등장하고, 보스가 살아 있는 동안에도 일반 몬스터가 계속 나옵니다. 좌우로 움직이며 체력이 ${GAME_TUNING.boss.summonHpThresholds.map((v) => Math.round(v * 100)).join('% / ')}% 아래로 내려갈 때마다 부하를 소환하고(${GAME_TUNING.boss.summonCountByStep.join('·')}마리씩 필드 ${GAME_TUNING.boss.minionDrop.minRadiusM}~${GAME_TUNING.boss.minionDrop.maxRadiusM}m에 위에서 떨어집니다. 시간이 아니라 체력 기준이라 빨리 잡아도 소환을 봅니다) 투사체를 쏩니다. 넉백·기절·둔화가 통하지 않습니다.`,
    tip: '보스 몸통을 맞혀도 피버가 차지 않습니다! 소환된 부하를 잡아 피버와 아이템을 모으세요. 7웨이브는 냉각기와 대왕을 모두 잡아야 승리합니다.',
    imageSrc: '/guide/monster-06-boss-dispenser.png',
  },
};


/** 탭 2: 몬스터 도감 & 전장 기믹. 한 줄 요약(역할)과 체력·속도 칩만 보이고 설명·팁은 접혀 있다. */
export const MonstersTab: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    <details
      data-testid="gimmicks"
      style={{
        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.15), rgba(56, 189, 248, 0.15))',
        border: '1.5px solid #fbbf24',
        borderRadius: '16px',
        padding: '14px 20px',
      }}
    >
      <summary style={{ cursor: 'pointer', fontSize: '16px', fontWeight: 900, color: '#fbbf24' }}>
        ✨ 전장 특수 기믹 & 체력바 시스템
      </summary>
      <div style={{ marginTop: '10px' }}>
<div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: '1.6' }}>
                  • <strong>100% 비례 슬림 게이지 체력바:</strong> 모든 몬스터는 100% 비례 연속 게이지 바로 체력이 표시됩니다. 1HP 캔(필굿, 카스라이트)도 스쳐 맞았을 때(hp &lt; maxHp) 즉시 머리 위에 잔여 체력바가 나타납니다!<br />
                  • <strong>🌟 황금 캔 (보너스 타겟):</strong> 웨이브마다 1회 원경을 고속 횡단! 격추 시 +{Math.round(500 * GAME_TUNING.score.scale)}점과 함께 액티브 스킬 1회 충전, 피버 게이지 +{GAME_TUNING.goldenCan.feverGain}%를 받습니다.<br />
                  • <strong>💩 똥 투사체 요격:</strong> 보스가 쏘는 갈색 똥 덩어리(아이템과 달리 빛나지 않고 맞으면 체력이 깎입니다)가 바닥을 따라 다가올 때 사격하면 몬스터처럼 터지며 요격음과 점수를 얻습니다. 놓쳐서 방어선을 통과하면 바 생명이 1 차감됩니다.
                </div>
      </div>
    </details>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
      {Object.entries(MONSTER_DETAILS).map(([k, detail]) => {
        const spec = TARGET_SPECS[k as TargetKind];
        return (
          <GuideCard
            key={k}
            testId={`monster-card-${k}`}
            icon={<GuideThumb src={detail.imageSrc} alt={spec.displayName} fallback="👾" />}
            title={spec.displayName}
            badge={`HP ${spec.maxHp}`}
            oneLiner={detail.role}
            accentColor={spec.brandColorHex}
            chips={[
              { label: '체력', value: `${spec.maxHp}HP` },
              { label: '속도', value: detail.speedText },
            ]}
          >
            {detail.description}
            <br />
            💡 {detail.tip}
          </GuideCard>
        );
      })}
    </div>
  </div>
);
