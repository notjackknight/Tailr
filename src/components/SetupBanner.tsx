import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { AppConfig } from '../../shared/types';

export type SetupView = 'dashboard' | 'studio' | 'settings';

interface SetupBannerProps {
    config: AppConfig | null;
    hasApiKey: boolean;
    onNavigate: (view: SetupView) => void;
    onLaunchWizard?: () => void;
    /** Render the chip inline (mobile top bar) instead of floating top-right. */
    inline?: boolean;
}

interface SetupItem {
    id: 'apiKey' | 'profile' | 'master';
    message: string;
    done: boolean;
    target: SetupView;
}

/**
 * Compact setup indicator. Shows progress (done/total) and lists remaining
 * steps. Single CTA opens the first-run wizard if available, else routes to
 * the next missing surface.
 */
export const SetupBanner = ({
    config,
    hasApiKey,
    onNavigate,
    onLaunchWizard,
    inline = false,
}: SetupBannerProps) => {
    const [open, setOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const items: SetupItem[] = useMemo(() => {
        if (!config) return [];
        return [
            {
                id: 'apiKey',
                message: 'Choose an LLM provider and add your API key.',
                done: hasApiKey,
                target: 'settings',
            },
            {
                id: 'profile',
                message: 'Add your name, email, and links.',
                done: !!config.profileConfigured,
                target: 'settings',
            },
            {
                id: 'master',
                message: 'Upload your master resume.',
                done: !!config.masterResumePresent,
                target: 'dashboard',
            },
        ];
    }, [config, hasApiKey]);

    if (!config) return null;
    const remaining = items.filter((i) => !i.done);
    const total = items.length;
    const done = total - remaining.length;
    if (remaining.length === 0) return null;

    const next = remaining[0];

    const handleCta = () => {
        setOpen(false);
        if (onLaunchWizard) onLaunchWizard();
        else onNavigate(next.target);
    };

    const wrapperClass = inline
        ? 'relative'
        : 'absolute top-4 right-4 md:top-6 md:right-6 z-40';

    return (
        <div ref={popoverRef} className={wrapperClass}>
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/15 border border-yellow-500/30 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
                aria-label={`Setup needed: ${remaining.length} of ${total} steps remaining`}
                aria-expanded={open}
            >
                <AlertTriangle className="text-yellow-400" size={13} />
                <span className="text-xs font-semibold text-yellow-300">
                    Setup
                    <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-4 rounded bg-yellow-500/20 px-1 text-[10px] font-bold tabular-nums">
                        {done}/{total}
                    </span>
                </span>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-72 p-4 bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl"
                    >
                        <div className="mb-3">
                            <p className="text-sm font-semibold text-white">
                                Finish setting up Tailr
                            </p>
                            <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-tailr transition-all"
                                    style={{ width: `${(done / total) * 100}%` }}
                                />
                            </div>
                            <p className="text-[11px] text-gray-500 mt-1.5">
                                {done} of {total} done
                            </p>
                        </div>

                        <ul className="space-y-2 mb-4">
                            {items.map((item) => (
                                <li
                                    key={item.id}
                                    className={`flex items-start gap-2 text-xs ${item.done ? 'text-gray-500' : 'text-gray-200'}`}
                                >
                                    {item.done ? (
                                        <CheckCircle2
                                            className="text-green-400 shrink-0 mt-0.5"
                                            size={14}
                                        />
                                    ) : (
                                        <Circle className="text-gray-600 shrink-0 mt-0.5" size={14} />
                                    )}
                                    <span className={item.done ? 'line-through opacity-60' : ''}>
                                        {item.message}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <button
                            onClick={handleCta}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-tailr hover:opacity-95 text-white text-sm font-semibold rounded-xl transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
                        >
                            {onLaunchWizard ? 'Open setup wizard' : 'Continue setup'}{' '}
                            <ArrowRight size={12} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
