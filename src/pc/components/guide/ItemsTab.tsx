import React from 'react';
import { ITEM_BUFF_SPECS } from '../../../shared/constants';
import { ItemBuffKind } from '../../../shared/types';
import { GAME_TUNING } from '../../../shared/gameTuning';
import { GuideCard, GuideThumb } from './GuideCard';

export const ITEM_DETAILS: Record<
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
    imageSrc: '/guide/item-01-power-shot.png',
  },
  wide_scope: {
    role: '오비 맥주 코스터 소품',
    durText: '8초 지속',
    effectText: '조준경 88px ➔ 140px (1.6배) 확대 & 판정 반경 1.6배',
    tip: '모든 몬스터 머리 위에 홀로그램 록온 마커가 점등되어 PERFECT 판정이 쉬워집니다.',
    imageSrc: '/guide/item-02-wide-scope.png',
  },
  ice_freeze: {
    role: '은색 얼음 버킷 소품',
    durText: '8초 지속',
    effectText: '전장에 출현한 모든 몬스터 이동속도 50% 감속 (Slow)',
    tip: '몬스터가 서리 틴트(하늘색)로 결빙되고 발밑에 회전 얼음 링이 생깁니다.',
    imageSrc: '/guide/item-03-ice-freeze.png',
  },
  bar_repair: {
    role: '초록 홉 열매 다발 소품',
    durText: '즉시 발동',
    effectText: '바 방어선 체력 +1 즉시 회복 (최대 5개 맥주잔)',
    tip: '방어선에 닿으면 에메랄드 치유 펄스 파동이 바 전체로 퍼져나갑니다. 실전 처치 드롭에서는 나오지 않고 튜토리얼·훈련장에서만 볼 수 있습니다.',
    imageSrc: '/guide/item-04-bar-repair.png',
  },
};


/** 탭 4: 펍 아이템 버프. 한 줄 효과와 지속 시간 칩만 보이고 상세·팁은 접혀 있다. */
export const ItemsTab: React.FC = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
    {Object.entries(ITEM_DETAILS).map(([ik, detail]) => {
      const spec = ITEM_BUFF_SPECS[ik as ItemBuffKind];
      return (
        <GuideCard
          key={ik}
          testId={`item-card-${ik}`}
          icon={<GuideThumb src={detail.imageSrc} alt={spec.displayName} fallback={spec.icon} />}
          title={spec.displayName}
          badge={detail.durText}
          oneLiner={spec.description}
          accentColor={spec.auraColorHex}
          chips={[{ label: '지속', value: detail.durText }]}
        >
          {detail.role}
          <br />
          {detail.effectText}
          <br />
          💡 {detail.tip}
        </GuideCard>
      );
    })}
  </div>
);
