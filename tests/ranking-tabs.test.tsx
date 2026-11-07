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

    expect(html).toContain('카스왕 &amp; 오비맨');
    expect(html).toContain('하이트러 &amp; 클라우드');
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
});
