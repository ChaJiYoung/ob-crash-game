import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PlayRecordStore, isValidPlayRunStats } from '../server/PlayRecordStore';
import { PlayRunStats } from '../src/shared/types';

export const stats = (over: Partial<PlayRunStats> = {}): PlayRunStats => ({
  outcome: 'VICTORY', waveReached: 7, livesLeft: 3, durationSec: 200, totalScore: 20000, baseScore: 12000,
  timeBonus: 5000, precisionBonus: 3000, levelBonus: 0, maxCombo: 90, kills: 180,
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

  describe('run ranking', () => {
    const at = (t: string, score: number, deviceId = 'd1') => ({ ...rec({ totalScore: score }), playedAt: t, deviceId });

    it('keeps the top 5 runs, the same player can repeat, ties go to the earlier run', () => {
      const s = new PlayRecordStore(file, 4);
      [10, 50, 30, 60, 20, 40].forEach((v, i) => s.append(at(`2026-11-05T00:00:0${i}Z`, v)));
      s.append(at('2026-11-05T00:01:00Z', 60, 'd2'));
      const top = s.getTopRuns();
      expect(top.map((r) => r.score)).toEqual([60, 60, 50, 40, 30]);
      expect(top[0].deviceId).toBe('d1');
      expect(top[1].deviceId).toBe('d2');
      expect(top[0]).toMatchObject({ waveReached: 7, weaponKind: 'gatling' });
    });

    it('restores after a restart, skipping broken lines and other rulesets', () => {
      const s = new PlayRecordStore(file, 4);
      s.append(at('2026-11-05T00:00:00Z', 100));
      fs.appendFileSync(file, '{broken\n');
      fs.appendFileSync(file, `${JSON.stringify({ ...stats({ totalScore: 999 }), rulesetVersion: 3, deviceId: 'x', nickname: 'x', playedAt: 'y' })}\n`);
      expect(new PlayRecordStore(file, 4).getTopRuns().map((r) => r.score)).toEqual([100]);
    });

    it('older records without the damage fields stay on the ranking', () => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify({ ...stats({ totalScore: 777 }), rulesetVersion: 4, deviceId: 'o', nickname: 'o', playedAt: 't' })}\n`);
      expect(new PlayRecordStore(file, 4).getTopRuns().map((r) => r.score)).toEqual([777]);
    });

    it('stores the damage fields, defaulting to 0', () => {
      const s = new PlayRecordStore(file, 4);
      s.append(at('t1', 1));
      s.append({ ...at('t2', 2), stats: { ...stats({ totalScore: 2 }), damageTaken: 3, healedLives: 2, itemsCollected: 5 } });
      const lines = fs.readFileSync(file, 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
      expect(lines[0]).toMatchObject({ damageTaken: 0, healedLives: 0, itemsCollected: 0 });
      expect(lines[1]).toMatchObject({ damageTaken: 3, healedLives: 2, itemsCollected: 5 });
      expect(isValidPlayRunStats({ ...stats(), damageTaken: -1 })).toBe(false);
    });

    it('a failed write stays off the board', () => {
      const s = new PlayRecordStore(dir, 4);
      s.append(at('2026-11-05T00:00:00Z', 100));
      expect(s.getTopRuns()).toEqual([]);
    });
  });

  describe('input kind and card picks (playtest-feedback P01-T01)', () => {
    it('validates inputKind, partner fields and cardPicks', () => {
      expect(isValidPlayRunStats(stats({ inputKind: 'mouse' }))).toBe(true);
      expect(isValidPlayRunStats({ ...stats(), inputKind: 'keyboard' })).toBe(false);
      const pick = { wave: 4, kind: 'damage_up', midWave: true, auto: false };
      expect(isValidPlayRunStats(stats({ cardPicks: [pick as any] }))).toBe(true);
      expect(isValidPlayRunStats({ ...stats(), cardPicks: [{ ...pick, kind: 'nope' }] })).toBe(false);
      expect(isValidPlayRunStats({ ...stats(), cardPicks: Array(61).fill(pick) })).toBe(false);
      const coop = { slot: 1, teamScore: 3, partnerScore: 1, partnerDeviceId: 'p', partnerNickname: 'P', leftEarly: false };
      expect(isValidPlayRunStats({ ...stats(), mode: 'coop', coop: { ...coop, partnerWeaponKind: 'shotgun', partnerInputKind: 'mobile' } })).toBe(true);
      expect(isValidPlayRunStats({ ...stats(), mode: 'coop', coop: { ...coop, partnerWeaponKind: 'bazooka' } })).toBe(false);
      expect(isValidPlayRunStats({ ...stats(), mode: 'coop', coop: { ...coop, partnerInputKind: 'pad' } })).toBe(false);
    });

    it('stores the new fields and puts the input icon on the solo board', () => {
      const s = new PlayRecordStore(file);
      s.append({ ...rec({ inputKind: 'mobile', cardPicks: [{ wave: 4, kind: 'damage_up', midWave: true, auto: false }] }), rulesetVersion: (s as any).rulesetVersion });
      const line = JSON.parse(fs.readFileSync(file, 'utf-8').trim());
      expect(line.inputKind).toBe('mobile');
      expect(line.cardPicks).toEqual([{ wave: 4, kind: 'damage_up', midWave: true, auto: false }]);
      expect(s.getTopRuns()[0].inputKind).toBe('mobile');
      const reloaded = new PlayRecordStore(file);
      expect(reloaded.getTopRuns()[0].inputKind).toBe('mobile');
    });

    it('old records without the new fields load with no inputKind key', () => {
      const s = new PlayRecordStore(file);
      s.append({ ...rec(), rulesetVersion: (s as any).rulesetVersion });
      const line = JSON.parse(fs.readFileSync(file, 'utf-8').trim());
      expect('inputKind' in line).toBe(false);
      expect('cardPicks' in line).toBe(false);
      expect('inputKind' in new PlayRecordStore(file).getTopRuns()[0]).toBe(false);
    });

    it('team board members carry each score, weapon and input', () => {
      const s = new PlayRecordStore(file);
      s.append({
        ...rec({
          mode: 'coop', totalScore: 12000, weaponKind: 'shotgun', inputKind: 'mobile',
          coop: { slot: 2, teamScore: 20000, partnerScore: 8000, partnerDeviceId: 'd2', partnerNickname: '둘', leftEarly: false, partnerWeaponKind: 'revolver', partnerInputKind: 'mouse' },
        }),
        rulesetVersion: (s as any).rulesetVersion,
      });
      expect(s.getTopTeams()[0].members).toEqual([
        { deviceId: 'd2', nickname: '둘', score: 8000, weaponKind: 'revolver', inputKind: 'mouse' },
        { deviceId: 'd1', nickname: '두둥', score: 12000, weaponKind: 'shotgun', inputKind: 'mobile' },
      ]);
    });
  });
});
