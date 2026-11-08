import React from 'react';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { LoginAndPermissionGate } from '../src/controller/components/LoginAndPermissionGate';

const player = { deviceId: 'dev1', nickname: '두둥', bestScore: 0, totalGames: 1, lastPlayedAt: '2026-11-08T00:00:00.000Z' };

describe('phone nickname edit', () => {
  it('shows the edit button on the welcome card of a registered player', () => {
    const html = renderToStaticMarkup(
      <LoginAndPermissionGate isNewUser={false} player={player} onRegisterNickname={() => {}} onPermissionGranted={() => {}} />
    );
    expect(html).toContain('반갑습니다, 두둥님!');
    expect(html).toContain('data-testid="phone-nickname-edit"');
  });

  it('shows the plain registration form for a new user, without edit or cancel', () => {
    const html = renderToStaticMarkup(
      <LoginAndPermissionGate isNewUser={true} onRegisterNickname={() => {}} onPermissionGranted={() => {}} />
    );
    expect(html).toContain('첫 접속입니다!');
    expect(html).not.toContain('phone-nickname-edit');
    expect(html).not.toContain('취소');
  });

  // The repo has no DOM test environment, so the click flow is guarded at the source level.
  it('wires edit mode, auto-close and the same-nickname shortcut', () => {
    const source = fs.readFileSync('src/controller/components/LoginAndPermissionGate.tsx', 'utf8');
    expect(source).toContain('isNewUser || isEditingNickname');
    expect(source).toMatch(/useEffect\(\(\) => \{\s*setIsEditingNickname\(false\);\s*\}, \[player\?\.nickname\]\)/);
    expect(source).toContain('result.trimmed === player?.nickname');
  });
});
