import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { GlassCard } from './ui/GlassCard';
import { SectionHeader } from './ui/SectionHeader';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { ScoreRing } from './ui/ScoreRing';
import { Sparkles, Eye, Download, RefreshCw, FileText, Clock, CheckCircle2 } from 'lucide-react';
import { fetchSummaryResume, generateSummaryResume } from '../lib/api';
import { downloadResume, formatRelativeDate } from '../lib/utils';
import { toast } from './ui/Toast';
import type { HistoryEntry } from '../../shared/types';

interface Props {
    masterResumePresent: boolean;
    hasApiKey: boolean;
    contactName: string;
    onPreview: (entry: HistoryEntry) => void;
    /**
     * Bumped when the master resume is updated externally so the card knows
     * its current entry may now be stale (we don't auto-regenerate, just hint).
     */
    masterResumeVersion: number;
    /**
     * Notifies the parent when a new generation lands so the vault can refresh.
     */
    onGenerated?: () => void;
}

export const SummaryResumeCard = ({
    masterResumePresent,
    hasApiKey,
    contactName,
    onPreview,
    masterResumeVersion,
    onGenerated,
}: Props) => {
    const [entry, setEntry] = useState<HistoryEntry | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [staleHint, setStaleHint] = useState(false);

    const blockReason = !masterResumePresent
        ? 'Upload your master resume above first.'
        : !hasApiKey
        ? 'Add an LLM API key in Settings to generate.'
        : null;

    const canGenerate = !blockReason && !isGenerating;

    const loadExisting = useCallback(async () => {
        try {
            const result = await fetchSummaryResume();
            setEntry(result);
        } catch {
            // non-fatal
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadExisting();
    }, [loadExisting]);

    // Master resume changed after a summary was generated — surface a small hint
    // suggesting the user regenerate, but don't trigger anything automatically.
    useEffect(() => {
        if (masterResumeVersion > 0 && entry) setStaleHint(true);
    }, [masterResumeVersion, entry]);

    const handleGenerate = useCallback(async () => {
        if (!canGenerate) return;
        setIsGenerating(true);
        setError(null);
        setStatusMessage('Inferring your role cluster…');

        try {
            await generateSummaryResume({
                onProgress: (message) => setStatusMessage(message),
                onComplete: async (_result) => {
                    setStatusMessage('');
                    // Re-fetch the pointer so we get the full HistoryEntry shape
                    // (the SSE result type is a subset).
                    const fresh = await fetchSummaryResume();
                    setEntry(fresh);
                    setStaleHint(false);
                    toast.success('Summary resume ready');
                    onGenerated?.();
                },
                onError: (message) => {
                    setError(message);
                    setStatusMessage('');
                    toast.error(message);
                },
            });
        } catch (err: any) {
            const msg = err?.message || 'Generation failed';
            setError(msg);
            setStatusMessage('');
            toast.error(msg);
        } finally {
            setIsGenerating(false);
        }
    }, [canGenerate, onGenerated]);

    return (
        <GlassCard radius="lg" padding="md" className="space-y-4">
            <SectionHeader
                icon={<Sparkles size={18} />}
                title="Summary resume"
                subtitle="A broad one-pager — works well as a LinkedIn default"
                accent="tailr"
                as="h3"
                action={
                    entry && !isGenerating ? (
                        <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={!canGenerate}
                            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00]"
                            title="Regenerate from your master resume"
                            aria-label="Regenerate summary resume"
                        >
                            <RefreshCw size={14} className="text-gray-400" />
                        </button>
                    ) : null
                }
            />

            {error && (
                <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                    ⚠ {error}
                </div>
            )}

            {!error && blockReason && !isLoading && !entry && (
                <div className="px-3 py-2 bg-yellow-500/5 border border-yellow-500/15 rounded-xl text-xs text-yellow-300">
                    {blockReason}
                </div>
            )}

            {/* Initial load skeleton */}
            {isLoading && (
                <div className="space-y-2">
                    <div className="h-16 bg-white/[0.03] border border-white/5 rounded-lg animate-pulse" />
                    <div className="h-9 bg-white/[0.03] border border-white/5 rounded-lg animate-pulse" />
                </div>
            )}

            {/* Generating */}
            {isGenerating && (
                <div className="flex items-center gap-3 px-3 py-3 bg-white/[0.03] border border-white/5 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-[#FF4F00]/10 border border-[#FF4F00]/30 flex items-center justify-center shrink-0">
                        <RefreshCw size={14} className="text-[#FF4F00] animate-spin" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">
                            {entry ? 'Regenerating…' : 'Generating…'}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">
                            {statusMessage || 'This usually takes 8–20 seconds.'}
                        </p>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!isLoading && !isGenerating && !entry && !error && (
                <EmptyState
                    icon={<FileText size={22} />}
                    title="No summary resume yet"
                    description="Generate a broad one-pager from your master resume."
                    size="sm"
                    action={
                        <Button
                            variant="primary"
                            size="sm"
                            icon={<Sparkles size={14} />}
                            onClick={handleGenerate}
                            disabled={!canGenerate}
                            isLoading={isGenerating}
                        >
                            Generate summary
                        </Button>
                    }
                />
            )}

            {/* Generated state */}
            {!isLoading && entry && !isGenerating && (
                <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                >
                    <div className="flex items-center gap-3 px-3 py-3 bg-white/[0.03] border border-white/5 rounded-xl">
                        <ScoreRing score={entry.score} size={44} strokeWidth={3.5} animate={false} />
                        <div className="min-w-0 flex-1">
                            <p
                                className="text-sm font-semibold text-white truncate"
                                title={entry.role}
                            >
                                {entry.role}
                            </p>
                            <p className="text-[11px] text-gray-500 flex items-center gap-1">
                                <Clock size={11} className="shrink-0" />
                                <span className="truncate">{formatRelativeDate(entry.created_at)}</span>
                            </p>
                        </div>
                        {!staleHint && (
                            <span
                                className="hidden sm:inline-flex items-center gap-1 text-[10px] text-green-300"
                                title="Saved to your vault"
                            >
                                <CheckCircle2 size={11} />
                                Saved
                            </span>
                        )}
                    </div>

                    {staleHint && (
                        <div className="px-3 py-2 bg-yellow-500/5 border border-yellow-500/15 rounded-xl text-[11px] text-yellow-300">
                            Master resume was updated — regenerate to refresh this summary.
                        </div>
                    )}

                    <div className="flex items-center gap-1.5 flex-wrap">
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={<Eye size={14} />}
                            onClick={() => onPreview(entry)}
                        >
                            Preview
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={<Download size={14} />}
                            onClick={() =>
                                downloadResume(entry.pdf_filename, entry.company, 'pdf', contactName)
                            }
                        >
                            PDF
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={<Download size={14} />}
                            onClick={() =>
                                downloadResume(entry.pdf_filename, entry.company, 'docx', contactName)
                            }
                        >
                            DOCX
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={<RefreshCw size={14} />}
                            onClick={handleGenerate}
                            disabled={!canGenerate}
                            className="ml-auto"
                            title="Regenerate from your master resume"
                        >
                            Regenerate
                        </Button>
                    </div>
                </motion.div>
            )}
        </GlassCard>
    );
};
