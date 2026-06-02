/**
 * WelcomeWizard — first-run onboarding flow.
 *
 * Three steps: Provider key → Profile → Master resume.
 * Each step renders inline; the wizard advances as steps are completed.
 * The user can skip the wizard (chip in the corner of the AppShell still
 * surfaces remaining setup until done).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Sparkles,
    Key,
    User as UserIcon,
    Upload as UploadIcon,
    Check,
    ArrowRight,
    ExternalLink,
    Eye,
    EyeOff,
    AlertTriangle,
    X,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { ProviderLogo } from '../ProviderLogo';
import {
    fetchProfile,
    fetchPreferences,
    saveProfile,
    uploadMasterResume,
} from '../../lib/api';
import {
    PROVIDER_LABELS,
    PROVIDER_KEY_HELP,
    getActiveProvider,
    setActiveProvider,
    getKeyFor,
    setKeyFor,
} from '../../lib/apiKey';
import type { LlmProvider, UserProfile, AppConfig } from '../../../shared/types';
import { toast } from '../ui/Toast';

const PROVIDERS: LlmProvider[] = ['gemini', 'anthropic', 'openai'];
const EMPTY_PROFILE: UserProfile = { name: '', location: '', phone: '', email: '', links: [] };

interface WelcomeWizardProps {
    config: AppConfig | null;
    hasApiKey: boolean;
    onClose: () => void;
    /** Called whenever a sub-step persists data so the host can refresh. */
    onProgress?: () => void;
    /** Final completion (master resume uploaded). */
    onComplete?: () => void;
}

type StepId = 'provider' | 'profile' | 'master';

const KEY_PATTERNS: Record<LlmProvider, RegExp> = {
    gemini: /^AIza[0-9A-Za-z_-]{20,}/,
    anthropic: /^sk-ant-[A-Za-z0-9_-]{20,}/,
    openai: /^sk-[A-Za-z0-9_-]{20,}/,
};

