import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PlayRecordStore, isValidPlayRunStats } from '../server/PlayRecordStore';
import { PlayRunStats } from '../src/shared/types';

export const stats = (over: Partial<PlayRunStats> = {}): PlayRunStats => ({
  outcome: 'VICTORY', waveReached: 7, livesLeft: 3, durationSec: 200, totalScore: 20000, baseScore: 12000,
  timeBonus: 5000, precisionBonus: 3000, maxCombo: 90, kills: 180,
  waves: [{ wave: 1, seconds: 14, bonus: 500 }],
  shots: { PERFECT: 30, GREAT: 40, GOOD: 10, MISS: 20 }, accuracy: 0.7,
  weaponKind: 'gatling', weaponLevel: 4,
  cardStacks: { damage_up: 1, skill_cooldown: 0, fever_extend: 2, hit_zone_up: 0 },
  ...over,
});

const rec = (over: Partial<PlayRunStats> = {}, extra: Record<string, unknown> = {}) => ({
  playedAt: '2026-11-05T00:00:00.000Z', deviceId: 'd1', nickname: '두둥', rulesetVersion: 4, stats: { ...stats(over), ...extra } as PlayRunStats,
});

describe('play records', () => {
  let dir: string;
  let file: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'records-'));
    file = path.join(dir, 'nested', 'play-records.jsonl');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('appends one JSON line per run with every field', () => {
    const s = new PlayRecordStore(file);
    expect(s.append(rec())).toBe(true);
    expect(s.append(rec({ totalScore: 5 }))).toBe(true);
    const lines = fs.readFileSync(file, 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
    expect(lines.length).toBe(2);
    expect(lines[0]).toMatchObject({ nickname: '두둥', maxCombo: 90, kills: 180, weaponKind: 'gatling', weaponLevel: 4, rulesetVersion: 4 });
    expect(lines[0].shots.PERFECT).toBe(30);
    expect(lines[0].cardStacks.fever_extend).toBe(2);
    expect(lines[1].totalScore).toBe(5);
  });

  it('does not store unknown keys', () => {
    new PlayRecordStore(file).append(rec({}, { hacked: 'x' }));
    expect(fs.readFileSync(file, 'utf-8')).not.toContain('hacked');
  });

  it('a write failure returns false without throwing', () => {
    expect(new PlayRecordStore(dir).append(rec())).toBe(false);
  });

  it('validates the shape', () => {
    expect(isValidPlayRunStats(stats())).toBe(true);
    for (const bad of [{ totalScore: NaN }, { kills: -1 }, { weaponKind: 'laser' }, { outcome: 'x' }, { waves: 'no' }]) {
      expect(isValidPlayRunStats({ ...stats(), ...bad })).toBe(false);
    }
    expect(isValidPlayRunStats({ ...stats(), shots: { PERFECT: 1 } })).toBe(false);
    expect(isValidPlayRunStats(undefined)).toBe(false);
  });
});
