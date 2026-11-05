import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GAME_TUNING } from '../src/shared/gameTuning';
import { WEAPON_ARCHETYPE_SPECS } from '../src/shared/constants';

/** Guards against old specs creeping back into player-facing text (gameplay-polish P05-T02). */
const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /INTERCEPTED/, why: 'the intercept banner was removed' },
  { pattern: /바 카운터/, why: 'the bar counter wall was replaced by a floor neon line' },
  { pattern: /호쾌하게 난사|통쾌한 난사|부담 없이 통쾌|부담 없이 호쾌/, why: 'spraying is no longer encouraged' },
  { pattern: /1\.5배 데미지|1\.5x|0\.8배|0\.8x/, why: 'judgment damage is 2.0 / 1.0 / 0.5' },
  { pattern: /5단계 (아케이드|테마)/, why: 'the game has 7 waves' },
  { pattern: /카드 5종|5종 보상 카드|보상 카드 5종/, why: 'there are 9 reward cards' },
  { pattern: /MISS 페널티 완전 폐지/, why: 'misses now cost ammo and reload time' },
  { pattern: /8초마다 (부하|소환)|부하를 8초마다|부하 4마리|4마리를 (공유|소환)/, why: 'boss summons are 3 minions with an interval that shrinks from 8s to 5s, dropped at 6-14m' },
  { pattern: /\+150 PTS|\+100 PTS|\+50 PTS|\+500점|\+1,500점|2배 화력|기본 피해의 3배/, why: 'scores are scaled by GAME_TUNING.score.scale (x0.1) and fever no longer boosts damage' },
];

function collect(): string[] {
  const files: string[] = ['README.md'];
  for (const f of fs.readdirSync('docs')) if (f.endsWith('.md')) files.push(path.join('docs', f));
  for (const f of fs.readdirSync('src/pc/components')) if (f.endsWith('.tsx')) files.push(path.join('src/pc/components', f));
  return files;
}

describe('player-facing text matches the final spec', () => {
  it('contains none of the outdated phrases', () => {
    const hits: string[] = [];
    for (const file of collect()) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const { pattern, why } of FORBIDDEN) {
          if (pattern.test(line)) hits.push(`${file}:${i + 1} (${why}) ${line.trim().slice(0, 80)}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  it('tutorial overlay and README show the judgment multipliers from GAME_TUNING', () => {
    const j = GAME_TUNING.judgment;
    const x = (n: number) => n.toFixed(1);
    const overlay = fs.readFileSync('src/pc/components/TutorialGuideOverlay.tsx', 'utf8');
    expect(overlay).toContain(`${x(j.perfectDamage)}x/${x(j.greatDamage)}x/${x(j.goodDamage)}x`);
    expect(overlay).toContain(`PERFECT(${x(j.perfectDamage)}배)`);
    expect(overlay).toContain(`GOOD(${x(j.goodDamage)}배)`);

    const readme = fs.readFileSync('README.md', 'utf8');
    expect(readme).toContain(`**${x(j.perfectDamage)}배 데미지**`);
    expect(readme).toContain(`**${x(j.goodDamage)}배 스침 데미지**`);
    expect(readme).toContain(`PERFECT(+${GAME_TUNING.fever.perfectDelta}%) 및 몬스터 처치(+${GAME_TUNING.fever.killDelta}%)`);
  });

  it('guide modal and tutorial overlay read fever and judgment numbers from GAME_TUNING', () => {
    for (const file of ['GuideModal.tsx', 'TutorialGuideOverlay.tsx']) {
      const src = fs.readFileSync(path.join('src/pc/components', file), 'utf8');
      expect(src).toContain('GAME_TUNING.fever.killDelta');
    }
    expect(fs.readFileSync('src/pc/components/GuideModal.tsx', 'utf8')).toContain('GAME_TUNING.judgment.perfectDamage');
    // Weapon stat lines are generated from the spec table, not hard-coded
    expect(fs.readFileSync('src/pc/components/GuideModal.tsx', 'utf8')).toContain("weaponPerformanceText('gatling')");
  });

  it('the weapon guide tables match WEAPON_ARCHETYPE_SPECS (fire interval, magazine, reload, skill cooldown)', () => {
    const doc = fs.readFileSync('docs/무기_및_스킬_가이드.md', 'utf8');
    const weapons = ['shotgun', 'revolver', 'gatling'] as const;
    const mismatches: string[] = [];
    weapons.forEach((kind, idx) => {
      const start = doc.indexOf(`(\`${kind}\`)`, doc.indexOf('상세 밸런스 수치표'));
      const end = idx + 1 < weapons.length ? doc.indexOf(`(\`${weapons[idx + 1]}\`)`, start) : doc.indexOf('\n---', start);
      const section = doc.slice(start, end);
      ([1, 2, 3, 4] as const).forEach((lv) => {
        const spec = WEAPON_ARCHETYPE_SPECS[kind].levels[lv];
        const row = section.split('\n').find((l) => l.startsWith(`| **Lv.${lv}`));
        if (!row) {
          mismatches.push(`${kind} Lv.${lv}: row missing`);
          return;
        }
        const expected = [
          `${spec.fireIntervalMs}ms`,
          `${spec.maxAmmo}발`,
          `${(spec.reloadDurationMs / 1000).toFixed(1)}s`,
          `${spec.skillCooldownMs / 1000}s`,
        ];
        expected.forEach((e) => {
          if (!row.includes(e)) mismatches.push(`${kind} Lv.${lv}: expected "${e}" in ${row.slice(0, 80)}`);
        });
      });
    });
    expect(mismatches).toEqual([]);
  });
});

