import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface SegmentedItem<V extends string> {
  value: V;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<V extends string> {
  value: V;
  onChange: (value: V) => void;
  items: SegmentedItem<V>[];
  className?: string;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  ariaLabel?: string;
  layoutId?: string;
}

export function SegmentedControl<V extends string>({
  value,
  onChange,
  items,
  className,
  size = 'md',
  fullWidth = true,
  ariaLabel,
  layoutId = 'segmented-active',
}: SegmentedControlProps<V>) {
  const sizeClass =
    size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-sm';

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-1',
        fullWidth && 'w-full',
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] focus-visible:ring-offset-1 focus-visible:ring-offset-[#050505]',
              fullWidth && 'flex-1',
              sizeClass,
              isActive ? 'text-white' : 'text-gray-400 hover:text-white',
            )}
            title={item.hint}
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                className="absolute inset-0 rounded-lg bg-gradient-tailr-soft border border-[#FF4F00]/30"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {item.icon}
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
