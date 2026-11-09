import React from 'react';
import { WEAPON_ARCHETYPE_SPECS } from '../../../shared/constants';
import { GAME_TUNING } from '../../../shared/gameTuning';
import { WEAPON_ONE_LINER, WEAPON_SKILL_ONE_LINER, WEAPON_BADGE_TEXT } from '../../../shared/guideText';
import { GuideCard } from './GuideCard';
import {
  WEAPON_EVOLUTION_TEXT,
  WeaponKindKey,
  levelSeries,
  shotgunSpreadText,
  weaponPerformanceText,
  weaponSkillDetailText,
  weaponStatBars,
} from './weaponGuideData';

const WEAPON_ORDER: WeaponKindKey[] = ['shotgun', 'revolver', 'gatling'];

function cooldownSeries(kind: WeaponKindKey): string {
  const lv = WEAPON_ARCHETYPE_SPECS[kind].levels;
  return levelSeries({
    1: lv[1].skillCooldownMs / 1000,
    2: lv[2].skillCooldownMs / 1000,
    3: lv[3].skillCooldownMs / 1000,
    4: lv[4].skillCooldownMs / 1000,
  });
}

/** 탭 1: 3종 무기 & 스킬 카드. 판정 배율·점수 규칙은 맨 위의 접힌 블록에 그대로 둔다. */
export const WeaponsTab: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    <details
      data-testid="judgment-rules"
      style={{
        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.18), rgba(56, 189, 248, 0.18))',
        border: '1.5px solid #fbbf24',
        borderRadius: '16px',
        padding: '14px 20px',
      }}
    >
      <summary style={{ cursor: 'pointer', fontSize: '16px', fontWeight: 900, color: '#fbbf24' }}>
        🎯 판정 배율과 점수 규칙 (명중 정밀도 데미지 배율 & 노-미스 아케이드 판정)
      </summary>
      <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: '1.6' }}>
                  • <strong>PERFECT (오차 25% 이내):</strong> <strong>{GAME_TUNING.judgment.perfectDamage.toFixed(1)}배 데미지</strong> 폭딜 (+{Math.round(150 * GAME_TUNING.score.scale)} PTS & 피버 +{GAME_TUNING.fever.perfectDelta}% 충전)<br />
                  • <strong>GREAT (오차 55% 이내):</strong> <strong>{GAME_TUNING.judgment.greatDamage.toFixed(1)}배 정타 데미지</strong> (+{Math.round(100 * GAME_TUNING.score.scale)} PTS) — 샷건·리볼버는 1레벨에서 기본 캔(1HP)을 원샷으로 제압합니다.<br />
                  • <strong>GOOD (오차 100% 이내):</strong> <strong>{GAME_TUNING.judgment.goodDamage.toFixed(1)}배 스침 데미지</strong> (+{Math.round(50 * GAME_TUNING.score.scale)} PTS) — 스쳐 살아남은 캔은 머리 위에 잔여 체력바가 즉시 표시됩니다.<br />
                  • <strong>웨이브 시간 보너스:</strong> 웨이브마다 정해진 기준 시간 안에 끝내면 웨이브당 최대 {GAME_TUNING.score.timeBonus.maxPerWave}점(보스 웨이브는 {GAME_TUNING.score.timeBonus.maxPerWave * GAME_TUNING.score.timeBonus.bossWaveWeight}점)을 받고, 기준 시간의 {GAME_TUNING.score.timeBonus.zeroAtParMult}배에서 0점이 될 때까지 줄어듭니다. 보스를 살려 두고 부하만 잡으며 시간을 끌면 시간 보너스가 줄어듭니다.<br />
                  • <strong>정밀도 보너스:</strong> 클리어하면 한 판 동안의 판정 비율(PERFECT 100% · GREAT 50% · GOOD 20% 가중, MISS 포함)에 따라 최대 약 {GAME_TUNING.score.precisionBonus.k.toLocaleString()}점이 더해집니다. 많이 쏘는 것보다 정확히 맞히는 것이 랭킹에 유리합니다.<br />
                  • <strong>MISS:</strong> 점수나 콤보가 깎이지는 않지만, 빗나간 탄약과 <strong>긴 장전 시간</strong>(재장전 약 {GAME_TUNING.fire.reloadScale.toFixed(1)}배)이 그대로 손해입니다. 판정 범위가 좁아 난사로는 깨기 어렵습니다!<br />
                  • <strong>누르고 쏘기:</strong> 버튼을 누른 채 쏘면 자동 연사되며, 피해도 속도도 탭 사격과 같습니다(자동으로 연사해 줄 뿐입니다).
                </div>
      </div>
    </details>

    {WEAPON_ORDER.map((k) => {
      const spec = WEAPON_ARCHETYPE_SPECS[k];
      return (
        <GuideCard
          key={k}
          testId={`weapon-card-${k}`}
          icon={spec.badgeIcon}
          title={spec.nameKo}
          badge={WEAPON_BADGE_TEXT[k]}
          oneLiner={WEAPON_ONE_LINER[k]}
          accentColor={spec.accentColorHex}
          bars={weaponStatBars(k)}
          chips={[
            { label: '스킬', value: spec.levels[1].skillNameKo },
            { label: '충전', value: `${cooldownSeries(k)}초` },
            { label: '보유', value: '최대 2회' },
          ]}
          extraLine={<>⚡ {WEAPON_SKILL_ONE_LINER[k]}</>}
        >
          • <strong>외형 진화:</strong> {WEAPON_EVOLUTION_TEXT[k]}<br />
          • <strong>성능:</strong> {weaponPerformanceText(k)}<br />
          {k === 'shotgun' && (
            <>
              • <strong>퍼짐:</strong> {shotgunSpreadText()}<br />
            </>
          )}
          {weaponSkillDetailText(k).map((line, i) => (
            <React.Fragment key={i}>
              • <strong>{i === 0 ? `⚡ 전용 액티브 스킬 [${spec.levels[1].skillNameKo}]:` : '⚡'}</strong> {line}<br />
            </React.Fragment>
          ))}
        </GuideCard>
      );
    })}
  </div>
);
