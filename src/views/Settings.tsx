import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import {
    Plus, Trash2, Save, CheckCircle2,
    User, Settings as SettingsIcon, Key, Eye, EyeOff, ExternalLink,
} from 'lucide-react';
import {
    fetchProfile,
    saveProfile,
    fetchPreferences,
    savePreferences,
} from '../lib/api';
import {
    getActiveProvider,
    setActiveProvider,
    getKeyFor,
    setKeyFor,
    clearKeyFor,
    PROVIDER_LABELS,
    PROVIDER_KEY_HELP,
} from '../lib/apiKey';
import type {
    UserProfile,
    UserProfileLink,
    UserPreferences,
    PinnedExperience,
    LlmProvider,
} from '../../shared/types';

const TONES: Array<{ value: UserPreferences['tone']; label: string; hint: string }> = [
    { value: 'professional',  label: 'Professional',   hint: 'Polished, neutral default.' },
    { value: 'concise',       label: 'Concise',        hint: 'Shorter bullets, action verbs.' },
    { value: 'impact-driven', label: 'Impact-driven',  hint: 'Lead with outcomes & metrics.' },
    { value: 'technical',     label: 'Technical',      hint: 'Architectural framing, depth-first.' },
    { value: 'leadership',    label: 'Leadership',     hint: 'Scope, ownership, team impact.' },
];

const PROVIDERS: LlmProvider[] = ['gemini', 'anthropic', 'openai'];

const EMPTY_PROFILE: UserProfile = { name: '', location: '', phone: '', email: '', links: [] };
const EMPTY_PREFERENCES: UserPreferences = {
    tone: 'professional',
    targetPageLength: 1,
    pinnedExperience: [],
    additionalGuidance: '',
};

