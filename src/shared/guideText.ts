import type { WeaponKind } from './types';

/** 가이드 카드와 튜토리얼 안내가 같은 문장을 쓴다(2026-11-09 D11, D19). 이 파일은 다른 파일에 의존하지 않는다. */
export const WEAPON_ONE_LINER: Record<WeaponKind, string> = {
  shotgun: '한 발이 강하고 주변까지 퍼져 맞는 근접 산탄',
  revolver: '한 발 한 발이 정확하고 뒤의 몬스터까지 꿰뚫는 관통탄',
  gatling: '한 발은 약해도 탄이 쏟아지는 초고속 연사',
};

export const WEAPON_SKILL_ONE_LINER: Record<WeaponKind, string> = {
  shotgun: '뚫어뻥이 몬스터에 박혀 기절시킨 뒤 터집니다',
  revolver: '부채꼴 칼날이 앞쪽 몬스터를 베고 지나갑니다',
  gatling: '거품 파도가 전장을 쓸며 몬스터를 뒤로 밀어냅니다',
};

export const WEAPON_BADGE_TEXT: Record<WeaponKind, string> = {
  shotgun: '근접 산탄',
  revolver: '일직선 관통',
  gatling: '초고속 연사',
};
