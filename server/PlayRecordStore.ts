import fs from 'fs';
import path from 'path';
import { PlayRunStats, RunRankingEntry, TeamRankingEntry, WeaponKind } from '../src/shared/types';
import { RANKING_RULESET_VERSION } from '../src/shared/gameTuning';

export interface PlayRecordInput {
  playedAt: string;
  deviceId: string;
  nickname: string;
  rulesetVersion: number;
  stats: PlayRunStats;
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const WEAPONS: readonly WeaponKind[] = ['shotgun', 'revolver', 'gatling'];
const NUMBER_KEYS = ['waveReached', 'livesLeft', 'durationSec', 'totalScore', 'baseScore', 'timeBonus', 'precisionBonus', 'levelBonus', 'maxCombo', 'kills', 'accuracy', 'weaponLevel'] as const;
const OPTIONAL_KEYS = ['damageTaken', 'healedLives', 'itemsCollected'] as const;
const SHOT_KEYS = ['PERFECT', 'GREAT', 'GOOD', 'MISS'] as const;
const CARD_KEYS = ['damage_up', 'skill_cooldown', 'fever_extend', 'hit_zone_up'] as const;

/** 브라우저가 보낸 값이므로 믿지 않고 형식을 확인한다. */
export function isValidPlayRunStats(v: unknown): v is PlayRunStats {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, any>;
  if (s.outcome !== 'GAMEOVER' && s.outcome !== 'VICTORY') return false;
  if (!WEAPONS.includes(s.weaponKind)) return false;
  if (!NUMBER_KEYS.every((k) => isCount(s[k]))) return false;
  if (!OPTIONAL_KEYS.every((k) => s[k] === undefined || isCount(s[k]))) return false;
  if (!s.shots || !SHOT_KEYS.every((k) => isCount(s.shots[k]))) return false;
  if (!s.cardStacks || !CARD_KEYS.every((k) => isCount(s.cardStacks[k]))) return false;
  if (!Array.isArray(s.waves) || s.waves.length > 20) return false;
  if (!s.waves.every((w: any) => w && isCount(w.wave) && isCount(w.seconds) && isCount(w.bonus))) return false;

  if (s.mode !== undefined && s.mode !== 'solo' && s.mode !== 'coop') return false;
  if (s.mode === 'coop') {
    if (!s.coop || typeof s.coop !== 'object') return false;
    const c = s.coop;
    if (c.slot !== 1 && c.slot !== 2) return false;
    if (!isCount(c.teamScore) || !isCount(c.partnerScore)) return false;
    if (typeof c.partnerDeviceId !== 'string' || c.partnerDeviceId.length > 64) return false;
    if (typeof c.partnerNickname !== 'string' || c.partnerNickname.length > 64) return false;
    if (typeof c.leftEarly !== 'boolean') return false;
  } else {
    if (s.coop !== undefined) return false;
  }

  return true;
}

/** 알 수 없는 키가 파일에 들어가지 않도록 정해진 항목만 다시 만든다. */
function pickStats(s: PlayRunStats): PlayRunStats {
  const base: PlayRunStats = {
    outcome: s.outcome,
    waveReached: s.waveReached,
    livesLeft: s.livesLeft,
    durationSec: s.durationSec,
    totalScore: s.totalScore,
    baseScore: s.baseScore,
    timeBonus: s.timeBonus,
    precisionBonus: s.precisionBonus,
    levelBonus: s.levelBonus,
    maxCombo: s.maxCombo,
    kills: s.kills,
    damageTaken: s.damageTaken ?? 0,
    healedLives: s.healedLives ?? 0,
    itemsCollected: s.itemsCollected ?? 0,
    waves: s.waves.map((w) => ({ wave: w.wave, seconds: w.seconds, bonus: w.bonus })),
    shots: { PERFECT: s.shots.PERFECT, GREAT: s.shots.GREAT, GOOD: s.shots.GOOD, MISS: s.shots.MISS },
    accuracy: s.accuracy,
    weaponKind: s.weaponKind,
    weaponLevel: s.weaponLevel,
    cardStacks: {
      damage_up: s.cardStacks.damage_up,
      skill_cooldown: s.cardStacks.skill_cooldown,
      fever_extend: s.cardStacks.fever_extend,
      hit_zone_up: s.cardStacks.hit_zone_up,
    },
    mode: s.mode === 'coop' ? 'coop' : 'solo',
  };
  if (s.mode === 'coop' && s.coop) {
    base.coop = {
      slot: s.coop.slot,
      teamScore: s.coop.teamScore,
      partnerScore: s.coop.partnerScore,
      partnerDeviceId: s.coop.partnerDeviceId,
      partnerNickname: s.coop.partnerNickname,
      leftEarly: s.coop.leftEarly,
    };
  }
  return base;
}

/** 끝난 판을 JSONL(한 줄에 JSON 하나)로 덧붙인다. 규칙 버전이 바뀌어도 파일은 지우지 않는다. */
export class PlayRecordStore {
  private filePath: string;
  private rulesetVersion: number;
  private topRuns: RunRankingEntry[] = [];
  private teamBests: Map<string, TeamRankingEntry> = new Map();

