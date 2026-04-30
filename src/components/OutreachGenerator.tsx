import React, { useState } from 'react';
import { GlassCard } from './ui/GlassCard';
import { Button } from './ui/Button';
import { Users, Copy, Check, Send, Sparkles } from 'lucide-react';
import { generateOutreach } from '../lib/api';
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
        setResult(null);
        try {
            const data = await generateOutreach(company.trim(), role.trim());
            setResult(data);
        } catch (err: any) {
            setError(err.message || 'Generation failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(result.linkedinMessage);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
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
        <GlassCard className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-purple-500/20">
                    <Users className="text-purple-400" size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white">Outreach Generator</h3>
                    <p className="text-xs text-gray-500">Find hiring managers & craft LinkedIn messages</p>
                </div>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">Company</label>
                    <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="e.g. Google"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/40 transition-colors"
                        disabled={isLoading}
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">Target Role</label>
                    <input
                        type="text"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        placeholder="e.g. Senior Engineer"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/40 transition-colors"
                        disabled={isLoading}
                    />
                </div>
            </div>

            <Button
                variant="primary"
                size="md"
                onClick={handleGenerate}
                disabled={!company.trim() || !role.trim() || isLoading}
                isLoading={isLoading}
                icon={!isLoading && <Send size={16} />}
                className="w-full"
            >
                {isLoading ? 'Generating...' : 'Generate Outreach'}
            </Button>

            {/* Error */}
            {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                    ⚠ {error}
                </div>
            )}

            {/* Loading Skeleton */}
            {isLoading && (
                <div className="space-y-4 animate-pulse">
                    <div className="h-4 bg-white/10 rounded w-1/3" />
                    <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-12 bg-white/5 rounded-xl" />
                        ))}
                    </div>
                    <div className="h-4 bg-white/10 rounded w-1/4 mt-6" />
                    <div className="h-24 bg-white/5 rounded-xl" />
                </div>
            )}

            {/* Results */}
            {result && !isLoading && (
                <div className="space-y-6">
                    {/* Hiring Managers */}
                    <div>
                        <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                            <Sparkles size={12} /> Likely Hiring Managers
                        </h4>
                        <div className="space-y-2">
                            {result.hiringManagers.map((hm, i) => (
                                <div
                                    key={i}
                                    className="flex items-start gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-xl"
                                >
                                    <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-xs font-bold text-purple-400 shrink-0 mt-0.5">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <span className="text-sm font-semibold text-white block">{hm.title}</span>
                                        <span className="text-xs text-gray-500">{hm.reasoning}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* LinkedIn Message */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs uppercase tracking-wider text-gray-400 flex items-center gap-2">
                                <Send size={12} /> LinkedIn Message
                            </h4>
                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-xs font-medium"
                            >
                                {copied ? (
                                    <>
                                        <Check size={12} className="text-green-400" />
                                        <span className="text-green-400">Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={12} className="text-gray-400" />
                                        <span className="text-gray-400">Copy</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {result.linkedinMessage}
                        </div>
                    </div>
                </div>
            )}
        </GlassCard>
    );
};
