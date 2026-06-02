/**
 * Vault — dedicated page for all tailored resumes.
 *
 * Owns its own history fetch, the resume-card grid, and the preview / analysis /
 * delete flows (moved out of the Dashboard so the Dashboard stays lean). Reuses
 * the existing VaultCard + modal components unchanged.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { FileText, Sparkles } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { VaultCard } from '../components/VaultCard';
import { PdfPreviewModal } from '../components/modals/PdfPreviewModal';
import { AnalysisModal } from '../components/modals/AnalysisModal';
import { fetchHistory, deleteGeneration as apiDeleteGeneration } from '../lib/api';
import { toast } from '../components/ui/Toast';
import type { HistoryEntry, AppConfig } from '../../shared/types';

type View = 'dashboard' | 'studio' | 'settings' | 'vault';

interface VaultProps {
    config: AppConfig | null;
    onNavigate: (view: View) => void;
}

export const Vault = ({ config, onNavigate }: VaultProps) => {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewEntry, setPreviewEntry] = useState<HistoryEntry | null>(null);
    const [analysisEntry, setAnalysisEntry] = useState<HistoryEntry | null>(null);
    const contactName = config?.profile?.name || 'Resume';

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            setHistory(await fetchHistory());
        } catch {
            // non-fatal — empty state will render
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleDelete = async (entry: HistoryEntry) => {
        try {
            await apiDeleteGeneration(entry.id);
            setHistory((prev) => prev.filter((h) => h.id !== entry.id));
            toast.success(`Deleted resume for ${entry.company}`);
        } catch {
            toast.error('Failed to delete generation. Please try again.');
        }
    };

    return (
        <div className="space-y-6 flex-1">
            <header>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-1.5">Vault</h1>
                <p className="text-sm md:text-base text-gray-400">
                    {history.length > 0
                        ? `${history.length} tailored ${history.length === 1 ? 'resume' : 'resumes'}.`
                        : 'Your tailored resumes will collect here.'}
                </p>
            </header>

            {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {[1, 2, 3].map((i) => (
                        <GlassCard key={i} padding="md" radius="lg">
                            <Skeleton className="h-9 w-9 mb-3" rounded="full" />
                            <Skeleton className="h-4 w-3/4 mb-2" />
                            <Skeleton className="h-3 w-1/2 mb-4" />
                            <Skeleton className="h-3 w-full" />
                        </GlassCard>
                    ))}
                </div>
            )}

            {!loading && history.length === 0 && (
                <GlassCard padding="lg" radius="lg">
                    <EmptyState
                        icon={<FileText size={28} />}
                        title="No tailored resumes yet"
                        description="Tailor a job description to generate your first resume — it'll show up here."
                        action={
                            <Button variant="primary" size="md" icon={<Sparkles size={16} />} onClick={() => onNavigate('studio')}>
                                Tailor a resume
                            </Button>
                        }
                    />
                </GlassCard>
            )}

            {!loading && history.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {history.map((entry) => (
                        <VaultCard
                            key={entry.id}
                            entry={entry}
                            contactName={contactName}
                            onAnalysis={setAnalysisEntry}
                            onPreview={setPreviewEntry}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
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
        </div>
    );
};
