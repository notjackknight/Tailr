import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GlassCard } from './ui/GlassCard';
import { Briefcase, RefreshCw, TrendingUp } from 'lucide-react';
import { fetchJobTitles, regenerateJobTitles } from '../lib/api';
import type { JobTitleResult } from '../../shared/types';

interface Props {
    masterResumeVersion: number;
}

export const JobTitleRecommendations = ({ masterResumeVersion }: Props) => {
    const [data, setData] = useState<JobTitleResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        } catch (err: any) {
            setError(err.message || 'Failed to generate');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        loadTitles();
    }, [loadTitles]);

    // Auto-regenerate when masterResumeVersion changes (skip initial)
    useEffect(() => {
        if (masterResumeVersion > 0) {
            regenerate();
        }
    }, [masterResumeVersion, regenerate]);

    return (
        <GlassCard className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/20">
                        <Briefcase className="text-amber-400" size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Recommended Job Titles</h3>
                        <p className="text-xs text-gray-500">Top 10 search keywords based on your resume</p>
                    </div>
                </div>
                <button
                    onClick={regenerate}
                    disabled={isLoading}
                    className="p-2 rounded-xl hover:bg-white/5 transition-colors disabled:opacity-50"
                    title="Refresh recommendations"
                >
                    <RefreshCw
                        size={16}
                        className={`text-gray-400 ${isLoading ? 'animate-spin' : ''}`}
                    />
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                    ⚠ {error}
                </div>
            )}

            {/* Loading */}
            {isLoading && (
                <div className="space-y-2 animate-pulse">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 bg-white/5 rounded-xl" />
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !data?.titles?.length && !error && (
                <div className="text-center py-8">
                    <TrendingUp className="mx-auto text-gray-600 mb-3" size={32} />
                    <p className="text-sm text-gray-500 mb-3">No recommendations yet</p>
                    <button
                        onClick={regenerate}
                        className="text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors"
                    >
                        Generate from your master resume →
                    </button>
                </div>
            )}

            {/* Results */}
            {!isLoading && data && data.titles.length > 0 && (
                <div className="space-y-2">
                    <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1">
                        <AnimatePresence>
                            {data.titles.map((item, i) => (
                                <motion.div
                                    key={item.title}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="flex items-start gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-xl hover:bg-white/[0.05] transition-colors group"
                                >
                                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0 mt-0.5">
                                        {i + 1}
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-sm font-semibold text-white block">{item.title}</span>
                                        <span className="text-xs text-gray-500 line-clamp-2">{item.reasoning}</span>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    {data.titles.length > 5 && (
                        <p className="text-[10px] text-gray-500 text-center">
                            Scroll to see all {data.titles.length} titles
                        </p>
                    )}

                    {data.generatedAt && (
                        <p className="text-[10px] text-gray-600 text-right mt-2">
                            Generated {new Date(data.generatedAt).toLocaleDateString()}
                        </p>
                    )}
                </div>
            )}
        </GlassCard>
    );
};
