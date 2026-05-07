import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GlassCard } from './ui/GlassCard';
import { SectionHeader } from './ui/SectionHeader';
import { Skeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import { Briefcase, RefreshCw, TrendingUp, Copy, Check, ExternalLink } from 'lucide-react';
import { fetchJobTitles, regenerateJobTitles } from '../lib/api';
import { toast } from './ui/Toast';
import type { JobTitleResult } from '../../shared/types';

interface Props {
    masterResumeVersion: number;
}

export const JobTitleRecommendations = ({ masterResumeVersion }: Props) => {
    const [data, setData] = useState<JobTitleResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedTitle, setCopiedTitle] = useState<string | null>(null);

    const loadTitles = useCallback(async () => {
        try {
            const result = await fetchJobTitles();
            if (result.titles.length > 0) {
                setData(result);
            }
        } catch (err: any) {
            console.error('Failed to load job titles:', err);
        }
    }, []);

    const regenerate = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await regenerateJobTitles();
            setData(result);
            toast.success('Job titles refreshed');
        } catch (err: any) {
            const msg = err.message || 'Failed to generate';
            setError(msg);
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTitles();
    }, [loadTitles]);

    useEffect(() => {
        if (masterResumeVersion > 0) {
            regenerate();
        }
    }, [masterResumeVersion, regenerate]);

    const handleCopy = async (title: string) => {
        try {
            await navigator.clipboard.writeText(title);
            setCopiedTitle(title);
            toast.success('Copied');
            setTimeout(() => setCopiedTitle(null), 1600);
        } catch {
            toast.error('Could not access clipboard');
        }
    };

    return (
        <GlassCard radius="lg" padding="md" className="space-y-4">
            <SectionHeader
                icon={<Briefcase size={18} />}
                title="Recommended job titles"
                subtitle="Search keywords based on your resume"
                accent="amber"
                as="h3"
                action={
                    <button
                        onClick={regenerate}
                        disabled={isLoading}
                        className="p-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00]"
                        title="Refresh recommendations"
                        aria-label="Refresh recommendations"
                    >
                        <RefreshCw
                            size={14}
                            className={`text-gray-400 ${isLoading ? 'animate-spin' : ''}`}
                        />
                    </button>
                }
            />

            {error && (
                <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                    ⚠ {error}
                </div>
            )}

            {isLoading && (
                <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-10" />
                    ))}
                </div>
            )}

            {!isLoading && !data?.titles?.length && !error && (
                <EmptyState
                    icon={<TrendingUp size={22} />}
                    title="No recommendations yet"
                    description="Generate suggestions from your master resume."
                    size="sm"
                    action={
                        <button
                            onClick={regenerate}
                            className="text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors"
                        >
                            Generate from your master resume →
                        </button>
                    }
                />
            )}

            {!isLoading && data && data.titles.length > 0 && (
                <div className="space-y-3">
                    {/* Title list with chips */}
                    <ul className="space-y-1.5">
                        <AnimatePresence>
                            {data.titles.map((item, i) => {
                                const linkedinUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(item.title)}`;
                                return (
                                    <motion.li
                                        key={item.title}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.04 }}
                                        className="flex items-start gap-3 p-2.5 bg-white/[0.03] border border-white/5 rounded-xl hover:bg-white/[0.05] transition-colors group"
                                    >
                                        <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center text-[11px] font-bold text-amber-400 shrink-0 mt-0.5">
                                            {i + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <span className="text-sm font-semibold text-white block">
                                                {item.title}
                                            </span>
                                            <span className="text-xs text-gray-400">{item.reasoning}</span>
                                        </div>
                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(item.title)}
                                                className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00]"
                                                title="Copy title"
                                                aria-label={`Copy ${item.title}`}
                                            >
                                                {copiedTitle === item.title ? (
                                                    <Check size={12} className="text-green-400" />
                                                ) : (
                                                    <Copy size={12} />
                                                )}
                                            </button>
                                            <a
                                                href={linkedinUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00]"
                                                title="Search on LinkedIn"
                                                aria-label={`Search ${item.title} on LinkedIn`}
                                            >
                                                <ExternalLink size={12} />
                                            </a>
                                        </div>
                                    </motion.li>
                                );
                            })}
                        </AnimatePresence>
                    </ul>

                    {data.generatedAt && (
                        <p className="text-[10px] text-gray-600 text-right">
                            Generated {new Date(data.generatedAt).toLocaleDateString()}
                        </p>
                    )}
                </div>
            )}
        </GlassCard>
    );
};
