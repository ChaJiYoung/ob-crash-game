import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { MONSTER_DETAILS } from '../src/pc/components/guide/MonstersTab';
import { ITEM_DETAILS } from '../src/pc/components/guide/ItemsTab';

describe('guide images are served from public/guide', () => {
  const all = [...Object.values(MONSTER_DETAILS), ...Object.values(ITEM_DETAILS)]
    .map((d) => d.imageSrc)
    .filter((s): s is string => !!s);

  it('covers every monster and item', () => {
    expect(all.length).toBe(Object.keys(MONSTER_DETAILS).length + Object.keys(ITEM_DETAILS).length);
  });

  it('every imageSrc points to /guide and the file exists under public/ (so it is in dist/ too)', () => {
    all.forEach((src) => {
      expect(src.startsWith('/guide/')).toBe(true);
      expect(fs.existsSync(path.join('public', src)), `${src} is missing under public/`).toBe(true);
    });
  });

  it('no guide image still points at docs/screens (dev-server-only path)', () => {
    all.forEach((src) => expect(src).not.toContain('/docs/'));
  });
});
