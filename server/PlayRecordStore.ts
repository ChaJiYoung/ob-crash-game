import fs from 'fs';
import path from 'path';
import { PlayRunStats, WeaponKind } from '../src/shared/types';

export interface PlayRecordInput {
  playedAt: string;
  deviceId: string;
  nickname: string;
  rulesetVersion: number;
  stats: PlayRunStats;
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const WEAPONS: readonly WeaponKind[] = ['shotgun', 'revolver', 'gatling'];
const NUMBER_KEYS = ['waveReached', 'livesLeft', 'durationSec', 'totalScore', 'baseScore', 'timeBonus', 'precisionBonus', 'maxCombo', 'kills', 'accuracy', 'weaponLevel'] as const;
const SHOT_KEYS = ['PERFECT', 'GREAT', 'GOOD', 'MISS'] as const;
const CARD_KEYS = ['damage_up', 'skill_cooldown', 'fever_extend', 'hit_zone_up'] as const;

/** 브라우저가 보낸 값이므로 믿지 않고 형식을 확인한다. */
export function isValidPlayRunStats(v: unknown): v is PlayRunStats {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, any>;
  if (s.outcome !== 'GAMEOVER' && s.outcome !== 'VICTORY') return false;
  if (!WEAPONS.includes(s.weaponKind)) return false;
  if (!NUMBER_KEYS.every((k) => isCount(s[k]))) return false;
  if (!s.shots || !SHOT_KEYS.every((k) => isCount(s.shots[k]))) return false;
  if (!s.cardStacks || !CARD_KEYS.every((k) => isCount(s.cardStacks[k]))) return false;
  if (!Array.isArray(s.waves) || s.waves.length > 20) return false;
  return s.waves.every((w: any) => w && isCount(w.wave) && isCount(w.seconds) && isCount(w.bonus));
}

/** 알 수 없는 키가 파일에 들어가지 않도록 정해진 항목만 다시 만든다. */
function pickStats(s: PlayRunStats): PlayRunStats {
  return {
    outcome: s.outcome,
    waveReached: s.waveReached,
    livesLeft: s.livesLeft,
    durationSec: s.durationSec,
    totalScore: s.totalScore,
    baseScore: s.baseScore,
    timeBonus: s.timeBonus,
    precisionBonus: s.precisionBonus,
    maxCombo: s.maxCombo,
    kills: s.kills,
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
  };
}

/** 끝난 판을 JSONL(한 줄에 JSON 하나)로 덧붙인다. 규칙 버전이 바뀌어도 파일은 지우지 않는다. */
export class PlayRecordStore {
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || path.resolve(process.cwd(), 'data', 'play-records.jsonl');
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
      return true;
    } catch (err) {
      console.error('Failed to append play record to', this.filePath, err);
      return false;
    }
  }
}
