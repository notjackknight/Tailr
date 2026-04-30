import React, { ButtonHTMLAttributes } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export const Button = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading,
  icon,
  disabled,
  ...props
}: ButtonProps) => {

  const baseStyles = "relative inline-flex items-center justify-center font-semibold tracking-wide transition-all duration-300 rounded-2xl overflow-hidden group cursor-pointer";

  const variants = {
    primary: "text-white shadow-lg shadow-[#FF4F00]/20 hover:shadow-[#FF4F00]/40",
    secondary: "bg-white/10 hover:bg-white/15 text-white border border-white/10",
    ghost: "bg-transparent hover:bg-white/5 text-gray-400 hover:text-white"
  };

  const sizes = {
    sm: "px-4 py-2 text-xs",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base",
    xl: "px-10 py-5 text-lg w-full"
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={isLoading || disabled}
      {...props}
    >
      {variant === 'primary' && (
        <div className="absolute inset-0 bg-gradient-tailr opacity-100 group-hover:opacity-90 transition-opacity" />
      )}

      <span className="relative z-10 flex items-center gap-2">
        {isLoading ? (
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : icon}
        {children}
      </span>
    </motion.button>
  );
};
