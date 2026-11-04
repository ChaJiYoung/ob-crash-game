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

  /** 같은 폴더의 임시 파일에 쓴 뒤 이름을 바꿔 저장한다. 중간에 실패해도 기존 파일은 온전하다. */
  private writeFileAtomic(target: string, content: string): void {
    const tmp = `${target}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, content, 'utf-8');
    fs.renameSync(tmp, target);
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
    if (!fileMissing) this.backupUnreadableFile();
    this.data = { rulesetVersion: RANKING_RULESET_VERSION, players: {} };
    if (fileMissing) this.save();
  }

  /** 읽을 수 없는 기존 파일은 빈 저장소로 덮어쓰기 전에 따로 보관한다(닉네임·기기 연결 보호). */
  private backupUnreadableFile(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const backup = `${this.filePath}.unreadable-${Date.now()}.bak`;
      fs.copyFileSync(this.filePath, backup);
      console.error('Player store is unreadable; saved a copy before starting empty:', backup);
    } catch (err) {
      console.error('Could not back up the unreadable player store:', err);
    }
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
    if (oldVersion > RANKING_RULESET_VERSION) {
      // A newer server wrote this file; never reset it from an older build
      console.error(`Player store ruleset ${oldVersion} is newer than ${RANKING_RULESET_VERSION}; leaving it untouched.`);
      return parsed;
    }

    try {
      // Reset only profile objects we understand; anything else is left as-is rather than crashing the load
      const profiles = Object.values(parsed.players).filter(
        (p): p is PlayerProfile => !!p && typeof p === 'object'
      );

      let backupPath = `${this.filePath}.ruleset-${oldVersion}.bak`;
      if (fs.existsSync(backupPath) && fs.readFileSync(backupPath, 'utf-8') !== raw) {
        // A different backup already uses this name (older run, partial file...): never reuse or overwrite it
        backupPath = `${this.filePath}.ruleset-${oldVersion}.${Date.now()}.bak`;
      }
      if (!fs.existsSync(backupPath)) {
        this.writeFileAtomic(backupPath, raw);
      }

      for (const profile of profiles) {
        profile.bestScore = 0;
        profile.totalGames = 0;
      }
      parsed.rulesetVersion = RANKING_RULESET_VERSION;
      this.data = parsed;
      this.save();
      return parsed;
    } catch (err) {
      console.error('Ranking backup/reset failed; keeping existing scores untouched:', err);
      return parsed;
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.writeFileAtomic(this.filePath, JSON.stringify(this.data, null, 2));
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
    // After a ruleset reset everyone is at 0: show an empty board instead of five zero-point rows
    const list = Object.values(this.data.players).filter((p) => p.bestScore > 0);
    list.sort((a, b) => {
      if (b.bestScore !== a.bestScore) {
        return b.bestScore - a.bestScore;
      }
      return a.lastPlayedAt.localeCompare(b.lastPlayedAt);
    });
    return list.slice(0, limit);
  }
}
