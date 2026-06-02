import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { PdfPreviewModal } from '../components/modals/PdfPreviewModal';
import { AnalysisModal } from '../components/modals/AnalysisModal';
import { MasterResumeModal } from '../components/modals/MasterResumeModal';
import { JobTitleRecommendations } from '../components/JobTitleRecommendations';
import { SummaryResumeCard } from '../components/SummaryResumeCard';
import { ScoreRing } from '../components/ui/ScoreRing';
import {
    FileText,
    Clock,
    Upload as UploadIcon,
    CheckCircle2,
    Edit3,
    Archive,
    ChevronRight,
    Sparkles,
    Eye,
    Download,
    BarChart3,
} from 'lucide-react';
import { fetchHistory, fetchMasterResume } from '../lib/api';
import { downloadResume, formatRelativeDate } from '../lib/utils';
import type { HistoryEntry, AppConfig } from '../../shared/types';

type View = 'dashboard' | 'studio' | 'settings' | 'vault';

interface DashboardProps {
    config: AppConfig | null;
    hasApiKey: boolean;
    onConfigChange: () => void;
    onNavigate: (view: View) => void;
}

export const Dashboard = ({ config, hasApiKey, onConfigChange, onNavigate }: DashboardProps) => {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [previewEntry, setPreviewEntry] = useState<HistoryEntry | null>(null);
    const [analysisEntry, setAnalysisEntry] = useState<HistoryEntry | null>(null);

    const [isMasterOpen, setIsMasterOpen] = useState(false);
    const [masterContent, setMasterContent] = useState('');
    const [isMasterLoading, setIsMasterLoading] = useState(false);
    const [masterResumeVersion, setMasterResumeVersion] = useState(0);
    const contactName = config?.profile?.name || 'Resume';
    const masterResumePresent = config?.masterResumePresent ?? false;
    const resumeCount = history.length;

    const loadHistory = useCallback(async () => {
        try {
            setHistory(await fetchHistory());
        } catch {
            // non-fatal — empty state renders
        }
    }, []);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    const handleOpenMaster = async () => {
        setIsMasterOpen(true);
        setIsMasterLoading(true);
        try {
            const content = await fetchMasterResume();
            setMasterContent(content);
        } catch {
            setMasterContent('');
        } finally {
            setIsMasterLoading(false);
        }
    };

    const handleMasterClose = () => {
        setIsMasterOpen(false);
        setMasterResumeVersion((v) => v + 1);
        onConfigChange();
    };

    const handleSummaryGenerated = useCallback(async () => {
        // A summary resume was generated — keep the recent list + count in sync.
        loadHistory();
    }, [loadHistory]);

    return (
        <div className="space-y-6 md:space-y-8 flex-1">
            <header className="flex items-end justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-1.5">
                        Dashboard
                    </h1>
                    <p className="text-sm md:text-base text-gray-400">
                        {masterResumePresent
                            ? 'Your master resume is ready. Tailor it for any job.'
                            : 'Upload your master resume to start tailoring.'}
                    </p>
                </div>
            </header>

            {/* ── Master Resume hero card ────────────────────────────── */}
            <GlassCard variant="featured" radius="xl" padding="lg">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                        <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                            <FileText className="text-white/80" size={28} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg md:text-xl font-semibold text-white">
                                Master resume
                            </h2>
                            <div className="flex items-center gap-2 mt-1.5 text-xs md:text-sm">
                                {masterResumePresent ? (
                                    <span className="inline-flex items-center gap-1 text-green-300">
                                        <CheckCircle2 size={14} />
                                        Ready for tailoring
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-yellow-300">
                                        <Clock size={14} />
                                        Not yet uploaded
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <Button
                        variant={masterResumePresent ? 'secondary' : 'primary'}
                        size="md"
                        icon={masterResumePresent ? <Edit3 size={16} /> : <UploadIcon size={16} />}
                        onClick={handleOpenMaster}
                        className="w-full md:w-auto"
                    >
                        {masterResumePresent ? 'Edit master' : 'Upload master resume'}
                    </Button>
                </div>
            </GlassCard>

            {/* ── JobTitles + (Summary stacked over Vault) ──────────── */}
            {masterResumePresent && hasApiKey ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 items-start">
                    <JobTitleRecommendations masterResumeVersion={masterResumeVersion} />
                    <div className="flex flex-col gap-3 md:gap-4">
                        <SummaryResumeCard
                            masterResumePresent={masterResumePresent}
                            hasApiKey={hasApiKey}
                            contactName={contactName}
                            onPreview={setPreviewEntry}
                            masterResumeVersion={masterResumeVersion}
                            onGenerated={handleSummaryGenerated}
                        />
                        <QuickTailorCard onTailor={() => onNavigate('studio')} />
                        <RecentResumesCard
                            entries={history}
                            contactName={contactName}
                            onPreview={setPreviewEntry}
                            onAnalysis={setAnalysisEntry}
                            onViewAll={() => onNavigate('vault')}
                        />
                    </div>
                </div>
            ) : (
                <VaultSummaryCard resumeCount={resumeCount} onOpen={() => onNavigate('vault')} />
            )}

            <AnimatePresence>
                {previewEntry && (
                    <PdfPreviewModal
                        pdfFilename={previewEntry.pdf_filename}
                        company={previewEntry.company}
                        role={previewEntry.role}
                        score={previewEntry.score}
                        contactName={contactName}
                        onClose={() => setPreviewEntry(null)}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {analysisEntry && <AnalysisModal entry={analysisEntry} onClose={() => setAnalysisEntry(null)} />}
            </AnimatePresence>

            <AnimatePresence>
                {isMasterOpen && !isMasterLoading && (
                    <MasterResumeModal
                        initialContent={masterContent}
                        defaultTab={masterResumePresent ? 'edit' : 'upload'}
                        onClose={handleMasterClose}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

/** Compact card linking to the full Vault page. */
const VaultSummaryCard = ({ resumeCount, onOpen }: { resumeCount: number; onOpen: () => void }) => (
    <button
        type="button"
        onClick={onOpen}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] rounded-2xl"
    >
        <GlassCard variant="featured" radius="xl" padding="lg" hoverEffect>
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                        <Archive className="text-white/80" size={24} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base md:text-lg font-semibold text-white">Vault</h2>
                        <p className="text-xs md:text-sm text-gray-400 mt-0.5">
                            {resumeCount > 0
                                ? `${resumeCount} tailored ${resumeCount === 1 ? 'resume' : 'resumes'}`
                                : 'No resumes yet'}
                        </p>
                    </div>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#FF4F00] shrink-0">
                    View vault
                    <ChevronRight size={16} />
                </span>
            </div>
        </GlassCard>
    </button>
);

/** Prominent CTA into the Tailor flow. */
const QuickTailorCard = ({ onTailor }: { onTailor: () => void }) => (
    <GlassCard radius="lg" padding="md">
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-[#FF4F00]/10 border border-[#FF4F00]/25 flex items-center justify-center shrink-0">
                    <Sparkles size={20} className="text-[#FF4F00]" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-base font-semibold text-white">Tailor a resume</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Paste a job description, get a one-page fit.</p>
                </div>
            </div>
            <Button variant="primary" size="md" onClick={onTailor} className="shrink-0">
                Start
            </Button>
        </div>
    </GlassCard>
);

/** The 3 most recent tailored resumes, with a link to the full Vault. */
const RecentResumesCard = ({
    entries,
    contactName,
    onPreview,
    onAnalysis,
    onViewAll,
}: {
    entries: HistoryEntry[];
    contactName: string;
    onPreview: (entry: HistoryEntry) => void;
    onAnalysis: (entry: HistoryEntry) => void;
    onViewAll: () => void;
}) => {
    if (entries.length === 0) return null;
    const recent = entries.slice(0, 3);
    return (
        <GlassCard radius="lg" padding="md" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock size={15} className="text-gray-400" /> Recent resumes
                </h3>
                <button
                    type="button"
                    onClick={onViewAll}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF4F00] hover:text-[#FF6B1F] transition-colors"
                >
                    View all <ChevronRight size={13} />
                </button>
            </div>
            <div className="space-y-2">
                {recent.map((entry) => (
                    <div
                        key={entry.id}
                        className="flex items-center gap-3 px-2.5 py-2 rounded-xl bg-white/[0.03] border border-white/5"
                    >
                        <ScoreRing score={entry.score} size={36} strokeWidth={3} animate={false} />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white truncate" title={entry.role}>
                                {entry.role}
                            </p>
                            <p className="text-[11px] text-gray-500 truncate">
                                {entry.company} · {formatRelativeDate(entry.created_at)}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onAnalysis(entry)}
                            title="View analysis"
                            aria-label={`View analysis for ${entry.role}`}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                        >
                            <BarChart3 size={15} />
                        </button>
                        <button
                            type="button"
                            onClick={() => onPreview(entry)}
                            title="Preview"
                            aria-label={`Preview ${entry.role}`}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                        >
                            <Eye size={15} />
                        </button>
                        <button
                            type="button"
                            onClick={() => downloadResume(entry.pdf_filename, entry.company, 'pdf', contactName)}
                            title="Download PDF"
                            aria-label={`Download ${entry.role} PDF`}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                        >
                            <Download size={15} />
                        </button>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
};
