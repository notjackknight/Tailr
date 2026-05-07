import React from 'react';
import { cn } from '../../lib/utils';

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Used to set the heading element. Defaults to h2. */
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
  /** Tone of the icon tile background — accents the section. */
  accent?: 'default' | 'tailr' | 'amber' | 'purple' | 'green';
}

const accentMap = {
  default: 'bg-white/5 border-white/10 text-white/80',
  tailr: 'bg-gradient-tailr-soft border-[#FF4F00]/20 text-[#FF8A3D]',
  amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  green: 'bg-green-500/10 border-green-500/20 text-green-400',
};

export const SectionHeader = ({
  icon,
  title,
  subtitle,
  action,
  as: Tag = 'h2',
  className,
  accent = 'default',
}: SectionHeaderProps) => (
  <div className={cn('flex items-start justify-between gap-3', className)}>
    <div className="flex items-center gap-3 min-w-0">
      {icon && (
        <div
          className={cn(
            'w-10 h-10 rounded-xl border flex items-center justify-center shrink-0',
            accentMap[accent],
          )}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <Tag className="text-base md:text-lg font-bold text-white leading-tight truncate">{title}</Tag>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
