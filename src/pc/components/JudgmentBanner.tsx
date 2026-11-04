import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
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
        subtitle: '2.0x 데미지 (+150 PTS)',
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
        subtitle: '0.5x 데미지 (+50 PTS)',
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

const BANNER_VISIBLE_MS = 600;

/**
 * 판정 배너. 연타 중에도 React 커밋이 생기지 않도록 DOM을 직접 갱신한다.
 */
export const JudgmentBanner = forwardRef<JudgmentBannerHandle>((_props, ref) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      show(grade: JudgmentGrade) {
        const root = rootRef.current;
        const title = titleRef.current;
        const subtitle = subtitleRef.current;
        if (!root || !title || !subtitle) return;

        const spec = getJudgmentBannerSpec(grade);
        title.textContent = spec.title;
        title.style.color = spec.colorHex;
        subtitle.textContent = spec.subtitle;
        subtitle.style.border = `1px solid ${spec.colorHex}`;
        root.style.transform = `translate(-50%, -50%) scale(${spec.scale})`;
        root.style.display = 'flex';

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          if (rootRef.current) rootRef.current.style.display = 'none';
        }, BANNER_VISIBLE_MS);
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

  return (
    <div
      ref={rootRef}
      style={{
        position: 'absolute',
        top: '38%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        display: 'none',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 50,
      }}
    >
      <div
        ref={titleRef}
        style={{
          fontSize: '36px',
          fontWeight: 900,
          textShadow: '0 2px 2px #000',
          letterSpacing: '2px',
        }}
      />
      <div
        ref={subtitleRef}
        style={{
          fontSize: '15px',
          fontWeight: 700,
          color: '#ffffff',
          background: 'rgba(0, 0, 0, 0.65)',
          padding: '4px 12px',
          borderRadius: '20px',
          marginTop: '4px',
        }}
      />
    </div>
  );
});
