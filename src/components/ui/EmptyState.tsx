import React from 'react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { wrap: 'py-8', tile: 'w-12 h-12', text: 'text-sm', desc: 'text-xs' },
  md: { wrap: 'py-12', tile: 'w-16 h-16', text: 'text-lg', desc: 'text-sm' },
  lg: { wrap: 'py-16', tile: 'w-20 h-20', text: 'text-xl', desc: 'text-base' },
};

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
  size = 'md',
}: EmptyStateProps) => {
  const s = sizeMap[size];
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', s.wrap, className)}>
      {icon && (
        <div
          className={cn(
            'rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 mb-4',
            s.tile,
          )}
        >
          {icon}
        </div>
      )}
      <h3 className={cn('font-semibold text-white mb-1.5', s.text)}>{title}</h3>
      {description && (
        <p className={cn('text-gray-500 max-w-md mx-auto', s.desc)}>{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};
