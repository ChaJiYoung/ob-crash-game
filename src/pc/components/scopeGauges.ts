/**
 * 조준경 링 게이지(playtest-feedback D08): 십자선 둘레의 원호 3개.
 * 위 = 탄창, 왼쪽 아래 = 스킬 충전(+ 스택 점), 오른쪽 아래 = 피버.
 * 각도는 12시를 0도로 두고 시계 방향으로 잰다.
 */

export interface ScopeGaugeInput {
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  skillStock: number;
  maxSkillStock: number;
  skillCooldownRemainingMs: number;
  skillCooldownTotalMs: number;
  /** 0..100 (PlayerHudSnapshot.feverGauge) */
  feverGauge: number;
  isFeverReady: boolean;
  isFeverActive: boolean;
}

export interface ArcSpec {
  startDeg: number;
  endDeg: number;
  /** 0..1 */
  fill: number;
  flash: boolean;
  warn: boolean;
}

export interface ScopeGaugeSpec {
  /** 장전 중이면 null: 기존 장전 링이 진행을 보여 준다. */
  ammo: ArcSpec | null;
  skill: ArcSpec;
  skillDots: { filled: number; total: number };
  fever: ArcSpec;
}

export const SCOPE_GAUGE_ARCS = {
  ammo: { startDeg: -60, endDeg: 60 },
  skill: { startDeg: 190, endDeg: 290 },
  fever: { startDeg: 70, endDeg: 170 },
} as const;

export const SCOPE_GAUGE_COLORS = {
  track: 'rgba(255,255,255,0.14)',
  ammo: '#e6edf3',
  warn: '#ffd24d',
  skill: '#b98cff',
  fever: '#ff7a3d',
} as const;

/** 탄이 이 비율 미만이면 경고색. */
export const LOW_AMMO_RATIO = 0.2;

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export function computeScopeGauges(i: ScopeGaugeInput): ScopeGaugeSpec {
  let ammo: ArcSpec | null = null;
  if (!i.isReloading) {
    // 피버 중에는 탄이 줄지 않는다(formatAmmoStatusText와 같은 규칙).
    const ratio = i.isFeverActive ? 1 : clamp01(i.ammo / Math.max(1, i.maxAmmo));
    ammo = { ...SCOPE_GAUGE_ARCS.ammo, fill: ratio, flash: false, warn: !i.isFeverActive && ratio < LOW_AMMO_RATIO };
  }

  const skillFull = i.skillStock >= i.maxSkillStock;
  const skillFill = skillFull ? 1 : clamp01(1 - i.skillCooldownRemainingMs / Math.max(1, i.skillCooldownTotalMs));
  const skill: ArcSpec = { ...SCOPE_GAUGE_ARCS.skill, fill: skillFill, flash: skillFull, warn: false };

  const fever: ArcSpec = {
    ...SCOPE_GAUGE_ARCS.fever,
    fill: i.isFeverActive || i.isFeverReady ? 1 : clamp01(i.feverGauge / 100),
    flash: i.isFeverReady || i.isFeverActive,
    warn: false,
  };

  return {
    ammo,
    skill,
    skillDots: { filled: Math.max(0, Math.min(i.skillStock, i.maxSkillStock)), total: Math.max(0, i.maxSkillStock) },
    fever,
  };
}

/** 원 위의 점(12시 = 0도, 시계 방향). */
export function polarPoint(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** startDeg → endDeg 시계 방향 호의 SVG path. 0.5도 미만이면 빈 문자열. */
export function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const sweep = endDeg - startDeg;
  if (!(sweep >= 0.5)) return '';
  const [x0, y0] = polarPoint(cx, cy, r, startDeg);
  const [x1, y1] = polarPoint(cx, cy, r, endDeg);
  const f = (n: number) => Number(n.toFixed(2));
  return `M ${f(x0)} ${f(y0)} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
}

/** 채운 부분의 끝 각도. 스킬 호는 끝(290도)에서 거꾸로 차오른다. */
export function filledArcRange(arc: ArcSpec, fromEnd = false): [number, number] {
  const span = (arc.endDeg - arc.startDeg) * clamp01(arc.fill);
  return fromEnd ? [arc.endDeg - span, arc.endDeg] : [arc.startDeg, arc.startDeg + span];
}