export const WelcomeWizard = ({
    config,
    hasApiKey,
    onClose,
    onProgress,
    onComplete,
}: WelcomeWizardProps) => {
    // ── Determine starting step ─────────────────────────────────────
    const startStep: StepId = !hasApiKey
        ? 'provider'
        : !config?.profileConfigured
        ? 'profile'
        : 'master';

    const [step, setStep] = useState<StepId>(startStep);

    const steps: Array<{ id: StepId; label: string; icon: React.ReactNode }> = [
        { id: 'provider', label: 'Connect AI', icon: <Key size={16} /> },
        { id: 'profile', label: 'Your details', icon: <UserIcon size={16} /> },
        { id: 'master', label: 'Master resume', icon: <UploadIcon size={16} /> },
    ];

    const stepIndex = steps.findIndex((s) => s.id === step);
    const stepDone: Record<StepId, boolean> = {
        provider: hasApiKey,
        profile: !!config?.profileConfigured,
        master: !!config?.masterResumePresent,
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6"
            role="dialog"
            aria-modal="true"
        >
            <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 12 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-2xl bg-[#0A0A0A] rounded-2xl md:rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col max-h-[92vh]"
            >
                {/* Header — branding + skip */}
                <div className="relative px-5 md:px-7 pt-6 pb-4 border-b border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent">
                    <button
                        onClick={onClose}
                        type="button"
                        aria-label="Skip setup wizard"
                        className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00]"
                    >
                        <X size={16} />
                    </button>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-tailr flex items-center justify-center">
                            <Sparkles size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                                Welcome to Tailr
                            </h2>
                            <p className="text-xs md:text-sm text-gray-400">
                                Three quick steps and you'll be tailoring resumes.
                            </p>
                        </div>
                    </div>

                    {/* Step indicators */}
                    <div className="flex items-center gap-2 mt-4">
                        {steps.map((s, i) => {
                            const active = s.id === step;
                            const done = stepDone[s.id];
                            return (
                                <React.Fragment key={s.id}>
                                    <button
                                        type="button"
                                        onClick={() => setStep(s.id)}
                                        className={`group flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] ${
                                            active
                                                ? 'bg-white/10 text-white'
                                                : done
                                                ? 'text-green-300'
                                                : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                        aria-current={active ? 'step' : undefined}
                                    >
                                        <span
                                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                                                done
                                                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                                    : active
                                                    ? 'bg-gradient-tailr text-white'
                                                    : 'bg-white/5 text-gray-500 border border-white/10'
                                            }`}
                                        >
                                            {done ? <Check size={12} /> : i + 1}
                                        </span>
                                        <span className="hidden sm:inline">{s.label}</span>
                                    </button>
                                    {i < steps.length - 1 && (
                                        <span className="h-px flex-1 bg-white/5" aria-hidden="true" />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 md:px-7 py-6">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.18 }}
                        >
                            {step === 'provider' && (
                                <ProviderStep
                                    onAdvance={() => {
                                        onProgress?.();
                                        setStep(stepDone.profile ? 'master' : 'profile');
                                    }}
                                />
                            )}
                            {step === 'profile' && (
                                <ProfileStep
                                    onAdvance={() => {
                                        onProgress?.();
                                        setStep(stepDone.master ? 'provider' : 'master');
                                    }}
                                />
                            )}
                            {step === 'master' && (
                                <MasterStep
                                    onComplete={() => {
                                        onProgress?.();
                                        onComplete?.();
                                        onClose();
                                    }}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer — step nav */}
                <div className="px-5 md:px-7 py-3 border-t border-white/10 flex items-center justify-between gap-3 bg-white/[0.02]">
                    <button
                        onClick={onClose}
                        type="button"
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] rounded px-1"
                    >
                        I'll finish later
                    </button>
                    <div className="text-[11px] text-gray-600">
                        Step {stepIndex + 1} of {steps.length}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

// ── Step 1 — Provider ────────────────────────────────────────────────

const ProviderStep = ({ onAdvance }: { onAdvance: () => void }) => {
    const [provider, setProvider] = useState<LlmProvider>(getActiveProvider());
    const [keyValue, setKeyValue] = useState<string>('');
    const [visible, setVisible] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setKeyValue(getKeyFor(provider));
    }, [provider]);

    const help = PROVIDER_KEY_HELP[provider];
    const trimmed = keyValue.trim();
    const matchesShape = !trimmed || KEY_PATTERNS[provider].test(trimmed);

    const handleSave = () => {
        if (!trimmed) return;
        setSaving(true);
        try {
            setActiveProvider(provider);
            setKeyFor(provider, trimmed);
            toast.success(`${PROVIDER_LABELS[provider]} key saved`);
            onAdvance();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <h3 className="text-lg font-bold text-white mb-1">Connect your AI provider</h3>
            <p className="text-sm text-gray-400 mb-5">
                Bring your own key. Stored only in your browser, never logged or persisted by Tailr.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
                {PROVIDERS.map((p) => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => setProvider(p)}
                        className={`text-left p-3 rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] ${
                            provider === p
                                ? 'bg-[#FF4F00]/10 border-[#FF4F00]/40'
                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-white truncate">
                                    {PROVIDER_LABELS[p]}
                                </span>
                                <span className="block text-[11px] text-gray-500 mt-0.5">
                                    {p === 'gemini' && 'Gemini 2.5 Pro / Flash'}
                                    {p === 'anthropic' && 'Claude Sonnet 4.6 / Haiku 4.5'}
                                    {p === 'openai' && 'GPT-4o / GPT-4o-mini'}
                                </span>
                            </div>
                            <ProviderLogo provider={p} size={32} className="shrink-0" />
                        </div>
                    </button>
                ))}
            </div>

            <Input
                label={`${PROVIDER_LABELS[provider]} API key`}
                inputSize="md"
                mono
                type={visible ? 'text' : 'password'}
                placeholder={help.placeholder}
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                error={
                    !matchesShape
                        ? `Doesn't look like a ${PROVIDER_LABELS[provider]} key (expected ${help.placeholder})`
                        : undefined
                }
                helper={
                    matchesShape ? `Stored only in your browser's localStorage.` : undefined
                }
                suffix={
                    <button
                        type="button"
                        onClick={() => setVisible((v) => !v)}
                        className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-gray-400"
                        aria-label={visible ? 'Hide key' : 'Show key'}
                    >
                        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                }
            />

            <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
                <a
                    href={help.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#FF4F00] hover:text-[#FF6B1F] inline-flex items-center gap-1 transition-colors"
                >
                    Get a {PROVIDER_LABELS[provider]} key
                    <ExternalLink size={10} />
                </a>
                <Button
                    variant="primary"
                    size="md"
                    onClick={handleSave}
                    disabled={!trimmed || !matchesShape || saving}
                    isLoading={saving}
                    icon={<ArrowRight size={16} />}
                    iconPosition="right"
                >
                    Save & continue
                </Button>
            </div>
        </div>
    );
};

// ── Step 2 — Profile ─────────────────────────────────────────────────

const ProfileStep = ({ onAdvance }: { onAdvance: () => void }) => {
    const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const [p] = await Promise.all([fetchProfile(), fetchPreferences()]);
                setProfile({ ...EMPTY_PROFILE, ...p, links: p.links || [] });
            } catch {
                /* keep empty defaults */
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const valid =
        profile.name.trim().length > 0 && profile.email.trim().length > 0;

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            await saveProfile(profile);
            toast.success('Profile saved');
            onAdvance();
        } catch (e: any) {
            setError(e?.message || 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-3">
                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
            </div>
        );
    }

    return (
        <div>
            <h3 className="text-lg font-bold text-white mb-1">Tell us about yourself</h3>
            <p className="text-sm text-gray-400 mb-5">
                Used at the top of every tailored resume. Editable later in Settings.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                    label="Full name"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    placeholder="Jane Doe"
                    required
                />
                <Input
                    label="Email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    placeholder="jane@example.com"
                    required
                />
                <Input
                    label="Location"
                    value={profile.location}
                    onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                    placeholder="City, ST"
                />
                <Input
                    label="Phone"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="Optional"
                />
            </div>

            {error && (
                <div className="mt-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-center gap-2">
                    <AlertTriangle size={14} /> {error}
                </div>
            )}

            <div className="flex items-center justify-end mt-5">
                <Button
                    variant="primary"
                    size="md"
                    onClick={handleSave}
                    disabled={!valid || saving}
                    isLoading={saving}
                    icon={<ArrowRight size={16} />}
                    iconPosition="right"
                >
                    Save & continue
                </Button>
            </div>
        </div>
    );
};

// ── Step 3 — Master resume ───────────────────────────────────────────

const MasterStep = ({ onComplete }: { onComplete: () => void }) => {
    const [busy, setBusy] = useState(false);
    const [stage, setStage] = useState<'idle' | 'uploading' | 'parsing' | 'done' | 'error'>('idle');
    const [filename, setFilename] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const STEPS = useMemo(
        () => [
            { id: 'uploading', label: 'Uploading file' },
            { id: 'parsing', label: 'Parsing with LLM' },
            { id: 'done', label: 'Master resume saved' },
        ],
        [],
    );

    const handleFile = async (file?: File) => {
        if (!file) return;
        setError(null);
        setFilename(file.name);
        setStage('uploading');
        setBusy(true);
        try {
            // Brief artificial transition into "parsing" so the user gets feedback
            // while the LLM call is in flight.
            setTimeout(() => setStage((s) => (s === 'uploading' ? 'parsing' : s)), 600);
            await uploadMasterResume(file);
            setStage('done');
            toast.success('Master resume saved');
        } catch (e: any) {
            setError(e?.message || 'Upload failed');
            setStage('error');
        } finally {
            setBusy(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const onDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
        else if (e.type === 'dragleave') setDragActive(false);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
    };

    return (
        <div>
            <h3 className="text-lg font-bold text-white mb-1">Upload your master resume</h3>
            <p className="text-sm text-gray-400 mb-5">
                We extract every role, bullet, and skill, then reuse them when tailoring. Accepted: .docx, .pdf, .txt, .md, .yaml.
            </p>

            <div
                onDragEnter={onDrag}
                onDragLeave={onDrag}
                onDragOver={onDrag}
                onDrop={onDrop}
                onClick={() => !busy && stage !== 'done' && inputRef.current?.click()}
                className={`relative w-full rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center py-10 px-4 text-center select-none ${
                    busy || stage === 'done' ? 'pointer-events-none opacity-95' : 'cursor-pointer'
                } ${
                    dragActive
                        ? 'border-[#FF4F00] bg-[#FF4F00]/5'
                        : stage === 'error'
                        ? 'border-red-500/30 bg-red-500/5'
                        : stage === 'done'
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-white/15 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.05]'
                }`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".docx,.pdf,.txt,.md,.yaml,.yml"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                />

                {stage === 'idle' && (
                    <>
                        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                            <UploadIcon size={28} className="text-gray-400" />
                        </div>
                        <p className="text-base font-semibold text-white mb-1">Drop a file or click to choose</p>
                        <p className="text-xs text-gray-500">.docx, .pdf, .txt, .md, .yaml — up to 10MB</p>
                    </>
                )}

                {(stage === 'uploading' || stage === 'parsing') && (
                    <div className="flex flex-col items-center text-center w-full max-w-sm">
                        <Spinner size={32} className="text-[#FF4F00]" />
                        <p className="mt-3 text-sm text-white font-semibold truncate w-full">{filename}</p>
                        <ul className="mt-4 space-y-1.5 w-full">
                            {STEPS.map((s) => {
                                const order = STEPS.findIndex((x) => x.id === s.id);
                                const currentOrder = STEPS.findIndex((x) => x.id === stage);
                                const isDone = order < currentOrder || stage === 'done';
                                const isActive = s.id === stage;
                                return (
                                    <li
                                        key={s.id}
                                        className={`flex items-center gap-2 text-xs ${
                                            isDone ? 'text-green-300' : isActive ? 'text-white' : 'text-gray-500'
                                        }`}
                                    >
                                        {isDone ? (
                                            <Check size={12} className="text-green-400 shrink-0" />
                                        ) : isActive ? (
                                            <Spinner size={12} className="text-[#FF4F00]" />
                                        ) : (
                                            <span className="w-3 h-3 rounded-full border border-gray-600 shrink-0" />
                                        )}
                                        {s.label}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {stage === 'done' && (
                    <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mb-3">
                            <Check size={28} className="text-green-400" />
                        </div>
                        <p className="text-base font-semibold text-white mb-1">Resume parsed</p>
                        <p className="text-xs text-gray-500 max-w-xs">
                            {filename} is now your master resume. You can re-upload at any time from the Dashboard.
                        </p>
                    </div>
                )}

                {stage === 'error' && (
                    <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3">
                            <AlertTriangle size={28} className="text-red-400" />
                        </div>
                        <p className="text-base font-semibold text-white mb-1">Upload failed</p>
                        <p className="text-xs text-gray-400 max-w-xs">{error}</p>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setStage('idle');
                                setError(null);
                            }}
                            className="mt-3 text-xs text-[#FF4F00] hover:text-[#FF6B1F]"
                        >
                            Try a different file
                        </button>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-end mt-5">
                <Button
                    variant="primary"
                    size="md"
                    onClick={onComplete}
                    disabled={stage !== 'done'}
                    icon={<Sparkles size={16} />}
                >
                    Start tailoring
                </Button>
            </div>
        </div>
    );
};
