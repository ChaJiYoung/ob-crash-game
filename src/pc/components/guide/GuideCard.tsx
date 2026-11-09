import React from 'react';

export interface GuideCardProps {
  /** 큰 아이콘(이모지 또는 <img>). */
  icon: React.ReactNode;
  title: string;
  /** 오른쪽 위 작은 라벨. */
  badge?: string;
  /** 한 줄 요약(항상 보인다). */
  oneLiner: string;
  /** 테두리·강조색(예: '#ef4444'). */
  accentColor: string;
  /** 수치 칩. */
  chips?: { label: string; value: string }[];
  /** 막대(ratio 0..1). */
  bars?: { label: string; valueText: string; ratio: number }[];
  /** 접힌 상세의 제목. 기본 '자세히 보기'. */
  detailTitle?: string;
  /** 한 줄 요약 아래, 접히지 않고 항상 보이는 보조 줄. */
  extraLine?: React.ReactNode;
  /** 접히는 상세. 없으면 접기 영역을 그리지 않는다. */
  children?: React.ReactNode;
  testId?: string;
}

/** ratio가 NaN·음수·1 초과여도 막대가 레이아웃을 깨지 않도록 0..1로 맞춘다. */
export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(1, Math.max(0, ratio));
}

export const StatChip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <span
    style={{
      display: 'inline-flex',
      gap: '6px',
      alignItems: 'center',
      padding: '3px 10px',
      borderRadius: '999px',
      background: 'rgba(255, 255, 255, 0.07)',
      border: '1px solid rgba(255, 255, 255, 0.14)',
      fontSize: '12px',
      color: '#e2e8f0',
      whiteSpace: 'nowrap',
    }}
  >
    <span style={{ color: '#94a3b8', fontWeight: 700 }}>{label}</span>
    <span style={{ fontWeight: 800 }}>{value}</span>
  </span>
);

export const StatBar: React.FC<{ label: string; valueText: string; ratio: number; color: string }> = ({
  label,
  valueText,
  ratio,
  color,
}) => {
  const pct = Math.round(clampRatio(ratio) * 100);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 80px', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
      <span style={{ color: '#94a3b8', fontWeight: 700 }}>{label}</span>
      <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div
          data-testid="stat-bar-fill"
          data-pct={pct}
          style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '999px' }}
        />
      </div>
      <span style={{ color: '#e2e8f0', fontWeight: 800, textAlign: 'right' }}>{valueText}</span>
    </div>
  );
};

export const GuideCard: React.FC<GuideCardProps> = ({
  icon,
  title,
  badge,
  oneLiner,
  accentColor,
  chips,
  bars,
  detailTitle = '자세히 보기',
  extraLine,
  children,
  testId,
}) => (
  <div
    data-testid={testId}
    style={{
      background: 'rgba(255, 255, 255, 0.04)',
      border: `1.5px solid ${accentColor}`,
      borderRadius: '16px',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '32px', lineHeight: 1, display: 'inline-flex' }}>{icon}</span>
        <span style={{ fontSize: '18px', fontWeight: 900, color: accentColor }}>{title}</span>
      </div>
      {badge && (
        <span
          style={{
            background: accentColor,
            color: '#111827',
            fontWeight: 800,
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          {badge}
        </span>
      )}
    </div>

    <div data-testid={testId ? `${testId}-oneliner` : undefined} style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc' }}>
      {oneLiner}
    </div>
    {extraLine && <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>{extraLine}</div>}

    {chips && chips.length > 0 && (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {chips.map((c) => (
          <StatChip key={c.label} label={c.label} value={c.value} />
        ))}
      </div>
    )}

    {bars && bars.length > 0 && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {bars.map((b) => (
          <StatBar key={b.label} label={b.label} valueText={b.valueText} ratio={b.ratio} color={accentColor} />
        ))}
      </div>
    )}

    {children && (
      <details data-testid={testId ? `${testId}-details` : undefined} style={{ fontSize: '13px', color: '#cbd5e1' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 800, color: accentColor }}>{detailTitle}</summary>
        <div style={{ marginTop: '10px', lineHeight: 1.6 }}>{children}</div>
      </details>
    )}
  </div>
);

/** 이미지가 있으면 보여 주고, 로드에 실패하면 숨겨서 뒤의 이모지가 보이게 한다. */
export const GuideThumb: React.FC<{ src?: string; alt: string; fallback: string; size?: number }> = ({
  src,
  alt,
  fallback,
  size = 56,
}) => (
  <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <span style={{ fontSize: `${Math.round(size * 0.6)}px`, lineHeight: 1 }}>{fallback}</span>
    {src && (
      <img
        src={src}
        alt={alt}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
      />
    )}
  </span>
);
