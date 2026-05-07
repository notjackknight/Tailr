import React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  key?: React.Key | null;
}

/** Shared shimmering placeholder block. */
export const Skeleton = ({ className, rounded = 'md', ...rest }: SkeletonProps) => {
  const r =
    rounded === 'full'
      ? 'rounded-full'
      : rounded === 'lg'
      ? 'rounded-2xl'
      : rounded === 'md'
      ? 'rounded-xl'
      : 'rounded-md';
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse bg-white/[0.06]', r, className)}
      {...rest}
    />
  );
};
