import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { PdfPreviewModal } from '../components/modals/PdfPreviewModal';
import { AnalysisModal } from '../components/modals/AnalysisModal';
import { MasterResumeModal } from '../components/modals/MasterResumeModal';
import { OutreachGenerator } from '../components/OutreachGenerator';
import { JobTitleRecommendations } from '../components/JobTitleRecommendations';
import { VaultCard } from '../components/VaultCard';
import {
    FileText,
    Clock,
    Upload as UploadIcon,
    BarChart3,
    TrendingUp,
    Building2,
    Sparkles,
    CheckCircle2,
    Edit3,
} from 'lucide-react';
import {
    fetchHistory,
    deleteGeneration as apiDeleteGeneration,
    fetchMasterResume,
    fetchDashboardStats,
} from '../lib/api';
import { toast } from '../components/ui/Toast';
import type { HistoryEntry, DashboardStats, AppConfig } from '../../shared/types';

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Tooltip,
    Legend,
    Filler,
);

const StatCard = ({
    label,
    value,
    icon,
    accent,
    primary = false,
}: {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    accent?: string;
    primary?: boolean;
}) => (
    <GlassCard
        variant={primary ? 'featured' : 'default'}
        padding={primary ? 'lg' : 'md'}
        radius={primary ? 'xl' : 'lg'}
        className={`flex items-center gap-4 ${primary ? 'sm:col-span-2 lg:col-span-2' : ''}`}
    >
        <div
            className="rounded-xl flex items-center justify-center border shrink-0"
            style={{
                width: primary ? 56 : 44,
                height: primary ? 56 : 44,
                background: `${accent || '#054F31'}14`,
                borderColor: `${accent || '#054F31'}28`,
            }}
        >
            {icon}
        </div>
        <div className="min-w-0">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider block">{label}</span>
            <span
                className={`font-bold text-white block truncate ${primary ? 'text-3xl md:text-4xl' : 'text-xl md:text-2xl'}`}
                title={String(value)}
            >
                {value}
            </span>
        </div>
    </GlassCard>
);

interface DashboardProps {
    config: AppConfig | null;
    hasApiKey: boolean;
    onConfigChange: () => void;
}

