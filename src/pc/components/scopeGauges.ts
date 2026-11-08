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
  /** 한 번의 장전 전체 시간(ms). PlayerHudSnapshot.reloadDurationMs. */
  reloadDurationMs: number;
  /** 장전이 끝나는 시각(performance.now 기준 ms). 장전 중에만 의미가 있다. PlayerHudSnapshot.reloadEndTimeMs. */
  reloadEndTimeMs: number;
}

export interface ArcSpec {
  startDeg: number;
  endDeg: number;
  /** 0..1 */
  fill: number;
  flash: boolean;
  warn: boolean;
  /** true면 채움을 CSS 애니메이션(장전)이 그린다. fill은 0이다. */
  reloading?: boolean;
  /** true면 피버 진행 중 색(남은 시간만큼 줄어드는 호)으로 그린다. */
  active?: boolean;
}

export interface ScopeGaugeSpec {
  /** 장전 중에도 그려진다(reloading: true): 호가 0%에서 100%까지 다른 색으로 차오른다. */
  ammo: ArcSpec;
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
  /** 장전 중 탄창 호가 차오르는 색. */
  reload: '#4cc9f0',
  /** 피버 진행 중 줄어드는 호의 색(하단 패널의 피버 진행색과 같다). 충전 때 주황과 구분한다. */
  feverActive: '#ef4444',
} as const;

/**
 * 호 굵기(px). base = 평소, ready = 가득 참 펄스의 최대 굵기, halo = 가득 참일 때 뒤에 까는 반투명 빛번짐 호
 * (2026-11-08-scope-gauge-visibility D01·D02. 조준경에는 CSS filter를 쓰지 않는다: hud-render-cost 테스트).
 */
export const SCOPE_GAUGE_STROKE = { base: 6, ready: 9, halo: 16 } as const;

/** 스킬 스택 점: 반지름과 호 바깥으로 띄우는 거리. */
export const SCOPE_SKILL_DOT = { radius: 4.5, orbitOffset: 11 } as const;

/** 탄이 이 비율 미만이면 경고색. */
export const LOW_AMMO_RATIO = 0.2;

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export function computeScopeGauges(i: ScopeGaugeInput): ScopeGaugeSpec {
  // 장전 중에도 호를 그린다: 채움은 CSS 애니메이션이 맡고(reloading), 피버 중에도 장전은 계속 진행된다.
  const ammo: ArcSpec = i.isReloading
    ? { ...SCOPE_GAUGE_ARCS.ammo, fill: 0, flash: false, warn: false, reloading: true }
    : (() => {
        // 피버 중에도 실제 탄창을 보여 준다(피버는 탄을 줄이지 않을 뿐 채우지 않는다). 탄이 줄지 않으니 경고는 끈다.
        const ratio = clamp01(i.ammo / Math.max(1, i.maxAmmo));
        return { ...SCOPE_GAUGE_ARCS.ammo, fill: ratio, flash: false, warn: !i.isFeverActive && ratio < LOW_AMMO_RATIO };
      })();

  const skillFull = i.skillStock >= i.maxSkillStock;
  const skillFill = skillFull ? 1 : clamp01(1 - i.skillCooldownRemainingMs / Math.max(1, i.skillCooldownTotalMs));
  const skill: ArcSpec = { ...SCOPE_GAUGE_ARCS.skill, fill: skillFill, flash: skillFull, warn: false };

  // 피버 중 feverGauge는 남은 시간 비율(ScoreAndFeverManager.updateFeverTimer)이라 그대로 줄어드는 호가 된다.
  const fever: ArcSpec = i.isFeverActive
    ? { ...SCOPE_GAUGE_ARCS.fever, fill: clamp01(i.feverGauge / 100), flash: false, warn: false, active: true }
    : {
        ...SCOPE_GAUGE_ARCS.fever,
        fill: i.isFeverReady ? 1 : clamp01(i.feverGauge / 100),
        flash: i.isFeverReady,
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
