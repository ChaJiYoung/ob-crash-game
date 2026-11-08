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
  { pattern: /탄착군 확산|근접 넉백|넉백 밀쳐내기|근접 ?산탄/, why: 'shotgun has no spread stat and its knockback is minor' },
  { pattern: /불릿 타임|오프너 부메랑|160도|오버히트/, why: 'the revolver skill is fan blades and the foam wave covers the whole field' },
  { pattern: /쉴드를 두른|방패가 풀립니다|대왕 쉴드|쉴드를 풀/, why: 'the king shield was removed' },
  { pattern: /붉은 포탄|빛나는 구|거품 투사체|거품\/병뚜껑 투사체/, why: 'enemy shells are brown poop now' },
  { pattern: /8초에서 시작|5초까지 짧아|소환이 빨라져|시간을 끌면 소환/, why: 'boss summons follow boss HP, not a timer' },
  { pattern: /듀얼 골드 탭|듀얼 탭 레버|크롬 드래프트 타워/, why: 'the coolers have front taps now' },
  { pattern: /공중에서 (사격|요격)|⚠️ 보스 등장/, why: 'shells stay on the floor and the warning is a WARNING band' },
  { pattern: /한맥과 보스|한맥·보스|11m (에서 )?정지|멈춰 서서 포격/, why: 'hanmac is a bomb can and only bosses fire shells' },
  { pattern: /MISS 페널티 완전 폐지/, why: 'misses now cost ammo and reload time' },
  { pattern: /8초마다 (부하|소환)|부하를 8초마다|4마리를 공유/, why: 'boss summons are HP-driven now, not a shared timer' },
  { pattern: /\+150 PTS|\+100 PTS|\+50 PTS|\+500점|\+1,500점|2배 화력|기본 피해의 3배/, why: 'scores are scaled by GAME_TUNING.score.scale (x0.1) and fever no longer boosts damage' },
  { pattern: /위로 휙! \/ 우클릭/, why: '스킬 안내는 입력 방식별 하나(D09)' },
  { pattern: /10초.*자동 선택|자동 선택.*10초/, why: '선택 시간 제한 없음(D34)' },
  { pattern: /튜토리얼.*(넉넉|넓은) (판정|명중)/, why: '연습 판정이 실전과 같음(D30)' },
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
        if (kind === 'revolver') expected.push(`${spec.skillBladeCount}개·관통 ${spec.skillBladePierce}`);
        if (kind === 'gatling') expected.push(`| ${spec.skillKnockbackM}m |`);
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

