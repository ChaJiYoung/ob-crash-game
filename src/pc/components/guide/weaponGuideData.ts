import { WEAPON_ARCHETYPE_SPECS } from '../../../shared/constants';
import { GAME_TUNING } from '../../../shared/gameTuning';

export type WeaponKindKey = 'shotgun' | 'revolver' | 'gatling';

/** 무기 도감의 "성능" 줄을 무기 표(`WEAPON_ARCHETYPE_SPECS`, GAME_TUNING 반영)에서 만든다. 수치를 조정해도 안내가 어긋나지 않는다. */
export function levelSeries(byLevel: Record<1 | 2 | 3 | 4, number>): string {
  return ([1, 2, 3, 4] as const).map((l) => byLevel[l]).join(' / ');
}

export function weaponPerformanceText(kind: WeaponKindKey): string {
  const lv = WEAPON_ARCHETYPE_SPECS[kind].levels;
  const levels = [1, 2, 3, 4] as const;
  return levels
    .map((l) => {
      const spec = lv[l];
      const label = l === 4 ? 'MAX' : `Lv.${l}`;
      const parts: string[] = [];
      if (kind === 'shotgun') {
        const main = spec.damagePerHit;
        const spreadExtra = main * GAME_TUNING.shotgunSpread.damageRatioByLevel[l] * GAME_TUNING.shotgunSpread.extraTargetsByLevel[l];
        parts.push(`${main.toFixed(2)} DMG(+산탄 최대 ${spreadExtra.toFixed(2)})`);
        if (spec.knockbackM > 0) parts.push(`${spec.knockbackM}m 넉백`);
        if (spec.slowDurationMs > 0) parts.push('둔화');
      } else if (kind === 'revolver') {
        parts.push(`${spec.damagePerHit.toFixed(2)} DMG`);
        if (spec.pierceCount > 0) {
          parts.push(`${spec.pierceCount}체 관통(관통 피해 ${Math.round(spec.pierceDamageRatio * 100)}%)`);
        }
      } else {
        parts.push(`${spec.damagePerHit.toFixed(2)} DMG`, `${spec.maxAmmo}발`, `${spec.fireIntervalMs}ms`);
      }
      return `${label}(${parts.join(', ')})`;
    })
    .join(' ➔ ');
}

/** 관통·산탄 포함 최선의 경우 한 발 총 피해(GREAT 기준). 샷건 = 주 대상 합계 x (1 + 추가 명중 수 x 비율), 리볼버 = 한 발 x (1 + 관통 수 x 관통 비율), 개틀링 = 한 발. */
export function weaponBestCasePerShot(kind: WeaponKindKey, level: 1 | 2 | 3 | 4): number {
  const spec = WEAPON_ARCHETYPE_SPECS[kind].levels[level];
  if (kind === 'shotgun') {
    const spread = GAME_TUNING.shotgunSpread;
    return spec.damagePerHit * (1 + spread.extraTargetsByLevel[level] * spread.damageRatioByLevel[level]);
  }
  if (kind === 'revolver') return spec.damagePerHit * (1 + spec.pierceCount * spec.pierceDamageRatio);
  return spec.damagePerHit;
}

/** MAX(Lv.4) 기준 세 무기 비교 막대: 한 발 피해(관통·산탄 포함 최선의 경우), 탄창, 초당 발사 수. ratio = 값 / 세 무기 중 최댓값. */
export function weaponStatBars(kind: WeaponKindKey): { label: string; valueText: string; ratio: number }[] {
  const kinds: WeaponKindKey[] = ['shotgun', 'revolver', 'gatling'];
  const stats = (k: WeaponKindKey) => {
    const spec = WEAPON_ARCHETYPE_SPECS[k].levels[4];
    return {
      damage: weaponBestCasePerShot(k, 4),
      ammo: spec.maxAmmo,
      rate: 1000 / spec.fireIntervalMs,
    };
  };
  const all = kinds.map(stats);
  const max = {
    damage: Math.max(...all.map((s) => s.damage)),
    ammo: Math.max(...all.map((s) => s.ammo)),
    rate: Math.max(...all.map((s) => s.rate)),
  };
  const mine = stats(kind);
  return [
    { label: '한 발 피해', valueText: mine.damage.toFixed(2), ratio: mine.damage / max.damage },
    { label: '탄창', valueText: `${mine.ammo}발`, ratio: mine.ammo / max.ammo },
    { label: '연사', valueText: `${mine.rate.toFixed(1)}발/초`, ratio: mine.rate / max.rate },
  ];
}

const seconds = (ms: Record<1 | 2 | 3 | 4, number>): Record<1 | 2 | 3 | 4, number> => ({
  1: ms[1] / 1000,
  2: ms[2] / 1000,
  3: ms[3] / 1000,
  4: ms[4] / 1000,
});

