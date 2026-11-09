import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { GuideCard, clampRatio } from '../src/pc/components/guide/GuideCard';
import { WeaponsTab } from '../src/pc/components/guide/WeaponsTab';
import { weaponStatBars, weaponSkillDetailText, shotgunSpreadText } from '../src/pc/components/guide/weaponGuideData';
import { WEAPON_ONE_LINER, WEAPON_SKILL_ONE_LINER } from '../src/shared/guideText';
import { GAME_TUNING } from '../src/shared/gameTuning';
import { GuideModal } from '../src/pc/components/GuideModal';
import { MonstersTab } from '../src/pc/components/guide/MonstersTab';
import { CardsTab } from '../src/pc/components/guide/CardsTab';
import { ItemsTab } from '../src/pc/components/guide/ItemsTab';
import { CoopTab } from '../src/pc/components/guide/CoopTab';
import { TARGET_SPECS, ITEM_BUFF_SPECS, REWARD_CARD_SPECS } from '../src/shared/constants';

describe('GuideCard', () => {
  const render = (props: Partial<React.ComponentProps<typeof GuideCard>> = {}) =>
    renderToStaticMarkup(
      <GuideCard
        testId="c"
        icon="🪠"
        title="제목"
        oneLiner="한 줄 요약입니다"
        accentColor="#ef4444"
        {...props}
      >
        {props.children ?? <span>상세 내용</span>}
      </GuideCard>
    );

  it('shows the one-liner outside the folded details and keeps the details closed', () => {
    const html = render();
    const detailsStart = html.indexOf('<details');
    expect(detailsStart).toBeGreaterThan(-1);
    expect(html.indexOf('한 줄 요약입니다')).toBeLessThan(detailsStart);
    expect(html.indexOf('상세 내용')).toBeGreaterThan(detailsStart);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toContain('data-testid="c-oneliner"');
    expect(html).toContain('data-testid="c-details"');
    expect(html).toContain('자세히 보기');
  });

  it('draws no folded area without children', () => {
    const html = renderToStaticMarkup(
      <GuideCard icon="x" title="t" oneLiner="o" accentColor="#fff" testId="n" />
    );
    expect(html).not.toContain('<details');
  });

  it('clamps bar widths to 0..100% for NaN, negative and oversized ratios', () => {
    expect(clampRatio(-1)).toBe(0);
    expect(clampRatio(2)).toBe(1);
    expect(clampRatio(NaN)).toBe(0);
    const html = render({
      bars: [
        { label: 'a', valueText: '1', ratio: -1 },
        { label: 'b', valueText: '2', ratio: 2 },
        { label: 'c', valueText: '3', ratio: NaN },
      ],
    });
    const pcts = [...html.matchAll(/data-pct="(\d+)"/g)].map((m) => Number(m[1]));
    expect(pcts).toEqual([0, 100, 0]);
  });
});

describe('WeaponsTab', () => {
  const html = renderToStaticMarkup(<WeaponsTab />);

  it('renders the three weapon cards with the shared one-liners', () => {
    (['shotgun', 'revolver', 'gatling'] as const).forEach((k) => {
      expect(html).toContain(`data-testid="weapon-card-${k}"`);
      expect(html).toContain(WEAPON_ONE_LINER[k]);
      expect(html).toContain(WEAPON_SKILL_ONE_LINER[k]);
    });
  });

  it('keeps the judgment rules in a folded block', () => {
    expect(html).toContain('data-testid="judgment-rules"');
    expect(html).toContain('PERFECT');
  });

  it('computes the shotgun spread and skill text from GAME_TUNING (no old hand-written numbers)', () => {
    const p = GAME_TUNING.skills.plunger;
    expect(shotgunSpreadText()).toContain('2 / 2 / 3 / 3');
    expect(shotgunSpreadText()).toContain('10 / 15 / 20 / 25%');
    const skill = weaponSkillDetailText('shotgun').join(' ');
    expect(skill).toContain('4 / 5 / 6 / 8');
    expect(skill).toContain('2 / 2.2 / 2.5 / 3초');
    expect(skill).toContain('0.7 / 0.8 / 0.9 / 1');
    expect(skill).toContain('4 / 5 / 6 / 6');
    expect(p.stickMaxByLevel[1]).toBe(4);
    expect(html).not.toContain('12~22개');
    expect(html).not.toContain('1.0~2.0초');
  });

  it('stat bars: the strongest weapon per row is exactly 1 and every ratio is within 0..1', () => {
    const all = (['shotgun', 'revolver', 'gatling'] as const).map((k) => weaponStatBars(k));
    for (let row = 0; row < 3; row++) {
      const ratios = all.map((bars) => bars[row].ratio);
      expect(Math.max(...ratios)).toBeCloseTo(1, 10);
      ratios.forEach((r) => {
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
      });
    }
  });
});

describe('GuideModal', () => {
  it('renders nothing when closed and the weapons tab cards when open', () => {
    expect(renderToStaticMarkup(<GuideModal isOpen={false} onClose={() => {}} />)).toBe('');
    const html = renderToStaticMarkup(<GuideModal isOpen onClose={() => {}} />);
    expect(html).toContain('data-testid="weapon-card-shotgun"');
  });
});

describe('the other guide tabs', () => {
  it('MonstersTab: every monster card has the HP chip and keeps tips inside the folded details', () => {
    const html = renderToStaticMarkup(<MonstersTab />);
    (Object.keys(TARGET_SPECS) as (keyof typeof TARGET_SPECS)[]).forEach((k) => {
      expect(html).toContain(`data-testid="monster-card-${k}"`);
      expect(html).toContain(`${TARGET_SPECS[k].maxHp}HP`);
      expect(html).toContain(TARGET_SPECS[k].displayName);
    });
    expect(html).toContain('data-testid="gimmicks"');
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    // 팁은 접힌 details 안에만 있다
    const tipIdx = html.indexOf('💡');
    expect(html.lastIndexOf('<details', tipIdx)).toBeGreaterThan(-1);
  });

  it('CardsTab: all nine reward cards are listed and the mid-wave text is in the rules block', () => {
    const html = renderToStaticMarkup(<CardsTab />);
    Object.values(REWARD_CARD_SPECS).forEach((c) => expect(html).toContain(c.nameKo));
    expect(Object.keys(REWARD_CARD_SPECS)).toHaveLength(9);
    expect(html).toContain('4·6웨이브');
    expect(html).toContain('data-testid="controls-card"');
  });

  it('ItemsTab: each item has its one-line effect outside the fold', () => {
    const html = renderToStaticMarkup(<ItemsTab />);
    Object.values(ITEM_BUFF_SPECS).forEach((spec) => {
      const i = html.indexOf(spec.description);
      expect(i).toBeGreaterThan(-1);
    });
  });

  it('CoopTab: three cards with a one-line summary each', () => {
    const html = renderToStaticMarkup(<CoopTab />);
    ['coop-lobby-card', 'coop-rules-card', 'coop-grace-card'].forEach((id) => {
      expect(html).toContain(`data-testid="${id}-oneliner"`);
    });
  });
});