export const Dashboard = ({ config, hasApiKey, onConfigChange }: DashboardProps) => {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewEntry, setPreviewEntry] = useState<HistoryEntry | null>(null);
    const [analysisEntry, setAnalysisEntry] = useState<HistoryEntry | null>(null);
    const [stats, setStats] = useState<DashboardStats | null>(null);

    const [isMasterOpen, setIsMasterOpen] = useState(false);
    const [masterContent, setMasterContent] = useState('');
    const [isMasterLoading, setIsMasterLoading] = useState(false);
    const [masterResumeVersion, setMasterResumeVersion] = useState(0);

    const contactName = config?.profile?.name || 'Resume';
    const masterResumePresent = config?.masterResumePresent ?? false;

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [historyData, statsData] = await Promise.all([
                fetchHistory(),
                fetchDashboardStats(),
            ]);
            setHistory(historyData);
            setStats(statsData);
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
            try {
                const statsData = await fetchDashboardStats();
                setStats(statsData);
            } catch { /* non-critical */ }
        } catch {
            toast.error('Failed to delete generation. Please try again.');
        }
    };

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

    const scoreTrendData = stats
        ? {
            labels: stats.scoreTrend.map((d) =>
                new Date(d.date + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            ),
            datasets: [{
                label: 'Fit Score',
                data: stats.scoreTrend.map((d) => d.score),
                borderColor: '#1A9E7A',
                backgroundColor: 'rgba(26, 158, 122, 0.12)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#1A9E7A',
                pointBorderColor: '#FFFFFF',
                pointBorderWidth: 2,
            }],
        }
        : null;

    const roleDistData = stats
        ? {
            labels: stats.roleDistribution.map((d) => d.role),
            datasets: [{
                data: stats.roleDistribution.map((d) => d.count),
                backgroundColor: ['#054F31', '#1A9E7A', '#34D8B4', '#A7F3E0', '#0E4D40', '#526e7d', '#7A8B92', '#BCC9C5'],
                borderColor: '#FFFFFF',
                borderWidth: 2,
            }],
        }
        : null;

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#0F1F1A', titleColor: '#FFFFFF', bodyColor: '#E6ECEA',
                borderColor: 'rgba(5, 79, 49, 0.20)', borderWidth: 1,
                cornerRadius: 12, padding: 12,
            },
        },
        scales: {
            x: { grid: { color: 'rgba(82, 110, 125, 0.10)' }, ticks: { color: '#526e7d', font: { size: 11 } } },
            y: { grid: { color: 'rgba(82, 110, 125, 0.10)' }, ticks: { color: '#526e7d', font: { size: 11 } }, min: 0, max: 10 },
        },
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: { color: '#526e7d', font: { size: 12 }, padding: 16, usePointStyle: true },
            },
            tooltip: {
                backgroundColor: '#0F1F1A', titleColor: '#FFFFFF', bodyColor: '#E6ECEA',
                borderColor: 'rgba(5, 79, 49, 0.20)', borderWidth: 1,
                cornerRadius: 12, padding: 12,
            },
        },
        cutout: '65%',
    };

    const hasGenerations = stats && stats.totalGenerations > 0;
    const showInsights = stats && (stats.scoreTrend.length > 1 || stats.roleDistribution.length > 0);

    return (
        <div className="space-y-6 md:space-y-8 flex-1">
            <header className="flex items-end justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-1.5">
                        Library
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

            {/* ── Stats Cards (only when there are generations) ──────── */}
            {hasGenerations && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
                >
                    <StatCard
                        label="Total resumes"
                        value={stats!.totalGenerations}
                        icon={<FileText size={22} style={{ color: '#054F31' }} />}
                        accent="#054F31"
                        primary
                    />
                    <StatCard
                        label="Avg fit score"
                        value={stats!.averageScore}
                        icon={<TrendingUp size={20} style={{ color: '#1A9E7A' }} />}
                        accent="#1A9E7A"
                    />
                    <StatCard
                        label="Top company"
                        value={stats!.topCompany}
                        icon={<Building2 size={20} style={{ color: '#0E4D40' }} />}
                        accent="#0E4D40"
                    />
                    <StatCard
                        label="Status"
                        value={masterResumePresent ? 'Ready' : 'Setup'}
                        icon={<Sparkles size={20} style={{ color: '#34D8B4' }} />}
                        accent="#34D8B4"
                    />
                </motion.div>
            )}

            {/* ── Charts row ─────────────────────────────────────────── */}
            {showInsights && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
                    {scoreTrendData && stats!.scoreTrend.length > 1 && (
                        <GlassCard padding="md" radius="lg">
                            <SectionHeader
                                icon={<BarChart3 size={16} />}
                                title="Score trend"
                                subtitle="Your fit score over time"
                                accent="tailr"
                                as="h3"
                                className="mb-4"
                            />
                            <div className="h-52">
                                <Line data={scoreTrendData} options={chartOptions} />
                            </div>
                        </GlassCard>
                    )}
                    {roleDistData && stats!.roleDistribution.length > 0 && (
                        <GlassCard padding="md" radius="lg">
                            <SectionHeader
                                icon={<BarChart3 size={16} />}
                                title="Role distribution"
                                subtitle="Where you've been tailoring"
                                accent="green"
                                as="h3"
                                className="mb-4"
                            />
                            <div className="h-52">
                                <Doughnut data={roleDistData} options={doughnutOptions} />
                            </div>
                        </GlassCard>
                    )}
                </div>
            )}

            {/* ── Outreach + JobTitles need both a master resume and an API key ── */}
            {masterResumePresent && hasApiKey && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
                    <JobTitleRecommendations masterResumeVersion={masterResumeVersion} />
                    <OutreachGenerator />
                </div>
            )}

            {/* ── Vault ──────────────────────────────────────────────── */}
            <div className="pt-2">
                <SectionHeader
                    icon={<FileText size={18} />}
                    title="Tailored resumes"
                    subtitle={
                        history.length > 0
                            ? `${history.length} ${history.length === 1 ? 'resume' : 'resumes'} in your vault`
                            : 'No resumes yet'
                    }
                    as="h2"
                    className="mb-4"
                />

                {!loading && history.length === 0 && (
                    <GlassCard padding="lg" radius="lg">
                        <EmptyState
                            icon={<FileText size={28} />}
                            title="No tailored resumes yet"
                            description={
                                masterResumePresent
                                    ? 'Head to Tailor to generate your first resume.'
                                    : 'Upload your master resume above to get started.'
                            }
                        />
                    </GlassCard>
                )}

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
            </div>

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
                    <MasterResumeModal initialContent={masterContent} onClose={handleMasterClose} />
                )}
            </AnimatePresence>
        </div>
    );
};