describe('wave time bonus and boss summon rules are documented with the tuned numbers', () => {
  const t = GAME_TUNING.score.timeBonus;
  const b = GAME_TUNING.boss;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const sec = (ms: number) => ms / 1000;
  const read = (f: string) => fs.readFileSync(f, 'utf8');
  const area = `${b.minionDrop.minRadiusM}~${b.minionDrop.maxRadiusM}m`;

  it('explains the time bonus caps and zero point with full phrases', () => {
    for (const doc of [read('README.md'), read('docs/무기_및_스킬_가이드.md')]) {
      expect(doc).toContain('웨이브 시간 보너스');
      expect(doc).toContain(`웨이브당 최대 ${fmt(t.maxPerWave)}점`);
      expect(doc).toContain(`보스 웨이브는 ${fmt(t.maxPerWave * t.bossWaveWeight)}점`);
      expect(doc).toContain(`기준 시간의 ${t.zeroAtParMult}배에서 0점`);
    }
  });

  it('describes the boss summon in every document that talks about it', () => {
    const pct = '99% / 66% / 33%';
    expect(b.summonHpThresholds.map((v) => Math.round(v * 100))).toEqual([99, 66, 33]);
    expect(read('README.md')).toContain(`체력이 ${pct} 아래로 내려갈 때마다`);
    expect(read('README.md')).toContain(`${b.summonCountByStep.join('·')}마리씩 필드 ${area}`);
    expect(read('docs/몬스터_도감_설명서.md')).toContain(`부하 ${b.summonCountByStep.join('·')}마리를 필드 ${area}`);
    expect(read('docs/몬스터_도감_설명서.md')).toContain(`체력이 ${pct} 아래로 내려갈 때마다`);
    expect(read('docs/비어 크러셔 요구사항 분석서.md')).toContain(`부하 ${b.summonCountByStep.join('·')}마리를 소환`);
    expect(read('docs/비어 크러셔 요구사항 분석서.md')).toContain(`필드 ${area}에 위에서 떨어지고`);
    expect(read('docs/비어 크러셔 상세설계서.md')).toContain(`한 번에 ${b.summonCountByStep.join('·')}마리를 필드 ${area}`);
    expect(read('docs/튜토리얼_훈련장_가이드.md')).toContain(`필드 ${area}에 위에서 떨어집니다`);
  });

  it('keeps the in-game guide numbers tied to GAME_TUNING instead of hard-coded text', () => {
    const guide = read('src/pc/components/GuideModal.tsx');
    expect(guide).toContain('GAME_TUNING.boss.summonCountByStep');
    expect(guide).toContain('GAME_TUNING.boss.minionDrop.minRadiusM');
    expect(guide).toContain('GAME_TUNING.score.timeBonus.maxPerWave');
    expect(guide).toContain('GAME_TUNING.score.timeBonus.zeroAtParMult');
  });

  it('documents the boss HP and the bottle speed with the tuned numbers, and mid-wave cards only in waves 4 and 6', () => {
    const w = GAME_TUNING.waves;
    const hp = (i: number) => w[i].boss!;
    const bestiary = read('docs/몬스터_도감_설명서.md');
    expect(bestiary).toContain(`| 3 | 냉각기 1대 | ${hp(2).coolerHp[0]} |`);
    expect(bestiary).toContain(`| 5 | 냉각기 2대 | 각 ${hp(4).coolerHp[0]} |`);
    expect(bestiary).toContain(`각 ${hp(6).coolerHp[0]} + 대왕 ${hp(6).kingHp}`);
    expect(read('README.md')).toContain(`대왕 냉각기(${hp(6).kingHp})`);
    expect(bestiary).toContain(`${GAME_TUNING.monsters.bottle.childSpeedMps.toFixed(1)} m/s)로 분열`);

    // Mid-wave cards exist only in waves 4 and 6; the boss waves have none (that was the card-farming hole)
    expect(w.map((x) => x.cardKillTarget)).toEqual([null, null, null, 22, null, 26, null]);
    for (const doc of [read('README.md'), read('docs/구동화면_쇼케이스.md')]) {
      expect(doc).toContain('4·6웨이브 중간(22킬/26킬)');
    }
    expect(read('docs/무기_및_스킬_가이드.md')).toContain('4웨이브(22킬)·6웨이브(26킬) 중간');
    expect(read('docs/몬스터_도감_설명서.md')).toContain('22킬에 중간 카드');
    expect(read('docs/몬스터_도감_설명서.md')).toContain('26킬에 중간 카드');
    for (const f of ['README.md', 'docs/무기_및_스킬_가이드.md', 'docs/구동화면_쇼케이스.md', 'docs/몬스터_도감_설명서.md', 'docs/비어 크러셔 요구사항 분석서.md']) {
      expect(read(f)).not.toMatch(/(3|5|7)웨이브 ?\(?(24|40|44)킬/);
    }
  });

  it('describes the boss arriving mid-wave with regular monsters kept coming', () => {
    const pct = `${Math.round(GAME_TUNING.boss.encounterStartRatio * 100)}%`;
    expect(GAME_TUNING.boss.encounterStartRatio).toBe(0.5);
    for (const f of ['README.md', 'docs/몬스터_도감_설명서.md', 'docs/튜토리얼_훈련장_가이드.md']) {
      expect(read(f)).toContain('보스가 살아 있는 동안에도 일반 몬스터가 계속 나옵니다');
    }
    expect(read('docs/비어 크러셔 요구사항 분석서.md')).toContain('보스가 살아 있는 동안에도 일반 몬스터가 계속 나오고');
    expect(read('docs/비어 크러셔 상세설계서.md')).toContain('보스가 살아 있는 동안 일반 몬스터는');
    const guide = read('src/pc/components/GuideModal.tsx');
    expect(guide).toContain('GAME_TUNING.boss.encounterStartRatio');
    expect(guide).toContain('MID_CARD_TEXT');
    expect(pct).toBe('50%');
  });

  it('documents the repair card heal amount and that bar repair no longer drops', () => {
    const heal = GAME_TUNING.repairCard.healAmount;
    expect(read('README.md')).toContain(`바리케이드 수리\`(체력 +${heal})`);
    expect(read('docs/몬스터_도감_설명서.md')).toContain('처치 드롭에서는 나오지 않음');
    expect(read('docs/비어 크러셔 요구사항 분석서.md')).toContain('펍 아이템 3종(파워샷/빅스코프/프리즈)');
    expect(read('docs/비어 크러셔 상세설계서.md')).toContain('GAME_TUNING.itemDropKinds');
  });

  it('keeps the fever wording precise: only hit points get x1.5, not kill bonuses', () => {
    for (const f of ['README.md', 'docs/무기_및_스킬_가이드.md']) expect(read(f)).toContain('명중 점수 1.5배');
  });
});

describe('guard cycle and reload multiplier are documented with the tuned numbers', () => {
  const bestiary = fs.readFileSync('docs/몬스터_도감_설명서.md', 'utf8');
  const readme = fs.readFileSync('README.md', 'utf8');
  const tutorial = fs.readFileSync('docs/튜토리얼_훈련장_가이드.md', 'utf8');
  const { guardUpMs, guardDownMs } = GAME_TUNING.monsters.obi;

  it('the bestiary states the obi shield cycle', () => {
    expect(bestiary).toContain(`${guardUpMs / 1000}초 들고 ${guardDownMs / 1000}초 내`);
  });

  it('no document keeps the old hard-coded reload or shield numbers', () => {
    [bestiary, readme, tutorial].forEach((doc) => {
      expect(doc).not.toContain('1.5초 들고 1.5초');
      expect(doc).not.toContain('(1.2s)');
      expect(doc).not.toContain('1.2초 뒤');
    });
  });

  it('the README states the reload multiplier', () => {
    expect(readme).toContain(`기본의 ${GAME_TUNING.fire.reloadScale}배`);
  });
});

describe('doc ranges and wording are derived from the tuned tables', () => {
  const kinds = ['shotgun', 'revolver', 'gatling'] as const;
  const levels = [1, 2, 3, 4] as const;
  const ammoRange = (kind: (typeof kinds)[number]) => {
    const v = levels.map((lv) => WEAPON_ARCHETYPE_SPECS[kind].levels[lv].maxAmmo);
    return `${Math.min(...v)} ~ ${Math.max(...v)}발`;
  };
  const allReloadSec = kinds.flatMap((k) => levels.map((lv) => WEAPON_ARCHETYPE_SPECS[k].levels[lv].reloadDurationMs / 1000));
  const reloadMin = Math.min(...allReloadSec).toFixed(1);
  const reloadMax = Math.max(...allReloadSec).toFixed(1);
  const allAmmo = kinds.flatMap((k) => levels.map((lv) => WEAPON_ARCHETYPE_SPECS[k].levels[lv].maxAmmo));

  it('the weapon guide overview table lists each weapon magazine range', () => {
    const doc = fs.readFileSync('docs/무기_및_스킬_가이드.md', 'utf8');
    kinds.forEach((kind) => {
      const row = doc.split('\n').find((l) => l.startsWith(`| **\`${kind}\`**`));
      expect(row, `${kind} overview row`).toBeDefined();
      expect(row).toContain(ammoRange(kind));
    });
  });

  it('reload time ranges in the tutorial guide and the showcase match the specs', () => {
    const tutorial = fs.readFileSync('docs/튜토리얼_훈련장_가이드.md', 'utf8');
    const showcase = fs.readFileSync('docs/구동화면_쇼케이스.md', 'utf8');
    const tutorialRow = tutorial.split('\n').find((l) => l.includes('탄창 재장전'));
    expect(tutorialRow).toContain(`${reloadMin}s~${reloadMax}s`);
    const showcaseLine = showcase.split('\n').find((l) => l.includes('자동 재장전'));
    expect(showcaseLine).toContain(`${reloadMin}~${reloadMax}초`);
    expect(showcase).toContain(`${Math.min(...allAmmo)}~${Math.max(...allAmmo)}발`);
  });

  it('the README lists the skill cooldowns from the tuning table', () => {
    const readme = fs.readFileSync('README.md', 'utf8');
    const cd = Object.values(GAME_TUNING.skillCooldownMsByLevel).map((ms) => ms / 1000).join('/');
    expect(readme).toContain(`${cd}초`);
  });

  it('no document says fever shots pierce the obi shield (only skills do)', () => {
    ['docs/몬스터_도감_설명서.md', 'docs/비어 크러셔 요구사항 분석서.md', 'docs/비어 크러셔 상세설계서.md'].forEach((file) => {
      expect(fs.readFileSync(file, 'utf8'), file).not.toMatch(/피버·스킬.{0,8}(관통|뚫)/);
    });
  });

  it('the tutorial guide does not claim R reloads (R fires the skill)', () => {
    const tutorial = fs.readFileSync('docs/튜토리얼_훈련장_가이드.md', 'utf8');
    expect(tutorial).not.toMatch(/재장전\*\*: `R`/);
  });
});