  constructor(filePath?: string, rulesetVersion: number = RANKING_RULESET_VERSION) {
    this.filePath = filePath || path.resolve(process.cwd(), 'data', 'play-records.jsonl');
    this.rulesetVersion = rulesetVersion;
    this.loadTopRuns();
  }

  /** 현재 규칙 버전의 기록에서 랭킹을 복원한다. 깨진 줄 하나로 서버가 멈추면 안 되므로 건너뛴다. */
  private loadTopRuns(): void {
    let raw = '';
    try {
      if (!fs.existsSync(this.filePath)) return;
      raw = fs.readFileSync(this.filePath, 'utf-8');
    } catch (err) {
      console.error('Failed to read play records from', this.filePath, err);
      return;
    }
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        if (r?.rulesetVersion !== this.rulesetVersion || !isValidPlayRunStats(r)) continue;
        const meta = r as unknown as { deviceId: unknown; nickname: unknown; playedAt: unknown };
        if (typeof meta.deviceId !== 'string' || typeof meta.nickname !== 'string' || typeof meta.playedAt !== 'string') continue;
        if (r.mode === 'coop') {
          this.addToTeamTop({ deviceId: meta.deviceId, nickname: meta.nickname, playedAt: meta.playedAt, stats: r });
          continue;
        }
        this.addToTop({ deviceId: meta.deviceId, nickname: meta.nickname, score: r.totalScore, waveReached: r.waveReached, weaponKind: r.weaponKind, playedAt: meta.playedAt });
      } catch {
        // 깨진 줄
      }
    }
  }

  /** 점수 내림차순, 같으면 먼저 세운 기록이 위. */
  private addToTop(entry: RunRankingEntry): void {
    this.topRuns.push(entry);
    this.topRuns.sort((a, b) => b.score - a.score || a.playedAt.localeCompare(b.playedAt));
    this.topRuns.length = Math.min(this.topRuns.length, 5);
  }

  private addToTeamTop(record: { deviceId: string; nickname: string; playedAt: string; stats: PlayRunStats }): void {
    const { deviceId, nickname, playedAt, stats } = record;
    if (stats.mode !== 'coop' || !stats.coop?.partnerDeviceId || stats.coop.partnerDeviceId.trim().length === 0) {
      return;
    }
    const coop = stats.coop;
    const me = { deviceId, nickname };
    const partner = { deviceId: coop.partnerDeviceId, nickname: coop.partnerNickname };
    const members: [{ deviceId: string; nickname: string }, { deviceId: string; nickname: string }] =
      coop.slot === 1 ? [me, partner] : [partner, me];
    const teamKey = [me.deviceId, partner.deviceId].sort().join('|');

    const existing = this.teamBests.get(teamKey);
    if (!existing || coop.teamScore > existing.teamScore) {
      this.teamBests.set(teamKey, {
        teamKey,
        members,
        teamScore: coop.teamScore,
        waveReached: stats.waveReached,
        playedAt,
      });
    }
  }

  public getTopRuns(limit = 5): RunRankingEntry[] {
    return this.topRuns.slice(0, limit).map((r) => ({ ...r }));
  }

  public getTopTeams(limit = 5): TeamRankingEntry[] {
    const list = Array.from(this.teamBests.values());
    list.sort((a, b) => b.teamScore - a.teamScore || a.playedAt.localeCompare(b.playedAt));
    return list.slice(0, limit).map((t) => ({
      teamKey: t.teamKey,
      members: [{ ...t.members[0] }, { ...t.members[1] }],
      teamScore: t.teamScore,
      waveReached: t.waveReached,
      playedAt: t.playedAt,
    }));
  }

  public append(record: PlayRecordInput): boolean {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const line = JSON.stringify({
        playedAt: record.playedAt,
        deviceId: record.deviceId,
        nickname: record.nickname,
        rulesetVersion: record.rulesetVersion,
        ...pickStats(record.stats),
      });
      fs.appendFileSync(this.filePath, `${line}\n`, 'utf-8');
      // 파일에 남은 기록만 보드에 올린다. 재시작 뒤 사라질 기록이 보이면 안 된다.
      if (record.rulesetVersion === this.rulesetVersion) {
        if (record.stats.mode === 'coop') {
          this.addToTeamTop({
            deviceId: record.deviceId,
            nickname: record.nickname,
            playedAt: record.playedAt,
            stats: record.stats,
          });
        } else {
          this.addToTop({
            deviceId: record.deviceId,
            nickname: record.nickname,
            score: record.stats.totalScore,
            waveReached: record.stats.waveReached,
            weaponKind: record.stats.weaponKind,
            playedAt: record.playedAt,
          });
        }
      }
      return true;
    } catch (err) {
      console.error('Failed to append play record to', this.filePath, err);
      return false;
    }
  }
}
