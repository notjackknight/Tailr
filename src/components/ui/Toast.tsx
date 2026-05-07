/**
 * Lightweight toast queue.
 *
 * Use:
 *   import { ToastProvider, toast } from '@/components/ui/Toast';
 *   <ToastProvider /> at the App root.
 *   toast.success('Saved'), toast.error('...'), toast.info('...')
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  duration: number;
}

const listeners = new Set<(items: ToastItem[]) => void>();
let queue: ToastItem[] = [];
let nextId = 1;

function emit() {
  for (const fn of listeners) fn([...queue]);
}

function push(item: Omit<ToastItem, 'id'>): number {
  const id = nextId++;
  queue = [...queue, { ...item, id }];
  emit();
  if (item.duration > 0) {
    setTimeout(() => dismiss(id), item.duration);
  }
  return id;
}

function dismiss(id: number) {
  queue = queue.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (message: string, duration = 3500) => push({ tone: 'success', message, duration }),
  error: (message: string, duration = 5000) => push({ tone: 'error', message, duration }),
  info: (message: string, duration = 3500) => push({ tone: 'info', message, duration }),
  dismiss,
};

const toneClass: Record<ToastTone, string> = {
  success: 'border-green-500/30 bg-green-500/10 text-green-200',
  error: 'border-red-500/30 bg-red-500/10 text-red-200',
  info: 'border-white/15 bg-white/5 text-gray-100',
};

const toneIcon = (tone: ToastTone) => {
  if (tone === 'success') return <CheckCircle2 size={16} className="text-green-400" />;
  if (tone === 'error') return <XCircle size={16} className="text-red-400" />;
  return <Info size={16} className="text-gray-400" />;
};

export const ToastProvider = () => {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-24 md:bottom-6 right-3 md:right-6 z-[60] flex flex-col gap-2 pointer-events-none"
    >
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`pointer-events-auto flex items-start gap-2 max-w-sm pl-3 pr-2 py-2.5 rounded-xl border backdrop-blur-md shadow-2xl ${toneClass[t.tone]}`}
          >
            <span className="mt-0.5 shrink-0">{toneIcon(t.tone)}</span>
            <span className="flex-1 text-sm leading-snug">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="p-1 -mt-0.5 -mr-0.5 rounded hover:bg-white/10 transition-colors"
              aria-label="Dismiss"
            >
              <X size={12} className="text-gray-400" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
