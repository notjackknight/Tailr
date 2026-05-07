import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

type Variant = 'default' | 'subtle' | 'featured' | 'plain';
type Padding = 'none' | 'sm' | 'md' | 'lg';
type Radius = 'md' | 'lg' | 'xl';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  /** Visual weight: subtle = inline rows, default = content cards, featured = hero. */
  variant?: Variant;
  padding?: Padding;
  /** Card radius — md = rounded-xl, lg = rounded-2xl (content), xl = rounded-3xl (hero). */
  radius?: Radius;
  hoverEffect?: boolean;
  key?: React.Key;
}

const paddingMap: Record<Padding, string> = {
  none: '',
  sm: 'p-3 md:p-4',
  md: 'p-4 md:p-5',
  lg: 'p-5 md:p-6',
};

const radiusMap: Record<Radius, string> = {
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  xl: 'rounded-3xl',
};

export const GlassCard = ({
  children,
  className,
  variant = 'default',
  padding = 'lg',
  radius = 'lg',
  hoverEffect = false,
  ...props
}: GlassCardProps) => {
  const variantClass =
    variant === 'plain'
      ? 'bg-white/[0.02] border border-white/5'
      : variant === 'subtle'
      ? 'bg-white/[0.025] border border-white/[0.06]'
      : variant === 'featured'
      ? 'glass-panel ring-1 ring-white/5'
      : 'glass-panel';

  return (
    <motion.div
      className={cn(
        variantClass,
        radiusMap[radius],
        paddingMap[padding],
        'transition-all duration-300',
        hoverEffect && 'hover:bg-white/[0.05] hover:border-white/10 cursor-pointer',
        className,
      )}
      {...(props as any)}
    >
      {children}
    </motion.div>
  );
};
