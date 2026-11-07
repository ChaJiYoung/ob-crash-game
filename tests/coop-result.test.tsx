import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResultRankingModal, CoopResultInfo } from '../src/pc/components/ResultRankingModal';

describe('Co-op Result Screen (P05-T04)', () => {
  it('renders solo result screen when coop is omitted', () => {
    const html = renderToStaticMarkup(
      <ResultRankingModal
        gamePhase="VICTORY"
        score={120000}
        maxCombo={15}
        kills={45}
        waveReached={7}
        rankings={[]}
        onRestart={() => {}}
        onReturnToLobby={() => {}}
      />
    );

    expect(html).toContain('최종 득점');
    expect(html).toContain('120000점');
    expect(html).toContain('누적 격파 (KILL)');
    expect(html).not.toContain('coop-result-player');
    expect(html).not.toContain('2인팟 점수는 솔로 랭킹에 오르지 않습니다');
  });

  it('renders side-by-side comparison with team total and ranking notice when coop is provided', () => {
    const coop: CoopResultInfo = {
      players: [
        {
          slotLabel: '1P',
          color: '#38bdf8',
          nickname: '맥주포수1',
          score: 85000,
          maxCombo: 18,
          kills: 35,
          accuracy: 0.85,
          weaponKind: 'shotgun',
          leftEarly: false,
        },
        {
          slotLabel: '2P',
          color: '#ff6b3d',
          nickname: '맥주포수2',
          score: 92000,
          maxCombo: 22,
          kills: 40,
          accuracy: 0.91,
          weaponKind: 'revolver',
          leftEarly: false,
        },
      ],
      teamScore: 177000,
      teamBest: undefined,
      isNewTeamBest: false,
    };

    const html = renderToStaticMarkup(
      <ResultRankingModal
        gamePhase="VICTORY"
        score={85000}
        maxCombo={18}
        kills={35}
        waveReached={7}
        rankings={[]}
        coop={coop}
        onRestart={() => {}}
        onReturnToLobby={() => {}}
      />
    );

    expect(html).toContain('맥주포수1');
    expect(html).toContain('85,000 PTS');
    expect(html).toContain('맥주포수2');
    expect(html).toContain('92,000 PTS');
    expect(html).toContain('팀 합계');
    expect(html).toContain('177,000 PTS');
    expect(html).toContain('기록 확인 중…');
    expect(html).toContain('2인팟 점수는 솔로 랭킹에 오르지 않습니다');
    expect(html).not.toContain('나감');
  });

  it('shows team best score and new record badge when achieved', () => {
    const coop: CoopResultInfo = {
      players: [
        {
          slotLabel: '1P',
          color: '#38bdf8',
          nickname: 'A',
          score: 100000,
          maxCombo: 20,
          kills: 50,
          accuracy: 0.88,
          weaponKind: 'gatling',
          leftEarly: false,
        },
        {
          slotLabel: '2P',
          color: '#ff6b3d',
          nickname: 'B',
          score: 110000,
          maxCombo: 25,
          kills: 55,
          accuracy: 0.92,
          weaponKind: 'revolver',
          leftEarly: false,
        },
      ],
      teamScore: 210000,
      teamBest: {
        partnerDeviceId: 'dev-2',
        partnerNickname: 'B',
        teamScore: 210000,
        myScore: 100000,
        partnerScore: 110000,
        waveReached: 7,
        playedAt: '2026-11-07T12:00:00.000Z',
      },
      isNewTeamBest: true,
    };

    const html = renderToStaticMarkup(
      <ResultRankingModal
        gamePhase="VICTORY"
        score={100000}
        maxCombo={20}
        kills={50}
        waveReached={7}
        rankings={[]}
        coop={coop}
        onRestart={() => {}}
        onReturnToLobby={() => {}}
      />
    );

    expect(html).toContain('210,000 PTS');
    expect(html).toContain('🏆 팀 신기록!');
    expect(html).toContain('이 팀 최고:');
  });

  it('displays "나감" badge and dims panel when player left early', () => {
    const coop: CoopResultInfo = {
      players: [
        {
          slotLabel: '1P',
          color: '#38bdf8',
          nickname: '생존자',
          score: 60000,
          maxCombo: 12,
          kills: 30,
          accuracy: 0.8,
          weaponKind: 'shotgun',
          leftEarly: false,
        },
        {
          slotLabel: '2P',
          color: '#ff6b3d',
          nickname: '이탈자',
          score: 20000,
          maxCombo: 5,
          kills: 10,
          accuracy: 0.6,
          weaponKind: 'revolver',
          leftEarly: true,
        },
      ],
      teamScore: 80000,
      teamBest: null,
      isNewTeamBest: false,
    };

    const html = renderToStaticMarkup(
      <ResultRankingModal
        gamePhase="GAMEOVER"
        score={60000}
        maxCombo={12}
        kills={30}
        waveReached={4}
        rankings={[]}
        coop={coop}
        onRestart={() => {}}
        onReturnToLobby={() => {}}
      />
    );

    expect(html).toContain('나감');
    expect(html).toContain('기록 없음');
  });
});
