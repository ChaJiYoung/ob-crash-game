import React, { useEffect, useState } from 'react';
import { JudgmentGrade } from '../../shared/types';

export function getJudgmentBannerSpec(grade: JudgmentGrade): {
  title: string;
  subtitle: string;
  colorHex: string;
  scale: number;
} {
  switch (grade) {
    case 'PERFECT':
      return {
        title: 'PERFECT!',
        subtitle: '1.5x 데미지 (+150 PTS)',
        colorHex: '#fbbf24',
        scale: 1.3,
      };
    case 'GREAT':
      return {
        title: 'GREAT!',
        subtitle: '1.0x 데미지 (+100 PTS)',
        colorHex: '#38bdf8',
        scale: 1.15,
      };
    case 'GOOD':
      return {
        title: 'GOOD!',
        subtitle: '0.8x 데미지 (+50 PTS)',
        colorHex: '#4ade80',
        scale: 1.0,
      };
    case 'MISS':
      return {
        title: 'MISS...',
        subtitle: '빗나감',
        colorHex: '#f87171',
        scale: 0.9,
      };
  }
}

export interface JudgmentBannerProps {
  grade: JudgmentGrade;
  triggerKey: number;
}

export const JudgmentBanner: React.FC<JudgmentBannerProps> = ({ grade, triggerKey }) => {
  const [visible, setVisible] = useState(false);
  const spec = getJudgmentBannerSpec(grade);

  useEffect(() => {
    if (triggerKey === 0) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [triggerKey]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '38%',
        left: '50%',
        transform: `translate(-50%, -50%) scale(${spec.scale})`,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        animation: 'popBanner 0.5s ease-out forwards',
        zIndex: 50,
      }}
    >
      <div
        style={{
          fontSize: '36px',
          fontWeight: 900,
          color: spec.colorHex,
          textShadow: '0 2px 2px #000',
          letterSpacing: '2px',
        }}
      >
        {spec.title}
      </div>
      <div
        style={{
          fontSize: '15px',
          fontWeight: 700,
          color: '#ffffff',
          background: 'rgba(0, 0, 0, 0.65)',
          padding: '4px 12px',
          borderRadius: '20px',
          marginTop: '4px',
          border: `1px solid ${spec.colorHex}`,
        }}
      >
        {spec.subtitle}
      </div>
    </div>
  );
};
