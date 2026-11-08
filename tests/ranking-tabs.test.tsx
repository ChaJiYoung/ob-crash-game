import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RankingTabs, getDefaultRankTab, buildTeamKey } from '../src/pc/components/RankingTabs';
import { RunRankingEntry, TeamRankingEntry } from '../src/shared/types';

describe('RankingTabs Component and Pure Helpers (P05-T07)', () => {
  it('getDefaultRankTab returns team when 2 joined, solo otherwise', () => {
    expect(getDefaultRankTab(2)).toBe('team');
    expect(getDefaultRankTab(1)).toBe('solo');
    expect(getDefaultRankTab(0)).toBe('solo');
  });

  it('buildTeamKey sorts device IDs and joins with pipe', () => {
    expect(buildTeamKey('dev-b', 'dev-a')).toBe('dev-a|dev-b');
    expect(buildTeamKey('dev-a', 'dev-b')).toBe('dev-a|dev-b');
    expect(buildTeamKey(undefined, 'dev-b')).toBeNull();
  });

  it('renders team rankings when activeTab is team', () => {
    const teams: TeamRankingEntry[] = [
      {
        teamKey: 'dev-1|dev-2',
        members: [
          { deviceId: 'dev-1', nickname: '카스왕' },
          { deviceId: 'dev-2', nickname: '오비맨' },
        ],
        teamScore: 50000,
        waveReached: 8,
        playedAt: '2026-11-07T12:00:00Z',
      },
      {
        teamKey: 'dev-3|dev-4',
        members: [
          { deviceId: 'dev-3', nickname: '하이트러' },
          { deviceId: 'dev-4', nickname: '클라우드' },
        ],
        teamScore: 35000,
        waveReached: 6,
        playedAt: '2026-11-07T12:05:00Z',
      },
    ];

    const solo: RunRankingEntry[] = [
      {
        deviceId: 'dev-solo',
        nickname: '솔로킹',
        score: 99999,
        waveReached: 12,
        weaponKind: 'shotgun',
        playedAt: '2026-11-07T10:00:00Z',
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(RankingTabs, {
        soloRankings: solo,
        teamRankings: teams,
        activeTab: 'team',
        onChangeTab: () => {},
      })
    );

    for (const name of ['카스왕', '오비맨', '하이트러', '클라우드']) expect(html).toContain(name);
    // 옛 기록(입력 방식 없음)은 아이콘 없이 그린다.
    expect(html).not.toContain('rank-input-icon');
    expect(html).toContain('50,000');
    expect(html).toContain('35,000');
    expect(html).not.toContain('솔로킹');
  });

  it('renders empty message when teamRankings is empty', () => {
    const html = renderToStaticMarkup(
      React.createElement(RankingTabs, {
        soloRankings: [],
        teamRankings: [],
        activeTab: 'team',
        onChangeTab: () => {},
      })
    );

    expect(html).toContain('아직 팀 기록이 없습니다.');
  });

  it('highlights the current team when highlightTeamKey matches', () => {
    const teams: TeamRankingEntry[] = [
      {
        teamKey: 'dev-1|dev-2',
        members: [
          { deviceId: 'dev-1', nickname: '카스왕' },
          { deviceId: 'dev-2', nickname: '오비맨' },
        ],
        teamScore: 50000,
        waveReached: 8,
        playedAt: '2026-11-07T12:00:00Z',
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(RankingTabs, {
        soloRankings: [],
        teamRankings: teams,
        activeTab: 'team',
        highlightTeamKey: 'dev-1|dev-2',
        onChangeTab: () => {},
      })
    );

    expect(html).toContain('rgba(245, 158, 11, 0.15)');
  });

  it('renders solo rankings when activeTab is solo', () => {
    const solo: RunRankingEntry[] = [
      {
        deviceId: 'dev-solo',
        nickname: '솔로킹',
        score: 99999,
        waveReached: 12,
        weaponKind: 'shotgun',
        playedAt: '2026-11-07T10:00:00Z',
      },
    ];

    const htmlCompact = renderToStaticMarkup(
      React.createElement(RankingTabs, {
        soloRankings: solo,
        teamRankings: [],
        activeTab: 'solo',
        compact: true,
        onChangeTab: () => {},
      })
    );

    expect(htmlCompact).toContain('솔로킹');
    expect(htmlCompact).toContain('99,999');

    const htmlModal = renderToStaticMarkup(
      React.createElement(RankingTabs, {
        soloRankings: solo,
        teamRankings: [],
        activeTab: 'solo',
        compact: false,
        onChangeTab: () => {},
      })
    );
    expect(htmlModal).toContain('99999점');
  });

  it('shows input icons on solo rows and per-member detail on team rows', () => {
    const solo: RunRankingEntry[] = [
      { deviceId: 'a', nickname: '마우스왕', score: 100, waveReached: 3, weaponKind: 'gatling', playedAt: 't1', inputKind: 'mouse' },
      { deviceId: 'b', nickname: '옛기록', score: 50, waveReached: 2, weaponKind: 'revolver', playedAt: 't0' },
    ];
    const soloHtml = renderToStaticMarkup(
      React.createElement(RankingTabs, { soloRankings: solo, teamRankings: [], activeTab: 'solo', onChangeTab: () => {} })
    );
    expect(soloHtml.match(/rank-input-icon/g)?.length).toBe(1);
    expect(soloHtml).toContain('🖱');

    const teams: TeamRankingEntry[] = [
      {
        teamKey: 'a|b',
        members: [
          { deviceId: 'a', nickname: '일피', score: 12000, weaponKind: 'shotgun', inputKind: 'mobile' },
          { deviceId: 'b', nickname: '이피', score: 8000, weaponKind: 'revolver', inputKind: 'mouse' },
        ],
        teamScore: 20000,
        waveReached: 7,
        playedAt: 't2',
      },
    ];
    const teamHtml = renderToStaticMarkup(
      React.createElement(RankingTabs, { soloRankings: [], teamRankings: teams, activeTab: 'team', onChangeTab: () => {} })
    );
    expect(teamHtml).toContain('📱');
    expect(teamHtml).toContain('🖱');
    expect(teamHtml).toContain('12,000');
    expect(teamHtml).toContain('8,000');
    expect(teamHtml).toContain('샷건');
    expect(teamHtml).toContain('리볼버');
  });
});
