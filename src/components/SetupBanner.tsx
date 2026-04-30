import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { AppConfig } from '../../shared/types';

interface SetupBannerProps {
    config: AppConfig | null;
    hasApiKey: boolean;
    onNavigate: (view: 'dashboard' | 'studio' | 'settings') => void;
}

interface SetupItem {
    message: string;
}

/**
 * Compact setup indicator. Renders a small badge in the top-right corner
 * when onboarding is incomplete. Clicking opens a popover that lists what's
 * missing and offers a single CTA.
 *
 * Priority for the CTA: Settings (API key, profile) first, then Dashboard
 * (master resume) — so the user takes one action at a time.
 */
export const SetupBanner = ({ config, hasApiKey, onNavigate }: SetupBannerProps) => {
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

    if (!config) return null;

    const items: SetupItem[] = [];
    if (!hasApiKey) items.push({ message: 'Choose an LLM provider and add your API key.' });
    if (!config.profileConfigured) items.push({ message: 'Add your name, email, and links.' });
    if (!config.masterResumePresent) items.push({ message: 'Upload your master resume.' });

    if (items.length === 0) return null;

    // Single CTA — Settings handles key + profile; Dashboard handles master resume.
    const settingsRemaining = !hasApiKey || !config.profileConfigured;
    const cta = settingsRemaining
        ? { label: 'Open Settings', target: 'settings' as const }
        : { label: 'Go to Dashboard', target: 'dashboard' as const };

    return (
        <div ref={popoverRef} className="absolute top-4 right-4 md:top-6 md:right-6 z-40">
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/15 border border-yellow-500/30 rounded-xl transition-colors"
                aria-label={`Setup needed: ${items.length} item${items.length === 1 ? '' : 's'}`}
                aria-expanded={open}
            >
                <AlertTriangle className="text-yellow-400" size={14} />
                <span className="text-xs font-semibold text-yellow-300 hidden sm:inline">
                    Setup ({items.length})
                </span>
                <span className="text-xs font-semibold text-yellow-300 sm:hidden">
                    {items.length}
                </span>
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-72 p-4 bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl">
                    <p className="text-sm font-semibold text-white mb-3">
                        {items.length} step{items.length === 1 ? '' : 's'} to finish setup
                    </p>
                    <ul className="space-y-2 mb-4">
                        {items.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                                <span className="w-1 h-1 rounded-full bg-yellow-400 shrink-0 mt-1.5" />
                                <span>{item.message}</span>
                            </li>
                        ))}
                    </ul>
                    <button
                        onClick={() => {
                            onNavigate(cta.target);
                            setOpen(false);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#FF4F00] hover:bg-[#FF6B1F] text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                        {cta.label} <ArrowRight size={12} />
                    </button>
                </div>
            )}
        </div>
    );
};
