import fs from 'node:fs';
import path from 'node:path';
import { PlayerProfile } from '../src/shared/types';

export interface PlayerStoreData {
  players: Record<string, PlayerProfile>;
}

export class PlayerStore {
  private filePath: string;
  private data: PlayerStoreData = { players: {} };

  constructor(filePath?: string) {
    this.filePath = filePath || path.resolve(process.cwd(), 'data', 'players.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.players === 'object') {
          this.data = parsed;
          return;
        }
      }
    } catch {
      // If reading fails or file is malformed, start with empty store
    }
    this.data = { players: {} };
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
    return this.data.players[deviceId];
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
