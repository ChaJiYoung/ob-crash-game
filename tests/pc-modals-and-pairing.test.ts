import { describe, it, expect } from 'vitest';
import { buildControllerPairingUrl } from '../src/pc/components/QRPairingModal';
import { PlayerProfile } from '../src/shared/types';

describe('PC QR Pairing URL & Leaderboard Modal Helpers', () => {
  it('should format pairing URL correctly with or without trailing slash', () => {
    expect(buildControllerPairingUrl('https://192.168.0.15:5173/', 'AB12')).toBe(
      'https://192.168.0.15:5173/controller?room=AB12'
    );
    expect(buildControllerPairingUrl('http://localhost:5173', 'CR77')).toBe(
      'http://localhost:5173/controller?room=CR77'
    );
    expect(buildControllerPairingUrl('https://beer.example.com///', 'Z999')).toBe(
      'https://beer.example.com/controller?room=Z999'
    );
  });

  it('should identify player record status in rankings', () => {
    const dummyRankings: PlayerProfile[] = [
      {
        deviceId: 'dev-1',
        nickname: '맥주왕',
        bestScore: 8900,
        totalGames: 4,
        lastPlayedAt: '2026-11-01',
      },
      {
        deviceId: 'dev-2',
        nickname: '치맥러버',
        bestScore: 6400,
        totalGames: 2,
        lastPlayedAt: '2026-11-01',
      },
      {
        deviceId: 'dev-3',
        nickname: '카스마스터',
        bestScore: 4200,
        totalGames: 1,
        lastPlayedAt: '2026-11-01',
      },
    ];

    const currentDevice = 'dev-2';
    const isPlayerInRankings = dummyRankings.some((r) => r.deviceId === currentDevice);
    expect(isPlayerInRankings).toBe(true);

    const playerRecord = dummyRankings.find((r) => r.deviceId === currentDevice)!;
    expect(playerRecord.nickname).toBe('치맥러버');

    // Record check
    const newScore = 7500;
    const isNewRecord = newScore > playerRecord.bestScore;
    expect(isNewRecord).toBe(true);
  });
});
