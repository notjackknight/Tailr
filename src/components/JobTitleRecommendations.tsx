import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GlassCard } from './ui/GlassCard';
import { SectionHeader } from './ui/SectionHeader';
import { Skeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import { Briefcase, RefreshCw, TrendingUp, Copy, Check, ExternalLink, ChevronDown } from 'lucide-react';
import { fetchJobTitles, regenerateJobTitles } from '../lib/api';
import { toast } from './ui/Toast';
import type { JobTitleResult, JobTitleRecommendation, JobTitleTier } from '../../shared/types';

const TIER_META: Record<JobTitleTier, { label: string; description: string; badgeClass: string; dotClass: string }> = {
    realistic: {
        label: 'Realistic',
        description: 'Attainable now based on your background',
        badgeClass: 'bg-green-500/10 text-green-300 border-green-500/20',
        dotClass: 'bg-green-400',
    },
    low_hanging_fruit: {
        label: 'Low-hanging fruit',
        description: 'Broad, high-volume search terms',
        badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
        dotClass: 'bg-amber-400',
    },
    reach: {
        label: 'Reach',
        description: 'Stretch — meets most but not all of the bar',
        badgeClass: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
        dotClass: 'bg-orange-400',
    },
    long_term_fit: {
        label: 'Long-term fit',
        description: 'A clear next step in 1–3 years',
        badgeClass: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
        dotClass: 'bg-violet-400',
    },
};

const TIER_ORDER: JobTitleTier[] = ['realistic', 'low_hanging_fruit', 'reach', 'long_term_fit'];

function groupByTier(titles: JobTitleRecommendation[]): Array<[JobTitleTier, JobTitleRecommendation[]]> {
    const groups: Record<JobTitleTier, JobTitleRecommendation[]> = {
        realistic: [],
        low_hanging_fruit: [],
        reach: [],
        long_term_fit: [],
    };
    for (const t of titles) {
        // Defensive: a payload from before tiered recs (or with an unrecognized
        // tier string) gets bucketed into 'realistic' rather than crashing the view.
        const bucket = t.tier in groups ? t.tier : 'realistic';
        groups[bucket].push(t);
    }
    return TIER_ORDER
        .map((tier) => [tier, groups[tier]] as [JobTitleTier, JobTitleRecommendation[]])
        .filter(([, list]) => list.length > 0);
}

interface Props {
    masterResumeVersion: number;
}

export const JobTitleRecommendations = ({ masterResumeVersion }: Props) => {
    const [data, setData] = useState<JobTitleResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedTitle, setCopiedTitle] = useState<string | null>(null);
    const [expandedTitle, setExpandedTitle] = useState<string | null>(null);

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
                <div className="space-y-4">
                    {groupByTier(data.titles).map(([tier, items]) => {
                        const meta = TIER_META[tier];
                        return (
                            <div key={tier} className="space-y-1.5">
                                <div className="flex items-center gap-2 px-0.5">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${meta.badgeClass}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                                        {meta.label}
                                    </span>
                                    <span className="text-[11px] text-gray-500">{meta.description}</span>
                                </div>
                                <ul className="space-y-1">
                                    <AnimatePresence>
                                        {items.map((item, i) => {
                                            const linkedinUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(item.title)}`;
                                            const isExpanded = expandedTitle === item.title;
                                            return (
                                                <motion.li
                                                    key={item.title}
                                                    initial={{ opacity: 0, x: -8 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.03 }}
                                                    className="bg-white/[0.03] border border-white/5 rounded-lg hover:bg-white/[0.05] transition-colors group"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedTitle(isExpanded ? null : item.title)}
                                                        aria-expanded={isExpanded}
                                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] rounded-lg"
                                                    >
                                                        <span
                                                            className={`w-2 h-2 rounded-full shrink-0 ${meta.dotClass}`}
                                                            aria-hidden="true"
                                                        />
                                                        <span className="text-sm font-medium text-white truncate flex-1">
                                                            {item.title}
                                                        </span>
                                                        <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                                            <span
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCopy(item.title);
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        handleCopy(item.title);
                                                                    }
                                                                }}
                                                                className="p-1 rounded-md hover:bg-white/10 text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] inline-flex items-center justify-center"
                                                                title="Copy title"
                                                                aria-label={`Copy ${item.title}`}
                                                            >
                                                                {copiedTitle === item.title ? (
                                                                    <Check size={11} className="text-green-400" />
                                                                ) : (
                                                                    <Copy size={11} />
                                                                )}
                                                            </span>
                                                            <a
                                                                href={linkedinUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="p-1 rounded-md hover:bg-white/10 text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] inline-flex items-center justify-center"
                                                                title="Search on LinkedIn"
                                                                aria-label={`Search ${item.title} on LinkedIn`}
                                                            >
                                                                <ExternalLink size={11} />
                                                            </a>
                                                        </span>
                                                        <ChevronDown
                                                            size={14}
                                                            className={`text-gray-500 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                        />
                                                    </button>
                                                    <AnimatePresence initial={false}>
                                                        {isExpanded && (
                                                            <motion.div
                                                                key="reasoning"
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                                                                className="overflow-hidden"
                                                            >
                                                                <p className="px-2.5 pb-2.5 pl-[1.875rem] text-xs text-gray-400 leading-relaxed">
                                                                    {item.reasoning}
                                                                </p>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </motion.li>
                                            );
                                        })}
                                    </AnimatePresence>
                                </ul>
                            </div>
                        );
                    })}

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
