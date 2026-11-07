import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { JudgmentGrade } from '../../shared/types';
import { JUDGMENT_SPECS } from '../../shared/constants';
import { GAME_TUNING } from '../../shared/gameTuning';

const pts = (grade: 'PERFECT' | 'GREAT' | 'GOOD') => Math.round(JUDGMENT_SPECS[grade].baseScore * GAME_TUNING.score.scale);

export function getJudgmentBannerSpec(grade: JudgmentGrade, isFever = false): {
  title: string;
  subtitle: string;
  colorHex: string;
  scale: number;
} {
  // 피버 중 명중은 판정이 GREAT로 고정되지만 대미지는 feverDamage를 쓴다. 실제 배율을 보여 준다.
  if (isFever && grade !== 'MISS') {
    return {
      title: 'FEVER!',
      subtitle: `${GAME_TUNING.judgment.feverDamage.toFixed(1)}x 데미지 (피버)`,
      colorHex: '#f97316',
      scale: 1.3,
    };
  }
  switch (grade) {
    case 'PERFECT':
      return {
        title: 'PERFECT!',
        subtitle: `${JUDGMENT_SPECS.PERFECT.damageMultiplier.toFixed(1)}x 데미지 (+${pts('PERFECT')} PTS)`,
        colorHex: '#fbbf24',
        scale: 1.3,
      };
    case 'GREAT':
      return {
        title: 'GREAT!',
        subtitle: `${JUDGMENT_SPECS.GREAT.damageMultiplier.toFixed(1)}x 데미지 (+${pts('GREAT')} PTS)`,
        colorHex: '#38bdf8',
        scale: 1.15,
      };
    case 'GOOD':
      return {
        title: 'GOOD!',
        subtitle: `${JUDGMENT_SPECS.GOOD.damageMultiplier.toFixed(1)}x 데미지 (+${pts('GOOD')} PTS)`,
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
  show(grade: JudgmentGrade, isFever?: boolean): void;
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
      show(grade: JudgmentGrade, isFever = false) {
        const root = rootRef.current;
        const title = titleRef.current;
        const subtitle = subtitleRef.current;
        if (!root || !title || !subtitle) return;

        const spec = getJudgmentBannerSpec(grade, isFever);
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
