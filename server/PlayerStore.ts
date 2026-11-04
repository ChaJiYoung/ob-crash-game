import fs from 'node:fs';
import path from 'node:path';
import { PlayerProfile } from '../src/shared/types';
import { RANKING_RULESET_VERSION } from '../src/shared/gameTuning';

export interface PlayerStoreData {
  /** 파일에 없으면 1(이전 5웨이브 규칙)로 본다. */
  rulesetVersion?: number;
  players: Record<string, PlayerProfile>;
}

export class PlayerStore {
  private filePath: string;
  private data: PlayerStoreData = { rulesetVersion: RANKING_RULESET_VERSION, players: {} };

  constructor(filePath?: string) {
    this.filePath = filePath || path.resolve(process.cwd(), 'data', 'players.json');
    this.load();
  }

  private load(): void {
    let fileMissing = false;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.players === 'object' &&
          parsed.players !== null &&
          !Array.isArray(parsed.players)
        ) {
          this.data = this.migrateRuleset(parsed, raw);
          return;
        }
      } else {
        fileMissing = true;
      }
    } catch {
      // If reading fails or file is malformed, start with empty store
    }
    this.data = { rulesetVersion: RANKING_RULESET_VERSION, players: {} };
    if (fileMissing) this.save();
  }

  /**
   * 규칙 버전이 다르면 원본을 그대로 백업한 뒤 점수만 초기화한다(닉네임과 기기 연결은 유지).
   * 백업이 실패하면 아무것도 지우지 않는다.
   */
  private migrateRuleset(parsed: PlayerStoreData, raw: string): PlayerStoreData {
    const oldVersion = parsed.rulesetVersion ?? 1;
    if (oldVersion === RANKING_RULESET_VERSION) {
      return parsed;
    }

    const backupPath = `${this.filePath}.ruleset-${oldVersion}.bak`;
    try {
      if (!fs.existsSync(backupPath)) {
        fs.writeFileSync(backupPath, raw, 'utf-8');
      }
    } catch (err) {
      console.error('Ranking backup failed; keeping existing scores untouched:', backupPath, err);
      return parsed;
    }

    for (const profile of Object.values(parsed.players)) {
      profile.bestScore = 0;
      profile.totalGames = 0;
    }
    parsed.rulesetVersion = RANKING_RULESET_VERSION;
    this.data = parsed;
    this.save();
    return parsed;
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save players to', this.filePath, err);
    }
  }

  public findByDeviceId(deviceId: string): PlayerProfile | undefined {
    if (Object.prototype.hasOwnProperty.call(this.data.players, deviceId)) {
      return this.data.players[deviceId];
    }
    return undefined;
  }

  public registerOrUpdateNickname(deviceId: string, nickname: string): PlayerProfile {
    const trimmed = nickname.trim();
    if (trimmed.length < 2 || trimmed.length > 10) {
      throw new Error('INVALID_NICKNAME: Nickname must be 2 to 10 characters');
    }

    const existing = this.data.players[deviceId];
    const now = new Date().toISOString();
    if (existing) {
      existing.nickname = trimmed;
      existing.lastPlayedAt = now;
      this.save();
      return existing;
    }

    const newProfile: PlayerProfile = {
      deviceId,
      nickname: trimmed,
      bestScore: 0,
      totalGames: 0,
      lastPlayedAt: now,
    };
    this.data.players[deviceId] = newProfile;
    this.save();
    return newProfile;
  }

  public recordGameScore(
    deviceId: string,
    score: number
  ): { profile: PlayerProfile; isNewRecord: boolean; rankings: PlayerProfile[] } {
    let profile = this.data.players[deviceId];
    const now = new Date().toISOString();
    let isNewRecord = false;

    if (!profile) {
      profile = {
        deviceId,
        nickname: `맥주고수_${deviceId.slice(0, 4)}`,
        bestScore: score,
        totalGames: 1,
        lastPlayedAt: now,
      };
      this.data.players[deviceId] = profile;
      isNewRecord = true;
    } else {
      profile.totalGames += 1;
      profile.lastPlayedAt = now;
      if (score > profile.bestScore) {
        profile.bestScore = score;
        isNewRecord = true;
      }
    }

    this.save();
    return {
      profile,
      isNewRecord,
      rankings: this.getTopRankings(5),
    };
  }

  public getTopRankings(limit = 5): PlayerProfile[] {
    const list = Object.values(this.data.players);
    list.sort((a, b) => {
      if (b.bestScore !== a.bestScore) {
        return b.bestScore - a.bestScore;
      }
      return a.lastPlayedAt.localeCompare(b.lastPlayedAt);
    });
    return list.slice(0, limit);
  }
}
