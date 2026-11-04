import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
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

export interface JudgmentBannerHandle {
  show(grade: JudgmentGrade): void;
}

/** 판정 배너. 부모를 다시 그리지 않고 `show()`로 직접 띄운다. */
export const JudgmentBanner = forwardRef<JudgmentBannerHandle>((_props, ref) => {
  const [shown, setShown] = useState<{ grade: JudgmentGrade; key: number } | null>(null);
  const keyRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      show(grade: JudgmentGrade) {
        keyRef.current += 1;
        setShown({ grade, key: keyRef.current });
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setShown(null);
        }, 600);
      },
    }),
    []
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  if (!shown) return null;
  const spec = getJudgmentBannerSpec(shown.grade);

  return (
    <div
      key={shown.key}
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
});
