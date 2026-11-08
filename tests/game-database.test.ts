import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameDatabase } from '../server/db/GameDatabase';

const now = '2026-11-08T00:00:00.000Z';

describe('GameDatabase', () => {
  let db: GameDatabase;

  const addPlayer = (id: string) =>
    db.conn
      .prepare(
        `INSERT INTO players (id, nickname, last_seen_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, `닉${id}`.slice(0, 10), now, now, now);

  const addGame = (over: Record<string, unknown> = {}): number => {
    const row = {
      room_id: 'ROOM',
      mode: 'solo',
      player_count: 1,
      team_key: null,
      ruleset_version: 5,
      status: 'playing',
      outcome: null,
      total_score: null,
      wave_reached: null,
      duration_sec: null,
      started_at: now,
      ended_at: null,
      ...over,
    };
    const r = db.conn
      .prepare(
        `INSERT INTO games (room_id, mode, player_count, team_key, ruleset_version, status, outcome,
           total_score, wave_reached, duration_sec, started_at, ended_at)
         VALUES (@room_id, @mode, @player_count, @team_key, @ruleset_version, @status, @outcome,
           @total_score, @wave_reached, @duration_sec, @started_at, @ended_at)`,
      )
      .run(row);
    return Number(r.lastInsertRowid);
  };

  const addGamePlayer = (gameId: number, playerId: string, slot: number, extra: Record<string, unknown> = {}) => {
    const cols = ['game_id', 'player_id', 'slot', ...Object.keys(extra)];
    return db.conn
      .prepare(`INSERT INTO game_players (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
      .run(gameId, playerId, slot, ...Object.values(extra));
  };

  const count = (table: string) =>
    (db.conn.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;

  beforeEach(() => {
    db = new GameDatabase(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('5개 테이블과 PRAGMA, 인덱스를 만든다', () => {
    const tables = (
      db.conn.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]
    ).map((r) => r.name);
    for (const t of ['players', 'games', 'game_players', 'game_waves', 'game_player_card_picks']) {
      expect(tables).toContain(t);
    }
    const indexes = (
      db.conn.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'`).all() as {
        name: string;
      }[]
    ).map((r) => r.name);
    expect(indexes).toHaveLength(4);
    expect(db.conn.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.conn.pragma('user_version', { simple: true })).toBe(1);
  });

  it('finished인데 outcome이 NULL이면 거절한다', () => {
    expect(() =>
      addGame({ status: 'finished', total_score: 1, wave_reached: 1, duration_sec: 1, ended_at: now }),
    ).toThrow(/CHECK constraint failed/);
  });

  it('coop은 team_key 필수, solo는 team_key 금지', () => {
    expect(() => addGame({ mode: 'coop', player_count: 2, team_key: null })).toThrow(/CHECK constraint failed/);
    expect(() => addGame({ mode: 'solo', team_key: 'a|b' })).toThrow(/CHECK constraint failed/);
    expect(() => addGame({ mode: 'coop', player_count: 2, team_key: 'a|b' })).not.toThrow();
  });

  it('game_players의 slot, player_id 중복은 UNIQUE로 거절한다', () => {
    addPlayer('a');
    addPlayer('b');
    const g = addGame({ mode: 'coop', player_count: 2, team_key: 'a|b' });
    addGamePlayer(g, 'a', 1);
    expect(() => addGamePlayer(g, 'b', 1)).toThrow(/UNIQUE/);
    expect(() => addGamePlayer(g, 'a', 2)).toThrow(/UNIQUE/);
  });

  it('참조 중인 players 삭제는 FK로 거절한다(RESTRICT)', () => {
    addPlayer('a');
    const g = addGame();
    addGamePlayer(g, 'a', 1);
    expect(() => db.conn.prepare(`DELETE FROM players WHERE id = 'a'`).run()).toThrow(/FOREIGN KEY/);
  });

  it('games 삭제는 하위 행까지 CASCADE', () => {
    addPlayer('a');
    const g = addGame();
    const gp = Number(addGamePlayer(g, 'a', 1).lastInsertRowid);
    db.conn.prepare(`INSERT INTO game_waves (game_id, wave_num, seconds, bonus) VALUES (?, 1, 10.5, 0)`).run(g);
    db.conn
      .prepare(
        `INSERT INTO game_player_card_picks (game_player_id, pick_order, wave_num, card_kind, mid_wave, auto_picked)
         VALUES (?, 0, 1, 'damage_up', 0, 0)`,
      )
      .run(gp);
    db.conn.prepare(`DELETE FROM games WHERE id = ?`).run(g);
    expect(count('game_players')).toBe(0);
    expect(count('game_waves')).toBe(0);
    expect(count('game_player_card_picks')).toBe(0);
  });

  it('accuracy 범위, weapon_level 범위, submitted_at 필수 필드를 검사한다', () => {
    addPlayer('a');
    addPlayer('b');
    addPlayer('c');
    const g = addGame({ mode: 'coop', player_count: 2, team_key: 'a|b' });
    expect(() => addGamePlayer(g, 'a', 1, { accuracy: 1.5 })).toThrow(/CHECK constraint failed/);
    expect(() => addGamePlayer(g, 'b', 2, { weapon_level: 0 })).toThrow(/CHECK constraint failed/);
    const g2 = addGame();
    expect(() => addGamePlayer(g2, 'c', 1, { submitted_at: now })).toThrow(/CHECK constraint failed/);
  });

  it('transaction은 throw 시 전부 롤백한다', () => {
    expect(() =>
      db.transaction(() => {
        addPlayer('a');
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(count('players')).toBe(0);
    db.transaction(() => addPlayer('a'));
    expect(count('players')).toBe(1);
  });

  it('파일 경로: 폴더 생성, WAL, 재오픈과 이중 close', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gamedb-'));
    try {
      const file = path.join(dir, 'nested', 'game.db');
      const first = new GameDatabase(file);
      expect(fs.existsSync(path.dirname(file))).toBe(true);
      expect(first.conn.pragma('journal_mode', { simple: true })).toBe('wal');
      first.close();
      first.close();
      const second = new GameDatabase(file);
      expect(second.conn.pragma('user_version', { simple: true })).toBe(1);
      second.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
