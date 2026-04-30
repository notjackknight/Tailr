import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  key?: React.Key;
}

export const GlassCard = ({ children, className, hoverEffect = false, ...props }: GlassCardProps) => {
  return (
    <motion.div
      className={cn(
        "glass-panel rounded-3xl p-6 transition-all duration-300",
        hoverEffect && "hover:bg-white/[0.05] hover:border-white/10 cursor-pointer",
        className
      )}
      {...props as any}
    >
      {children}
    </motion.div>
  );
};
