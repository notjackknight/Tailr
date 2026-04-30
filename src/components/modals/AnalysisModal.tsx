/**
 * AnalysisModal — Shows fit analysis for a vault history entry.
 * Displays score, reasoning, ATS keywords, and stretch areas.
 */

import React from 'react';
import { motion } from 'motion/react';
import { X, Target, Tag, AlertTriangle } from 'lucide-react';
import { ScoreRing } from '../ui/ScoreRing';

interface AnalysisModalProps {
    entry: {
        company: string;
        role: string;
        score: number;
        reasoning: string;
        stretch_areas: string;
        ats_keywords: string;
    };
    onClose: () => void;
}

export const AnalysisModal = ({ entry, onClose }: AnalysisModalProps) => {
    // Parse JSON strings
    let stretchAreas: string[] = [];
    let atsKeywords: string[] = [];
    try { stretchAreas = JSON.parse(entry.stretch_areas || '[]'); } catch { /* empty */ }
    try { atsKeywords = JSON.parse(entry.ats_keywords || '[]'); } catch { /* empty */ }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-2xl max-h-[85vh] bg-[#0A0A0A] rounded-3xl overflow-hidden border border-white/10 flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 flex justify-between items-center border-b border-white/10 bg-white/[0.02] shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-white">{entry.role}</h3>
                        <p className="text-sm text-gray-400">{entry.company}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X size={16} className="text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* Score Ring */}
                    <div className="flex flex-col items-center gap-4 pb-8 border-b border-white/5">
                        <ScoreRing score={entry.score} size={100} strokeWidth={6} />
                        <div className="text-center">
                            <span className="text-2xl font-bold text-white block">Fit Score</span>
                            <span className="text-sm text-gray-500">{entry.score}/10 match</span>
                        </div>
                    </div>

                    {/* Reasoning */}
                    {entry.reasoning && (
                        <div>
                            <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                                <Target size={14} /> Analysis
                            </h4>
                            <p className="text-base text-gray-300 leading-relaxed">
                                {entry.reasoning}
                            </p>
                        </div>
                    )}

                    {/* ATS Keywords */}
                    {atsKeywords.length > 0 && (
                        <div>
                            <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                                <Tag size={14} /> ATS Keywords Matched
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {atsKeywords.map((kw, i) => (
                                    <span
                                        key={i}
                                        className="px-3 py-1.5 text-sm font-medium rounded-full bg-neon-green/10 text-neon-green border border-neon-green/20"
                                    >
                                        {kw}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Stretch Areas */}
                    {stretchAreas.length > 0 && (
                        <div>
                            <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                                <AlertTriangle size={14} /> Stretch Areas
                            </h4>
                            <div className="space-y-3">
                                {stretchAreas.map((area, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-xl"
                                    >
                                        <span className="text-yellow-400 text-sm mt-0.5">⚠</span>
                                        <span className="text-sm text-yellow-200/80 leading-relaxed">{area}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};