export const Settings = () => {
    const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
    const [prefs, setPrefs] = useState<UserPreferences>(EMPTY_PREFERENCES);
    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPrefs, setSavingPrefs] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);
    const [prefsSaved, setPrefsSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── API Key state ────────────────────────────────────────
    const [provider, setProvider] = useState<LlmProvider>('gemini');
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [apiKeyVisible, setApiKeyVisible] = useState(false);
    const [apiKeySaved, setApiKeySaved] = useState(false);

    // Track which providers already have a key stored, so the toggle can show it.
    const [keyPresence, setKeyPresence] = useState<Record<LlmProvider, boolean>>({
        gemini: false, anthropic: false, openai: false,
    });

    const refreshKeyPresence = () => {
        setKeyPresence({
            gemini: !!getKeyFor('gemini'),
            anthropic: !!getKeyFor('anthropic'),
            openai: !!getKeyFor('openai'),
        });
    };

    useEffect(() => {
        const active = getActiveProvider();
        setProvider(active);
        setApiKeyInput(getKeyFor(active));
        refreshKeyPresence();
    }, []);

    const handleSelectProvider = (next: LlmProvider) => {
        setActiveProvider(next);
        setProvider(next);
        setApiKeyInput(getKeyFor(next));
        setApiKeyVisible(false);
        setApiKeySaved(false);
    };

    const handleSaveApiKey = () => {
        const trimmed = apiKeyInput.trim();
        if (!trimmed) {
            setError('API key cannot be empty.');
            return;
        }
        setError(null);
        setKeyFor(provider, trimmed);
        refreshKeyPresence();
        setApiKeySaved(true);
        setTimeout(() => setApiKeySaved(false), 2000);
    };

    const handleClearApiKey = () => {
        clearKeyFor(provider);
        setApiKeyInput('');
        setApiKeyVisible(false);
        refreshKeyPresence();
    };

    const help = PROVIDER_KEY_HELP[provider];
    const stored = keyPresence[provider];
    const placeholder = stored ? '••••••••••••••••••••••••••••••••' : help.placeholder;

    // ── Settings load ────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const [p, pr] = await Promise.all([fetchProfile(), fetchPreferences()]);
                setProfile({ ...EMPTY_PROFILE, ...p, links: p.links || [] });
                setPrefs({ ...EMPTY_PREFERENCES, ...pr });
            } catch (e: any) {
                setError(e.message || 'Failed to load settings');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleSaveProfile = async () => {
        setSavingProfile(true);
        setError(null);
        try {
            await saveProfile(profile);
            setProfileSaved(true);
            setTimeout(() => setProfileSaved(false), 2000);
        } catch (e: any) {
            setError(e.message || 'Failed to save profile');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleSavePrefs = async () => {
        setSavingPrefs(true);
        setError(null);
        try {
            await savePreferences(prefs);
            setPrefsSaved(true);
            setTimeout(() => setPrefsSaved(false), 2000);
        } catch (e: any) {
            setError(e.message || 'Failed to save preferences');
        } finally {
            setSavingPrefs(false);
        }
    };

    const updateLink = (i: number, patch: Partial<UserProfileLink>) => {
        setProfile((p) => ({
            ...p,
            links: p.links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
        }));
    };

    const addLink = () =>
        setProfile((p) => ({ ...p, links: [...p.links, { label: '', value: '' }] }));

    const removeLink = (i: number) =>
        setProfile((p) => ({ ...p, links: p.links.filter((_, idx) => idx !== i) }));

    const updatePinned = (i: number, patch: Partial<PinnedExperience>) => {
        setPrefs((p) => ({
            ...p,
            pinnedExperience: p.pinnedExperience.map((x, idx) => (idx === i ? { ...x, ...patch } : x)),
        }));
    };

    const addPinned = () =>
        setPrefs((p) => ({ ...p, pinnedExperience: [...p.pinnedExperience, { company: '' }] }));

    const removePinned = (i: number) =>
        setPrefs((p) => ({ ...p, pinnedExperience: p.pinnedExperience.filter((_, idx) => idx !== i) }));

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-8 bg-white/5 rounded w-1/3 animate-pulse" />
                <div className="h-64 bg-white/5 rounded-3xl animate-pulse" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 flex-1"
        >
            <header>
                <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Settings</h1>
                <p className="text-gray-400">Provider, profile, and tailoring preferences. Used on every generated resume.</p>
            </header>

            {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                    ⚠ {error}
                </div>
            )}

            {/* ── API Key + Provider ──────────────────────────────────── */}
            <GlassCard className="space-y-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <Key size={18} className="text-white/80" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-white">LLM Provider & API Key</h2>
                        <p className="text-xs text-gray-500">
                            Stored only in your browser's localStorage. Sent to the local server as request headers — never logged or persisted.
                        </p>
                    </div>
                    {stored && (
                        <span className="text-[10px] uppercase tracking-wider text-green-400 font-bold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Saved
                        </span>
                    )}
                </div>

                {/* Provider toggle */}
                <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Provider</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {PROVIDERS.map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => handleSelectProvider(p)}
                                className={`text-left p-3 rounded-xl border transition-colors ${
                                    provider === p
                                        ? 'bg-[#FF4F00]/10 border-[#FF4F00]/40'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold text-white">{PROVIDER_LABELS[p]}</span>
                                    {keyPresence[p] && (
                                        <CheckCircle2 size={12} className="text-green-400 shrink-0" />
                                    )}
                                </div>
                                <span className="block text-[11px] text-gray-500 mt-0.5">
                                    {p === 'gemini' && 'Gemini 2.5 Pro / Flash'}
                                    {p === 'anthropic' && 'Claude Sonnet 4.6 / Haiku 4.5'}
                                    {p === 'openai' && 'GPT-4o / GPT-4o-mini'}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Key input */}
                <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block" htmlFor="api-key-input">
                        {PROVIDER_LABELS[provider]} API Key
                    </label>
                    <div className="flex gap-2 flex-wrap">
                        <div className="flex-1 min-w-[200px] relative">
                            <input
                                id="api-key-input"
                                type={apiKeyVisible ? 'text' : 'password'}
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                placeholder={placeholder}
                                spellCheck={false}
                                autoComplete="off"
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20 font-mono"
                            />
                            <button
                                type="button"
                                onClick={() => setApiKeyVisible((v) => !v)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                aria-label={apiKeyVisible ? 'Hide key' : 'Show key'}
                            >
                                {apiKeyVisible
                                    ? <EyeOff size={14} className="text-gray-400" />
                                    : <Eye size={14} className="text-gray-400" />}
                            </button>
                        </div>
                        <Button
                            variant="primary"
                            size="md"
                            onClick={handleSaveApiKey}
                            icon={apiKeySaved ? <CheckCircle2 size={16} /> : <Save size={16} />}
                        >
                            {apiKeySaved ? 'Saved' : 'Save Key'}
                        </Button>
                        {stored && (
                            <button
                                type="button"
                                onClick={handleClearApiKey}
                                className="px-4 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl border border-white/10 transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <a
                        href={help.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[#FF4F00] hover:text-[#FF6B1F] mt-2 inline-flex items-center gap-1 transition-colors"
                    >
                        Get a {PROVIDER_LABELS[provider]} API key <ExternalLink size={10} />
                    </a>
                </div>
            </GlassCard>

            {/* ── Profile ─────────────────────────────────────────────── */}
            <GlassCard className="space-y-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <User size={18} className="text-white/80" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Profile</h2>
                        <p className="text-xs text-gray-500">Contact information shown at the top of every resume.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Full Name" value={profile.name} onChange={(v) => setProfile({ ...profile, name: v })} />
                    <Field label="Location" value={profile.location} onChange={(v) => setProfile({ ...profile, location: v })} placeholder="City, ST" />
                    <Field label="Phone" value={profile.phone} onChange={(v) => setProfile({ ...profile, phone: v })} />
                    <Field label="Email" value={profile.email} onChange={(v) => setProfile({ ...profile, email: v })} type="email" />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-gray-400 uppercase tracking-wider">Links</label>
                        <button
                            onClick={addLink}
                            className="text-xs text-[#FF4F00] hover:text-[#FF6B1F] flex items-center gap-1 transition-colors"
                            type="button"
                        >
                            <Plus size={12} /> Add link
                        </button>
                    </div>
                    {profile.links.length === 0 && (
                        <p className="text-xs text-gray-600">Add LinkedIn, GitHub, portfolio, or other relevant links.</p>
                    )}
                    <div className="space-y-2">
                        {profile.links.map((link, i) => (
                            <div key={i} className="flex gap-2">
                                <input
                                    type="text"
                                    value={link.label}
                                    onChange={(e) => updateLink(i, { label: e.target.value })}
                                    placeholder="Label (e.g. GitHub)"
                                    className="w-1/3 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20"
                                />
                                <input
                                    type="text"
                                    value={link.value}
                                    onChange={(e) => updateLink(i, { value: e.target.value })}
                                    placeholder="github.com/username"
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20"
                                />
                                <button
                                    onClick={() => removeLink(i)}
                                    className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                                    type="button"
                                    aria-label="Remove link"
                                >
                                    <Trash2 size={14} className="text-gray-400 hover:text-red-400" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button
                        variant="primary"
                        size="md"
                        onClick={handleSaveProfile}
                        isLoading={savingProfile}
                        icon={profileSaved ? <CheckCircle2 size={16} /> : <Save size={16} />}
                    >
                        {profileSaved ? 'Saved' : 'Save Profile'}
                    </Button>
                </div>
            </GlassCard>

            {/* ── Preferences ────────────────────────────────────────── */}
            <GlassCard className="space-y-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <SettingsIcon size={18} className="text-white/80" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Tailoring Preferences</h2>
                        <p className="text-xs text-gray-500">Apply to every resume the optimizer generates.</p>
                    </div>
                </div>

                <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Tone</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                        {TONES.map((t) => (
                            <button
                                key={t.value}
                                type="button"
                                onClick={() => setPrefs({ ...prefs, tone: t.value })}
                                className={`text-left p-3 rounded-xl border transition-colors ${
                                    prefs.tone === t.value
                                        ? 'bg-[#FF4F00]/10 border-[#FF4F00]/40'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                }`}
                            >
                                <span className="block text-sm font-semibold text-white">{t.label}</span>
                                <span className="block text-[11px] text-gray-500 mt-0.5">{t.hint}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-gray-400 uppercase tracking-wider">Pinned Experience</label>
                        <button
                            onClick={addPinned}
                            className="text-xs text-[#FF4F00] hover:text-[#FF6B1F] flex items-center gap-1 transition-colors"
                            type="button"
                        >
                            <Plus size={12} /> Add company
                        </button>
                    </div>
                    {prefs.pinnedExperience.length === 0 ? (
                        <p className="text-xs text-gray-600">
                            Companies whose roles must always appear on tailored resumes (e.g. current employer or flagship role). Match against the <code className="text-gray-500">company</code> field in your master resume.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {prefs.pinnedExperience.map((p, i) => (
                                <div key={i} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={p.company}
                                        onChange={(e) => updatePinned(i, { company: e.target.value })}
                                        placeholder="Company name"
                                        className="w-1/3 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20"
                                    />
                                    <input
                                        type="text"
                                        value={p.note || ''}
                                        onChange={(e) => updatePinned(i, { note: e.target.value })}
                                        placeholder="Optional note (e.g. 'current role')"
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20"
                                    />
                                    <button
                                        onClick={() => removePinned(i)}
                                        className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                                        type="button"
                                        aria-label="Remove pinned company"
                                    >
                                        <Trash2 size={14} className="text-gray-400 hover:text-red-400" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Additional guidance</label>
                    <textarea
                        value={prefs.additionalGuidance}
                        onChange={(e) => setPrefs({ ...prefs, additionalGuidance: e.target.value })}
                        placeholder="Free-text instructions sent verbatim to the tailoring prompt. Optional."
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20 resize-y"
                    />
                </div>

                <div className="flex justify-end">
                    <Button
                        variant="primary"
                        size="md"
                        onClick={handleSavePrefs}
                        isLoading={savingPrefs}
                        icon={prefsSaved ? <CheckCircle2 size={16} /> : <Save size={16} />}
                    >
                        {prefsSaved ? 'Saved' : 'Save Preferences'}
                    </Button>
                </div>
            </GlassCard>
        </motion.div>
    );
};

interface FieldProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
}

const Field = ({ label, value, onChange, type = 'text', placeholder }: FieldProps) => (
    <div>
        <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">{label}</label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20 transition-colors"
        />
    </div>
);
