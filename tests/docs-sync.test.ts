import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/** Guards against old specs creeping back into player-facing text (gameplay-polish P05-T02). */
const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /INTERCEPTED/, why: 'the intercept banner was removed' },
  { pattern: /바 카운터/, why: 'the bar counter wall was replaced by a floor neon line' },
  { pattern: /호쾌하게 난사|통쾌한 난사|부담 없이 통쾌|부담 없이 호쾌/, why: 'spraying is no longer encouraged' },
  { pattern: /1\.5배 데미지|1\.5x|0\.8배|0\.8x/, why: 'judgment damage is 2.0 / 1.0 / 0.5' },
  { pattern: /5단계 (아케이드|테마)/, why: 'the game has 7 waves' },
  { pattern: /카드 5종|5종 보상 카드|보상 카드 5종/, why: 'there are 9 reward cards' },
  { pattern: /MISS 페널티 완전 폐지/, why: 'misses now cost ammo and reload time' },
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

  it('tutorial overlay shows the final judgment multipliers', () => {
    const src = fs.readFileSync('src/pc/components/TutorialGuideOverlay.tsx', 'utf8');
    expect(src).toContain('2.0x/1.0x/0.5x');
    expect(src).toContain('PERFECT(2.0배)');
    expect(src).toContain('GOOD(0.5배)');
  });

  it('guide modal reads judgment and fever numbers from GAME_TUNING', () => {
    const src = fs.readFileSync('src/pc/components/GuideModal.tsx', 'utf8');
    expect(src).toContain('GAME_TUNING.judgment.perfectDamage');
    expect(src).toContain('GAME_TUNING.fever.killDelta');
  });
});