/** 샷건 퍼짐 한 줄: 마릿수와 비율은 GAME_TUNING.shotgunSpread에서 계산한다. */
export function shotgunSpreadText(): string {
  const spread = GAME_TUNING.shotgunSpread;
  const ratios = ([1, 2, 3, 4] as const).map((l) => Math.round(spread.damageRatioByLevel[l] * 100)).join(' / ');
  return `십자선 주변 몬스터 ${levelSeries(spread.extraTargetsByLevel)}마리(Lv.1 / 2 / 3 / MAX)에게도 주 대상 피해의 ${ratios}%가 함께 들어갑니다(보스는 제외).`;
}

/** 스킬 상세 문장들. 샷건은 skills.plunger, 리볼버는 skills.blade, 게틀링은 skills.foam에서 계산한다. */
export function weaponSkillDetailText(kind: WeaponKindKey): string[] {
  if (kind === 'shotgun') {
    const p = GAME_TUNING.skills.plunger;
    return [
      `방어선에 가까운 몬스터부터 최대 ${levelSeries(p.stickMaxByLevel)}마리(Lv.1 / 2 / 3 / MAX)에 뚫어뻥이 박힙니다.`,
      `박힌 몬스터는 ${levelSeries(seconds(p.stunMsByLevel))}초 기절하고, 기절이 끝나는 순간 터져 ${levelSeries(p.blastDamageByLevel)} 피해를 줍니다(박힌 몬스터에게만).`,
      '기절해 있는 동안 평타로 마무리하면 폭발 피해는 없고 폭발 연출만 나옵니다.',
      `보스는 박히지 않고 피해(${levelSeries(p.bossDamageByLevel)})만 즉시 받습니다.`,
    ];
  }
  if (kind === 'revolver') {
    const b = GAME_TUNING.skills.blade;
    return [
      `황금 칼날이 부채꼴로 곧게 날아가 닿은 몬스터를 베고 날아오는 포탄도 벱니다. 칼날 ${levelSeries(b.countByLevel)}개, 관통 ${levelSeries(b.pierceByLevel)}마리.`,
      '칼날 하나의 피해는 평타 한 발과 같습니다.',
    ];
  }
  const f = GAME_TUNING.skills.foam;
  return [
    `작은 거품이 필드 전체로 쓸고 나가며 닿은 몬스터를 ${levelSeries(f.knockbackMByLevel)}m 뒤로 밀어내고 둔화시킵니다.`,
    '밀어내기 전용이라 피해는 낮고, 레벨이 오를수록 거품이 많아집니다.',
  ];
}

/** 외형 진화 문구(기존 가이드 문구 그대로). */
export const WEAPON_EVOLUTION_TEXT: Record<WeaponKindKey, string> = {
  shotgun: '리얼 고무 벨 뚫어뻥 장착 ➔ Lv.2 듀얼 고압관 ➔ Lv.3 호박색 맥주관 순환 ➔ Lv.4 쿼드 배럴 + 둔화 파동',
  revolver: '병따개 해머 & 실린더 ➔ Lv.2 롱배럴 ➔ Lv.3 시안 네온 레이저 스코프 ➔ Lv.4 4각 머즐 브레이크',
  gatling: '6총열 묶음 ➔ Lv.2 카스 블루 냉각 재킷 ➔ Lv.3 듀얼 탄산 드럼통 ➔ Lv.4 12총열 아크 스파크',
};

export const RADAR_AXES = ['발당 화력', '초당 화력', '탄창', '장전 속도', '다중 타격 수'] as const;

/** 레이더 원값(RADAR_AXES 순서). 발당 화력은 관통·산탄 포함 최선의 경우, 초당 화력은 그 값 x 누르고 쏘기 발수(레벨 무관 고정 간격). */
function radarRaw(kind: WeaponKindKey, level: 1 | 2 | 3 | 4): number[] {
  const spec = WEAPON_ARCHETYPE_SPECS[kind].levels[level];
  const perShot = weaponBestCasePerShot(kind, level);
  const multiHit = kind === 'shotgun' ? GAME_TUNING.shotgunSpread.extraTargetsByLevel[level] : spec.pierceCount;
  return [
    perShot,
    (perShot * 1000) / GAME_TUNING.fire.holdIntervalMsByWeapon[kind],
    spec.maxAmmo,
    1000 / spec.reloadDurationMs,
    multiHit,
  ];
}

/** 레이더 값 0..100. 축마다 Lv.4(MAX) 세 무기 중 최댓값을 100으로 둔다. */
export function weaponRadarValues(kind: WeaponKindKey, level: 1 | 2 | 3 | 4): number[] {
  const kinds: WeaponKindKey[] = ['shotgun', 'revolver', 'gatling'];
  const maxes = RADAR_AXES.map((_, i) => Math.max(...kinds.map((k) => radarRaw(k, 4)[i])));
  return radarRaw(kind, level).map((v, i) => (maxes[i] > 0 ? Math.min(100, (v / maxes[i]) * 100) : 0));
}
