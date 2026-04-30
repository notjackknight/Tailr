import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { ScoreRing } from '../components/ui/ScoreRing';
import { PdfPreviewModal } from '../components/modals/PdfPreviewModal';
import { AnalysisModal } from '../components/modals/AnalysisModal';
import { MasterResumeModal } from '../components/modals/MasterResumeModal';
import { OutreachGenerator } from '../components/OutreachGenerator';
import { JobTitleRecommendations } from '../components/JobTitleRecommendations';
import {
    FileText,
    Clock,
    Download,
    Trash2,
    Eye,
    Upload as UploadIcon,
    BarChart3,
    TrendingUp,
    Building2,
    Sparkles,
} from 'lucide-react';
import { downloadResume, formatRelativeDate } from '../lib/utils';
import {
    fetchHistory,
    deleteGeneration as apiDeleteGeneration,
    fetchMasterResume,
    fetchDashboardStats,
} from '../lib/api';
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
}: {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    accent?: string;
}) => (
    <GlassCard className="flex items-center gap-4 p-5">
        <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0"
            style={{
                background: `${accent || '#FF4F00'}15`,
                borderColor: `${accent || '#FF4F00'}30`,
            }}
        >
            {icon}
        </div>
        <div>
            <span className="text-xs text-gray-500 uppercase tracking-wider block">{label}</span>
            <span className="text-2xl font-bold text-white">{value}</span>
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
    const [previewPdf, setPreviewPdf] = useState<string | null>(null);
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

    const handleDelete = async (id: number) => {
        try {
            await apiDeleteGeneration(id);
            setHistory((prev) => prev.filter((h) => h.id !== id));
            try {
                const statsData = await fetchDashboardStats();
                setStats(statsData);
            } catch { /* non-critical */ }
        } catch { /* swallow — user can retry */ }
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
                borderColor: '#FF4F00',
                backgroundColor: 'rgba(255, 79, 0, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#FF4F00',
                pointBorderColor: '#0A0A0A',
                pointBorderWidth: 2,
            }],
        }
        : null;

    const roleDistData = stats
        ? {
            labels: stats.roleDistribution.map((d) => d.role),
            datasets: [{
                data: stats.roleDistribution.map((d) => d.count),
                backgroundColor: ['#FF4F00', '#32D74B', '#FFD60A', '#5E5CE6', '#FF375F', '#30D158', '#64D2FF', '#BF5AF2'],
                borderColor: '#0A0A0A',
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
                backgroundColor: '#1a1a1a', titleColor: '#fff', bodyColor: '#ccc',
                borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
                cornerRadius: 12, padding: 12,
            },
        },
        scales: {
            x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#666', font: { size: 11 } } },
            y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#666', font: { size: 11 } }, min: 0, max: 10 },
        },
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: { color: '#999', font: { size: 11 }, padding: 16, usePointStyle: true },
            },
            tooltip: {
                backgroundColor: '#1a1a1a', titleColor: '#fff', bodyColor: '#ccc',
                borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
                cornerRadius: 12, padding: 12,
            },
        },
        cutout: '65%',
    };

    return (
        <div className="space-y-8 flex-1">
            <header className="flex items-end justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Dashboard</h1>
                    <p className="text-gray-400">
                        {masterResumePresent ? 'Your master resume is ready to tailor.' : 'Start by uploading your master resume.'}
                    </p>
                </div>
                <Button
                    variant={masterResumePresent ? 'secondary' : 'primary'}
                    icon={<UploadIcon size={16} className="shrink-0" />}
                    onClick={handleOpenMaster}
                >
                    {masterResumePresent ? 'Update Master' : 'Upload Master Resume'}
                </Button>
            </header>

            {/* Stats Cards */}
            {stats && stats.totalGenerations > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-2 lg:grid-cols-4 gap-4"
                >
                    <StatCard label="Total Resumes" value={stats.totalGenerations} icon={<FileText size={20} className="text-[#FF4F00]" />} accent="#FF4F00" />
                    <StatCard label="Avg Fit Score" value={stats.averageScore} icon={<TrendingUp size={20} className="text-[#32D74B]" />} accent="#32D74B" />
                    <StatCard label="Top Company" value={stats.topCompany} icon={<Building2 size={20} className="text-[#5E5CE6]" />} accent="#5E5CE6" />
                    <StatCard label="Master Resume" value={masterResumePresent ? 'Ready' : 'Missing'} icon={<Sparkles size={20} className="text-[#FFD60A]" />} accent="#FFD60A" />
                </motion.div>
            )}

            {/* Charts Row */}
            {stats && (stats.scoreTrend.length > 1 || stats.roleDistribution.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {scoreTrendData && stats.scoreTrend.length > 1 && (
                        <GlassCard className="p-5">
                            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                                <BarChart3 size={16} className="text-[#FF4F00]" /> Score Trend
                            </h3>
                            <div className="h-52">
                                <Line data={scoreTrendData} options={chartOptions} />
                            </div>
                        </GlassCard>
                    )}
                    {roleDistData && stats.roleDistribution.length > 0 && (
                        <GlassCard className="p-5">
                            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                                <BarChart3 size={16} className="text-[#32D74B]" /> Role Distribution
                            </h3>
                            <div className="h-52">
                                <Doughnut data={roleDistData} options={doughnutOptions} />
                            </div>
                        </GlassCard>
                    )}
                </div>
            )}

            {/* Outreach + JobTitles need both a master resume and an API key */}
            {masterResumePresent && hasApiKey && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <JobTitleRecommendations masterResumeVersion={masterResumeVersion} />
                    <OutreachGenerator />
                </div>
            )}

            {/* Vault */}
            <div className="pt-4 border-t border-white/5">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <FileText size={24} className="text-gray-400" />
                    The Vault
                </h2>

                <GlassCard className="relative overflow-hidden group mb-6">
                    <div className="absolute top-0 right-0 p-32 bg-gradient-tailr opacity-5 blur-[100px] rounded-full pointer-events-none" />
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                        <div className="flex items-start gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                                <FileText className="text-white/80" size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-white">Master Resume</h3>
                                <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
                                    <span className="flex items-center gap-1">
                                        <Clock size={12} className="shrink-0" />
                                        {masterResumePresent ? 'Available for Tailoring' : 'Not yet uploaded'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-8 w-full md:w-auto">
                            <div className="flex flex-col items-center">
                                <span className="text-xs uppercase tracking-wider text-gray-500 mb-1">Status</span>
                                <span className={`text-2xl font-bold ${masterResumePresent ? 'text-neon-green' : 'text-gray-500'}`}>
                                    {masterResumePresent ? 'Ready' : 'Empty'}
                                </span>
                            </div>
                            <div className="h-10 w-px bg-white/10 hidden md:block" />
                            <Button variant="ghost" className="hidden md:flex" onClick={handleOpenMaster}>
                                {masterResumePresent ? 'Edit Master' : 'Upload'}
                            </Button>
                        </div>
                    </div>
                </GlassCard>

                {!loading && history.length === 0 && (
                    <GlassCard className="text-center py-16">
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10">
                            <FileText className="text-gray-500" size={28} />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">No resumes yet</h3>
                        <p className="text-gray-500 text-sm">
                            {masterResumePresent
                                ? 'Head to the Studio to generate your first tailored resume.'
                                : 'Upload your master resume above to get started.'}
                        </p>
                    </GlassCard>
                )}

                {loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => (
                            <GlassCard key={i} className="animate-pulse">
                                <div className="h-4 bg-white/10 rounded w-3/4 mb-3" />
                                <div className="h-3 bg-white/5 rounded w-1/2 mb-6" />
                                <div className="h-3 bg-white/5 rounded w-full" />
                            </GlassCard>
                        ))}
                    </div>
                )}

                {!loading && history.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {history.map((entry) => (
                            <GlassCard key={entry.id} hoverEffect className="group relative">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-lg font-bold border border-white/10">
                                        {entry.company[0]?.toUpperCase()}
                                    </div>
                                    <ScoreRing score={entry.score} size={48} strokeWidth={4} />
                                </div>

                                <h3 className="font-bold text-lg mb-1 text-white leading-tight">{entry.role}</h3>
                                <p className="text-gray-400 text-sm mb-4">{entry.company}</p>

                                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                    <span className="text-xs text-gray-500 flex items-center gap-1">
                                        <Clock size={12} className="shrink-0" />
                                        {formatRelativeDate(entry.created_at)}
                                    </span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setAnalysisEntry(entry)} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="View Analysis" aria-label="View analysis">
                                            <BarChart3 size={14} className="text-gray-400 hover:text-white" />
                                        </button>
                                        <button onClick={() => setPreviewPdf(entry.pdf_filename)} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Preview" aria-label="Preview PDF">
                                            <Eye size={14} className="text-gray-400 hover:text-white" />
                                        </button>
                                        <button onClick={() => downloadResume(entry.pdf_filename, entry.company, 'pdf', contactName)} className="p-2 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1" title="Download PDF" aria-label="Download PDF">
                                            <span className="text-[10px] font-bold text-gray-400">PDF</span>
                                            <Download size={14} className="text-gray-400 hover:text-white" />
                                        </button>
                                        <button onClick={() => downloadResume(entry.pdf_filename, entry.company, 'docx', contactName)} className="p-2 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1" title="Download DOCX" aria-label="Download DOCX">
                                            <span className="text-[10px] font-bold text-gray-400">DOCX</span>
                                            <Download size={14} className="text-gray-400 hover:text-white" />
                                        </button>
                                        <button onClick={() => handleDelete(entry.id)} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete" aria-label="Delete generation">
                                            <Trash2 size={14} className="text-gray-400 hover:text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            </GlassCard>
                        ))}
                    </div>
                )}
            </div>

            <AnimatePresence>
                {previewPdf && <PdfPreviewModal pdfFilename={previewPdf} onClose={() => setPreviewPdf(null)} />}
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