describe('score scale and precision bonus are documented with the tuned numbers', () => {
  const sc = (n: number) => Math.round(n * GAME_TUNING.score.scale);
  const readme = fs.readFileSync('README.md', 'utf8');
  const weaponGuide = fs.readFileSync('docs/무기_및_스킬_가이드.md', 'utf8');

  it('lists the scaled judgment points', () => {
    for (const doc of [readme, weaponGuide]) {
      expect(doc).toContain(`+${sc(150)} PTS`);
      expect(doc).toContain(`+${sc(100)} PTS`);
      expect(doc).toContain(`+${sc(50)} PTS`);
    }
  });

  it('explains the precision bonus with the tuned constant', () => {
    const k = GAME_TUNING.score.precisionBonus.k.toLocaleString('en-US');
    for (const doc of [readme, weaponGuide]) {
      expect(doc).toContain('정밀도 보너스');
      expect(doc).toContain(`${k}점`);
    }
  });
});

describe('wave time bonus and boss drop are documented with the tuned numbers', () => {
  const t = GAME_TUNING.score.timeBonus;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const docs = ['README.md', 'docs/무기_및_스킬_가이드.md'].map((f) => fs.readFileSync(f, 'utf8'));

  it('explains the time bonus caps and zero point', () => {
    for (const doc of docs) {
      expect(doc).toContain('웨이브 시간 보너스');
      expect(doc).toContain(`최대 ${fmt(t.maxPerWave)}점`);
      expect(doc).toContain(`${fmt(t.maxPerWave * t.bossWaveWeight)}점`);
      expect(doc).toContain(`${t.zeroAtParMult}배`);
    }
  });

  it('describes the boss drop radius, minion count and interval ramp', () => {
    const d = GAME_TUNING.boss.minionDrop;
    const guide = fs.readFileSync('src/pc/components/GuideModal.tsx', 'utf8');
    const readme = docs[0];
    expect(readme).toContain(`${d.minRadiusM}~${d.maxRadiusM}m`);
    expect(readme).toContain(`${GAME_TUNING.boss.summonCount}마리`);
    expect(readme).toContain(`${GAME_TUNING.boss.summonIntervalMs / 1000}초에서`);
    expect(readme).toContain(`${GAME_TUNING.boss.summonAccel.minIntervalMs / 1000}초`);
    expect(guide).toContain(`${d.minRadiusM}~${d.maxRadiusM}m`);
    expect(guide).toContain(`${GAME_TUNING.boss.summonCount}마리`);
  });
});
