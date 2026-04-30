/**
 * ScoreRing — Circular SVG score indicator.
 * Shared between Studio and Vault views.
 */

import React from 'react';
import { scoreColor, scoreTextClass, cn } from '../../lib/utils';

interface ScoreRingProps {
    score: number;
    /** Outer size in pixels */
    size?: number;
    /** Stroke width */
    strokeWidth?: number;
    className?: string;
}

export const ScoreRing = ({ score, size = 40, strokeWidth = 3, className }: ScoreRingProps) => {
    const halfSize = size / 2;
    const radius = halfSize - strokeWidth;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (circumference * score) / 10;

    return (
        <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
            <svg className="w-full h-full transform -rotate-90">
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
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <span
                className={cn(
                    'absolute inset-0 flex items-center justify-center text-xs font-bold',
                    scoreTextClass(score),
                )}
            >
                {score}
            </span>
        </div>
    );
};
