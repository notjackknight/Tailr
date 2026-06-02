import React from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
type Size = 'sm' | 'md' | 'lg' | 'xl';

type NativeButtonProps = React.ComponentPropsWithoutRef<'button'>;

export interface ButtonProps extends Omit<NativeButtonProps, 'size'> {
  variant?: Variant;
  size?: Size;
  /** Stretch the button to fill its container's width. */
  fullWidth?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
  /** Render the icon after the label. */
  iconPosition?: 'left' | 'right';
}

export const Button = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading,
  icon,
  iconPosition = 'left',
  disabled,
  ...props
}: ButtonProps) => {
  const baseStyles =
    'relative inline-flex items-center justify-center font-semibold tracking-wide transition-all duration-300 overflow-hidden group ' +
    'cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#FF4F00] focus-visible:ring-offset-[#050505]';

  const variants: Record<Variant, string> = {
    primary: 'btn-primary text-white',
    secondary: 'bg-white/10 hover:bg-white/15 text-white border border-white/10',
    ghost: 'bg-transparent hover:bg-white/5 text-gray-400 hover:text-white',
    danger:
      'bg-red-500/10 hover:bg-red-500/15 text-red-400 hover:text-red-300 border border-red-500/20',
    link: 'bg-transparent text-[#FF4F00] hover:text-[#FF6B1F] underline-offset-2 hover:underline px-0 py-0',
  };

  // Smaller buttons get smaller radii — radius scale: sm 8px, md 12px, lg/xl 16px.
  const sizes: Record<Size, string> = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-5 py-2.5 text-sm rounded-xl',
    lg: 'px-6 py-3 text-base rounded-xl',
    xl: 'px-8 py-4 text-lg rounded-2xl',
  };

  // The link variant ignores padding/radius from sizes.
  const isLink = variant === 'link';
  // Solid CTAs get the neon-scan hover; ghost/link keep their subtle states.
  const scan = variant === 'primary' || variant === 'secondary' || variant === 'danger';

  // Per-variant neon beam + inverted-text colors (consumed by .btn-scan in CSS).
  const scanVars: React.CSSProperties | undefined = scan
    ? variant === 'danger'
      ? ({ ['--scan-neon' as any]: '#FF5C5C', ['--scan-ink' as any]: '#1A0606' })
      : ({ ['--scan-neon' as any]: '#34D8B4', ['--scan-ink' as any]: '#04130D' })
    : undefined;

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        !isLink && sizes[size],
        scan && 'btn-scan',
        fullWidth && 'w-full',
        className,
      )}
      style={scanVars}
      disabled={isLoading || disabled}
      {...(props as any)}
    >
      {variant === 'primary' && (
        <div className="absolute inset-0 bg-gradient-tailr transition-opacity duration-300" />
      )}

      <span className="relative z-10 flex items-center gap-2">
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        ) : iconPosition === 'left' ? (
          icon
        ) : null}
        {children}
        {!isLoading && iconPosition === 'right' ? icon : null}
      </span>
    </button>
  );
};
