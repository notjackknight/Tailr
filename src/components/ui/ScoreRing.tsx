/**
 * ScoreRing — Circular SVG score indicator.
 * Shared between Studio and Vault views.
 *
 * Animates from 0 to score on mount unless `animate={false}`.
 * Honors prefers-reduced-motion via the global CSS reset.
 */

import React, { useEffect, useState } from 'react';
import { scoreColor, scoreTextClass, cn } from '../../lib/utils';

interface ScoreRingProps {
  score: number;
  /** Outer size in pixels */
  size?: number;
  /** Stroke width */
  strokeWidth?: number;
  className?: string;
  animate?: boolean;
  /** Override label font size — useful at very small ring sizes. */
  labelClass?: string;
}

export const ScoreRing = ({
  score,
  size = 40,
  strokeWidth = 3,
  className,
  animate = true,
  labelClass,
}: ScoreRingProps) => {
  const halfSize = size / 2;
  const radius = halfSize - strokeWidth;
  const circumference = 2 * Math.PI * radius;

  const [displayScore, setDisplayScore] = useState(animate ? 0 : score);

  useEffect(() => {
    if (!animate) {
      setDisplayScore(score);
      return;
    }
    // Tween from 0 to score over ~900ms with eased steps.
    const start = performance.now();
    const duration = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(score * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score, animate]);

  const offset = circumference - (circumference * displayScore) / 10;
  const rounded = Math.round(displayScore);

  // Auto-scale label by ring size — at <40px don't show the digit (would overlap stroke).
  const showLabel = size >= 32;
  const fontSize =
    labelClass ??
    (size >= 80 ? 'text-2xl' : size >= 56 ? 'text-base' : size >= 40 ? 'text-sm' : 'text-[10px]');

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg className="w-full h-full transform -rotate-90" aria-hidden="true">
        <circle
          cx={halfSize}
          cy={halfSize}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-white/10"
        />
        <circle
          cx={halfSize}
          cy={halfSize}
          r={radius}
          stroke={scoreColor(score)}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      {showLabel && (
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center font-bold',
            fontSize,
            scoreTextClass(score),
          )}
          aria-label={`Fit score ${score} out of 10`}
        >
          {rounded}
        </span>
      )}
    </div>
  );
};
