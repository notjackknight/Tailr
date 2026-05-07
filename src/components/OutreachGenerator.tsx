import React, { useState } from 'react';
import { GlassCard } from './ui/GlassCard';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { SectionHeader } from './ui/SectionHeader';
import { Skeleton } from './ui/Skeleton';
import { Users, Copy, Check, Send, Sparkles, RefreshCw } from 'lucide-react';
import { generateOutreach } from '../lib/api';
import { toast } from './ui/Toast';
import type { OutreachResult } from '../../shared/types';

export const OutreachGenerator = () => {
    const [company, setCompany] = useState('');
    const [role, setRole] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<OutreachResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleGenerate = async () => {
        if (!company.trim() || !role.trim()) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await generateOutreach(company.trim(), role.trim());
            setResult(data);
            toast.success('Outreach generated');
        } catch (err: any) {
            const msg = err.message || 'Generation failed';
            setError(msg);
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(result.linkedinMessage);
            setCopied(true);
            toast.success('Copied to clipboard');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = result.linkedinMessage;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <GlassCard radius="lg" padding="md" className="space-y-5">
            <SectionHeader
                icon={<Users size={18} />}
                title="LinkedIn outreach"
                subtitle="Hiring-manager personas + a tailored intro message"
                accent="purple"
                as="h3"
                action={
                    result && (
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={<RefreshCw size={12} />}
                            onClick={handleGenerate}
                            disabled={isLoading}
                            type="button"
                        >
                            <span className="hidden sm:inline">Regenerate</span>
                        </Button>
                    )
                }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                    label="Company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Google"
                    disabled={isLoading}
                    inputSize="sm"
                />
                <Input
                    label="Target role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Senior Engineer"
                    disabled={isLoading}
                    inputSize="sm"
                />
            </div>

            <Button
                variant="primary"
                size="md"
                onClick={handleGenerate}
                disabled={!company.trim() || !role.trim() || isLoading}
                isLoading={isLoading}
                icon={!isLoading ? <Send size={14} /> : undefined}
                fullWidth
            >
                {isLoading ? 'Generating…' : result ? 'Generate again' : 'Generate outreach'}
            </Button>

            {error && (
                <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                    ⚠ {error}
                </div>
            )}

            {isLoading && (
                <div className="space-y-3">
                    <Skeleton className="h-3 w-1/3" />
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12" />
                    ))}
                    <Skeleton className="h-3 w-1/4 mt-3" />
                    <Skeleton className="h-20" />
                </div>
            )}

            {result && !isLoading && (
                <div className="space-y-5">
                    <div>
                        <h4 className="text-[11px] uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                            <Sparkles size={11} /> Likely hiring managers
                        </h4>
                        <div className="space-y-2">
                            {result.hiringManagers.map((hm, i) => (
                                <div
                                    key={i}
                                    className="flex items-start gap-3 p-2.5 bg-white/[0.03] border border-white/5 rounded-xl"
                                >
                                    <div className="w-7 h-7 rounded-full bg-purple-500/10 flex items-center justify-center text-xs font-bold text-purple-400 shrink-0 mt-0.5">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <span className="text-sm font-semibold text-white block leading-tight">
                                            {hm.title}
                                        </span>
                                        <span className="text-xs text-gray-500">{hm.reasoning}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[11px] uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                                <Send size={11} /> LinkedIn message
                            </h4>
                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00]"
                            >
                                {copied ? (
                                    <>
                                        <Check size={11} className="text-green-400" />
                                        <span className="text-green-400">Copied</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={11} className="text-gray-400" />
                                        <span className="text-gray-400">Copy</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <div className="p-3 bg-white/[0.03] border border-white/5 rounded-xl text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {result.linkedinMessage}
                        </div>
                    </div>
                </div>
            )}
        </GlassCard>
    );
};
