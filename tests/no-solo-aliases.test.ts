import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';

describe('no-solo-aliases guard (P01-T06)', () => {
  it('has no shortcuts (scoreManager / weaponSystem / luckyDropStacks) on engine in src/', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const walkSync = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(walkSync(fullPath));
        } else if (/\.(ts|tsx)$/.test(file)) {
          results.push(fullPath);
        }
      }
      return results;
    };

    const files = walkSync(srcDir);
    const pattern = /\bengine\.(scoreManager|weaponSystem|luckyDropStacks)\b/;
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (pattern.test(line)) {
          violations.push(`${file}:${idx + 1}: ${line.trim()}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('has no scoreManager or weaponSystem property descriptors on BeerCrusherEngine prototype', () => {
    const proto = BeerCrusherEngine.prototype;
    const descScore = Object.getOwnPropertyDescriptor(proto, 'scoreManager');
    const descWeapon = Object.getOwnPropertyDescriptor(proto, 'weaponSystem');
    const descLucky = Object.getOwnPropertyDescriptor(proto, 'luckyDropStacks');

    expect(descScore).toBeUndefined();
    expect(descWeapon).toBeUndefined();
    expect(descLucky).toBeUndefined();
  });
});
