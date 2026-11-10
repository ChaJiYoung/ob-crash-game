import React from 'react';
import { WEAPON_ARCHETYPE_SPECS } from '../../../shared/constants';
import { RADAR_AXES, WeaponKindKey, weaponRadarValues } from './weaponGuideData';

const KINDS: WeaponKindKey[] = ['shotgun', 'revolver', 'gatling'];
const COLORS: Record<WeaponKindKey, string> = { shotgun: '#f0b94d', revolver: '#5bc0de', gatling: '#e5485d' };
const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 100;

function point(axis: number, ratio: number): [number, number] {
  const angle = -Math.PI / 2 + (axis * 2 * Math.PI) / RADAR_AXES.length;
  return [CENTER + Math.cos(angle) * RADIUS * ratio, CENTER + Math.sin(angle) * RADIUS * ratio];
}

/** 세 무기를 겹쳐 그리는 레이더 차트. Lv.1 / Lv.4 MAX 토글이 있다. */
export const WeaponRadar: React.FC = () => {
  const [level, setLevel] = React.useState<1 | 4>(4);
  return (
    <div data-testid="weapon-radar">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        {([1, 4] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLevel(l)}
            style={{
              padding: '6px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: level === l ? '#f0b94d' : 'rgba(255,255,255,0.05)',
              color: level === l ? '#111' : '#e2e8f0',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {l === 4 ? 'Lv.4 MAX' : 'Lv.1'}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: '100%', maxWidth: '360px', display: 'block', margin: '0 auto' }}>
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <polygon
            key={r}
            points={RADAR_AXES.map((_, i) => point(i, r).join(',')).join(' ')}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
          />
        ))}
        {RADAR_AXES.map((label, i) => {
          const [x, y] = point(i, 1);
          const [lx, ly] = point(i, 1.2);
          return (
            <g key={label}>
              <line x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="rgba(255,255,255,0.12)" />
              <text x={lx} y={ly} fill="#e2e8f0" fontSize="11" fontWeight={800} textAnchor="middle" dominantBaseline="middle">
                {label}
              </text>
            </g>
          );
        })}
        {KINDS.map((k) => {
          const pts = weaponRadarValues(k, level).map((v, i) => point(i, v / 100));
          return (
            <g key={k}>
              <polygon points={pts.map((p) => p.join(',')).join(' ')} fill={COLORS[k]} fillOpacity={0.14} stroke={COLORS[k]} strokeWidth={2} />
              {pts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={3.5} fill={COLORS[k]} />
              ))}
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', fontSize: '12px', color: '#e2e8f0' }}>
        {KINDS.map((k) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: 14, height: 10, border: `2px solid ${COLORS[k]}`, borderRadius: 2 }} />
            {WEAPON_ARCHETYPE_SPECS[k].nameKo.split(' ').pop()}
          </span>
        ))}
      </div>
      <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '6px' }}>
        축별 Lv.4 최댓값=100 · 샷건·리볼버는 옆·뒤 몬스터까지 맞은 최선의 경우 · 초당 화력은 누르고 쏘기 기준
      </div>
    </div>
  );
};
