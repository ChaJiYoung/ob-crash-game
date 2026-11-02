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
    // LAN IP substitution for mobile QR scanning
    expect(buildControllerPairingUrl('https://localhost:5173', 'ROOM1', '172.30.1.31')).toBe(
      'https://172.30.1.31:5173/controller?room=ROOM1'
    );
    expect(buildControllerPairingUrl('https://127.0.0.1:5173/', 'ROOM2', '192.168.1.10')).toBe(
      'https://192.168.1.10:5173/controller?room=ROOM2'
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

  it('should detect shoot-to-start hit when crosshair is aimed near monitor center', () => {
    const isShootToStartHit = (aimX: number, aimY: number) => {
      return Math.abs(aimX) < 0.65 && Math.abs(aimY) < 0.65;
    };

    // Center aim hits the start target
    expect(isShootToStartHit(0, 0)).toBe(true);
    expect(isShootToStartHit(0.2, -0.3)).toBe(true);
    expect(isShootToStartHit(-0.4, 0.4)).toBe(true);

    // Aiming way outside does not trigger start
    expect(isShootToStartHit(0.85, 0)).toBe(false);
    expect(isShootToStartHit(0, -0.9)).toBe(false);
  });
});
