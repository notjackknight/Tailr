import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  open?: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Top-right action area beside the close button. */
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Tailwind max-w utility — defaults to max-w-2xl. */
  maxWidth?: string;
  /** Use full-height layout (e.g. for embedded iframes). */
  fullHeight?: boolean;
  /** Hide the default close X. */
  hideClose?: boolean;
  /** Set false to prevent backdrop click from closing. */
  closeOnBackdrop?: boolean;
  className?: string;
  contentClassName?: string;
}

export const Modal = ({
  onClose,
  title,
  subtitle,
  headerAction,
  footer,
  children,
  maxWidth = 'max-w-2xl',
  fullHeight,
  hideClose,
  closeOnBackdrop = true,
  className,
  contentClassName,
}: ModalProps) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Escape closes; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Move focus into the modal on mount (basic focus trap entry).
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const focusable = el.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6"
      onClick={() => closeOnBackdrop && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        ref={cardRef}
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 12 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'w-full bg-[#0A0A0A] rounded-2xl md:rounded-3xl overflow-hidden border border-white/10 flex flex-col shadow-2xl relative',
          maxWidth,
          fullHeight ? 'h-[90vh]' : 'max-h-[90vh]',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || headerAction || !hideClose) && (
          <div className="p-4 md:p-5 flex justify-between items-start gap-3 border-b border-white/10 bg-white/[0.02] shrink-0">
            <div className="min-w-0 flex-1">
              {title && (
                <h3 className="text-base md:text-lg font-bold text-white leading-tight">{title}</h3>
              )}
              {subtitle && (
                <p className="text-xs md:text-sm text-gray-400 mt-1 leading-snug">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {headerAction}
              {!hideClose && (
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00]"
                  aria-label="Close dialog"
                >
                  <X size={18} className="text-white" />
                </button>
              )}
            </div>
          </div>
        )}
        <div className={cn('flex-1 overflow-y-auto', contentClassName)}>{children}</div>
        {footer && (
          <div className="p-4 md:p-5 border-t border-white/10 bg-white/[0.02] shrink-0">
            {footer}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
