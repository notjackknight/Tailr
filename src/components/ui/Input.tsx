import React, { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export type InputSize = 'sm' | 'md' | 'lg';

interface CommonProps {
  label?: string;
  helper?: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  inputSize?: InputSize;
  className?: string;
  containerClassName?: string;
  /** Render the field as monospace (for keys, ids, etc). */
  mono?: boolean;
}

interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'>,
    CommonProps {}

const sizeMap: Record<InputSize, string> = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-3.5 py-2.5 text-sm',
  lg: 'px-4 py-3 text-base',
};

function fieldClass(opts: { hasError?: boolean; hasPrefix?: boolean; hasSuffix?: boolean; size: InputSize; mono?: boolean }) {
  return cn(
    'w-full bg-white/5 border rounded-xl text-white placeholder:text-gray-600 transition-colors',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]',
    opts.hasError
      ? 'border-red-500/40 focus:border-red-500/60'
      : 'border-white/10 focus:border-white/20',
    sizeMap[opts.size],
    opts.hasPrefix && 'pl-9',
    opts.hasSuffix && 'pr-10',
    opts.mono && 'font-mono',
  );
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    helper,
    error,
    prefix,
    suffix,
    inputSize = 'md' as InputSize,
    className,
    containerClassName,
    mono,
    id,
    ...rest
  },
  ref,
) {
  const inputId =
    id || (label ? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : undefined);

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none flex items-center">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            fieldClass({ hasError: !!error, hasPrefix: !!prefix, hasSuffix: !!suffix, size: inputSize, mono }),
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined
          }
          {...rest}
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            {suffix}
          </span>
        )}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-red-400 mt-1.5">
          {error}
        </p>
      ) : helper ? (
        <p id={`${inputId}-helper`} className="text-xs text-gray-500 mt-1.5">
          {helper}
        </p>
      ) : null}
    </div>
  );
});

interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size' | 'prefix'>,
    CommonProps {
  rows?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    helper,
    error,
    inputSize = 'md' as InputSize,
    className,
    containerClassName,
    mono,
    id,
    rows = 4,
    ...rest
  },
  ref,
) {
  const inputId =
    id || (label ? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : undefined);

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block"
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={cn(
          fieldClass({ hasError: !!error, size: inputSize, mono }),
          'resize-y leading-relaxed',
          className,
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined
        }
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-red-400 mt-1.5">
          {error}
        </p>
      ) : helper ? (
        <p id={`${inputId}-helper`} className="text-xs text-gray-500 mt-1.5">
          {helper}
        </p>
      ) : null}
    </div>
  );
});
