/**
 * AnalysisModal — Shows fit analysis for a vault history entry.
 * Displays score, reasoning, ATS keywords, and stretch areas.
 *
 * JSON fields (`stretch_areas`, `ats_keywords`) are pre-parsed via the shared
 * api helper so this component never calls JSON.parse directly.
 */

import React, { useMemo } from 'react';
import { Target, Tag, AlertTriangle, Sparkles, Copy, Check } from 'lucide-react';
import { ScoreRing } from '../ui/ScoreRing';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { parseJsonArray } from '../../lib/api';
import { formatTone } from '../../lib/utils';
import { toast } from '../ui/Toast';
import { ColdDmBlock } from '../ColdDmBlock';

interface AnalysisModalProps {
    entry: {
        company: string;
        role: string;
        score: number;
        reasoning: string;
        stretch_areas: string;
        ats_keywords: string;
        outreach_dm?: string;
        chosen_tone?: string;
    };
    onClose: () => void;
    /** Optional callback — wires "Open in Tailor" affordance. */
    onOpenInStudio?: () => void;
}

export const AnalysisModal = ({ entry, onClose, onOpenInStudio }: AnalysisModalProps) => {
    const stretchAreas = useMemo(() => parseJsonArray<string>(entry.stretch_areas), [entry.stretch_areas]);
    const atsKeywords = useMemo(() => parseJsonArray<string>(entry.ats_keywords), [entry.ats_keywords]);

    const [copied, setCopied] = React.useState(false);

    const handleCopyKeywords = async () => {
        try {
            await navigator.clipboard.writeText(atsKeywords.join(', '));
            setCopied(true);
            toast.success('Keywords copied');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Could not access clipboard');
        }
    };

    return (
        <Modal
            onClose={onClose}
            title={entry.role}
            subtitle={entry.company}
            maxWidth="max-w-3xl"
            footer={
                onOpenInStudio && (
                    <div className="flex justify-end">
                        <Button
                            variant="primary"
                            size="md"
                            icon={<Sparkles size={14} />}
                            onClick={onOpenInStudio}
                        >
                            Open in Tailor
                        </Button>
                    </div>
                )
            }
        >
            <div className="p-5 md:p-7 space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-5 pb-5 border-b border-white/5">
                    <ScoreRing score={entry.score} size={92} strokeWidth={6} />
                    <div className="text-center sm:text-left">
                        <span className="text-xl md:text-2xl font-bold text-white block leading-tight">
                            Fit score {entry.score}/10
                        </span>
                        <p className="text-xs md:text-sm text-gray-400 mt-1">
                            {entry.score >= 8
                                ? 'Strong match — this resume should perform well in ATS and recruiter screens.'
                                : entry.score >= 6
                                ? 'Decent match — review the stretch areas before applying.'
                                : 'Weak match — consider another role or strengthening the stretch areas.'}
                        </p>
                    </div>
                </div>

                {entry.reasoning && (
                    <div>
                        <h4 className="text-[11px] uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                            <Target size={12} /> Why this fits
                        </h4>
                        <p className="text-sm md:text-base text-gray-300 leading-relaxed">
                            {entry.reasoning}
                        </p>
                        {entry.chosen_tone && (
                            <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FF4F00]/10 text-[#FF4F00] border border-[#FF4F00]/20 text-xs font-medium">
                                <Sparkles size={12} />
                                Tone: {formatTone(entry.chosen_tone)}
                            </div>
                        )}
                    </div>
                )}

                {entry.outreach_dm?.trim() && <ColdDmBlock dm={entry.outreach_dm} />}

                {atsKeywords.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                            <h4 className="text-[11px] uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                                <Tag size={12} /> ATS keywords matched ({atsKeywords.length})
                            </h4>
                            <button
                                onClick={handleCopyKeywords}
                                className="text-[11px] text-gray-400 hover:text-white inline-flex items-center gap-1 transition-colors"
                            >
                                {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                                {copied ? 'Copied' : 'Copy all'}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {atsKeywords.map((kw, i) => (
                                <span
                                    key={i}
                                    className="px-2.5 py-1 text-xs font-medium rounded-full bg-neon-green/10 text-neon-green border border-neon-green/20"
                                >
                                    {kw}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {stretchAreas.length > 0 && (
                    <div>
                        <h4 className="text-[11px] uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                            <AlertTriangle size={12} /> Stretch areas ({stretchAreas.length})
                        </h4>
                        <div className="space-y-2">
                            {stretchAreas.map((area, i) => (
                                <div
                                    key={i}
                                    className="flex items-start gap-2 p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-xl"
                                >
                                    <AlertTriangle size={12} className="mt-0.5 shrink-0 text-yellow-400" />
                                    <span className="text-sm text-yellow-200/90 leading-relaxed">{area}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
