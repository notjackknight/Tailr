import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { SectionHeader } from '../components/ui/SectionHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import {
    Plus, Trash2, Save, CheckCircle2,
    User, Settings as SettingsIcon, Key, Eye, EyeOff, ExternalLink,
    AlertTriangle,
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
import { toast } from '../components/ui/Toast';
import { ProviderLogo } from '../components/ProviderLogo';
import type {
    UserProfile,
    UserProfileLink,
    UserPreferences,
    LlmProvider,
} from '../../shared/types';

const TONES: Array<{ value: UserPreferences['tone']; label: string; hint: string }> = [
    { value: 'auto',          label: 'Auto',           hint: 'Let the AI match the tone to each job description.' },
    { value: 'professional',  label: 'Professional',   hint: 'Polished, neutral default.' },
    { value: 'concise',       label: 'Concise',        hint: 'Shorter bullets, action verbs.' },
    { value: 'impact-driven', label: 'Impact-driven',  hint: 'Lead with outcomes & metrics.' },
    { value: 'technical',     label: 'Technical',      hint: 'Architectural framing, depth-first.' },
    { value: 'leadership',    label: 'Leadership',     hint: 'Scope, ownership, team impact.' },
];

const PROVIDERS: LlmProvider[] = ['gemini', 'anthropic', 'openai'];

const KEY_PATTERNS: Record<LlmProvider, RegExp> = {
    gemini: /^AIza[0-9A-Za-z_-]{20,}/,
    anthropic: /^sk-ant-[A-Za-z0-9_-]{20,}/,
    openai: /^sk-[A-Za-z0-9_-]{20,}/,
};

const EMPTY_PROFILE: UserProfile = { name: '', location: '', phone: '', email: '', links: [] };
const EMPTY_PREFERENCES: UserPreferences = {
    tone: 'professional',
    targetPageLength: 1,
    pinnedExperience: [],
    additionalGuidance: '',
};

type SettingsSection = 'api' | 'profile' | 'preferences';

const SECTIONS: Array<{ id: SettingsSection; label: string; icon: React.ReactNode }> = [
    { id: 'api', label: 'API key & provider', icon: <Key size={16} /> },
    { id: 'profile', label: 'Profile', icon: <User size={16} /> },
    { id: 'preferences', label: 'Tailoring preferences', icon: <SettingsIcon size={16} /> },
];

export const Settings = () => {
    const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
    const [savedProfile, setSavedProfile] = useState<UserProfile>(EMPTY_PROFILE);
    const [prefs, setPrefs] = useState<UserPreferences>(EMPTY_PREFERENCES);
    const [savedPrefs, setSavedPrefs] = useState<UserPreferences>(EMPTY_PREFERENCES);
    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPrefs, setSavingPrefs] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);
    const [prefsSaved, setPrefsSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [section, setSection] = useState<SettingsSection>('api');

    // ── API Key state ────────────────────────────────────────
    const [provider, setProvider] = useState<LlmProvider>('gemini');
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [apiKeyVisible, setApiKeyVisible] = useState(false);
    const [apiKeySaved, setApiKeySaved] = useState(false);

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
            toast.error('API key cannot be empty.');
            return;
        }
        setError(null);
        setKeyFor(provider, trimmed);
        refreshKeyPresence();
        setApiKeySaved(true);
        toast.success(`${PROVIDER_LABELS[provider]} key saved`);
        setTimeout(() => setApiKeySaved(false), 2000);
    };

    const handleClearApiKey = () => {
        clearKeyFor(provider);
        setApiKeyInput('');
        setApiKeyVisible(false);
        refreshKeyPresence();
        toast.info(`${PROVIDER_LABELS[provider]} key cleared`);
    };

    const help = PROVIDER_KEY_HELP[provider];
    const stored = keyPresence[provider];
    const placeholder = stored ? '••••••••••••••••••••••••••••••••' : help.placeholder;
    const trimmedKey = apiKeyInput.trim();
    const keyShapeOk = !trimmedKey || KEY_PATTERNS[provider].test(trimmedKey);

    // ── Settings load ────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const [p, pr] = await Promise.all([fetchProfile(), fetchPreferences()]);
                const populated = { ...EMPTY_PROFILE, ...p, links: p.links || [] };
                const populatedPrefs = { ...EMPTY_PREFERENCES, ...pr };
                setProfile(populated);
                setSavedProfile(populated);
                setPrefs(populatedPrefs);
                setSavedPrefs(populatedPrefs);
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
            setSavedProfile(profile);
            setProfileSaved(true);
            toast.success('Profile saved');
            setTimeout(() => setProfileSaved(false), 2000);
        } catch (e: any) {
            const msg = e.message || 'Failed to save profile';
            setError(msg);
            toast.error(msg);
        } finally {
            setSavingProfile(false);
        }
    };

    const handleSavePrefs = async () => {
        setSavingPrefs(true);
        setError(null);
        try {
            await savePreferences(prefs);
            setSavedPrefs(prefs);
            setPrefsSaved(true);
            toast.success('Preferences saved');
            setTimeout(() => setPrefsSaved(false), 2000);
        } catch (e: any) {
            const msg = e.message || 'Failed to save preferences';
            setError(msg);
            toast.error(msg);
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

    const profileDirty = useMemo(
        () => JSON.stringify(profile) !== JSON.stringify(savedProfile),
        [profile, savedProfile],
    );
    const prefsDirty = useMemo(
        () => JSON.stringify(prefs) !== JSON.stringify(savedPrefs),
        [prefs, savedPrefs],
    );
    const showStickySave =
        (section === 'profile' && profileDirty) || (section === 'preferences' && prefsDirty);

    const handleStickySave = () => {
        if (section === 'profile') handleSaveProfile();
        else if (section === 'preferences') handleSavePrefs();
    };

    const handleStickyDiscard = () => {
        if (section === 'profile') setProfile(savedProfile);
        else if (section === 'preferences') setPrefs(savedPrefs);
    };

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
            className="space-y-6 flex-1"
        >
            <header>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-1.5">Settings</h1>
                <p className="text-sm md:text-base text-gray-400">
                    Provider, profile, and tailoring preferences. Used on every generated resume.
                </p>
            </header>

            {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 flex items-center gap-2">
                    <AlertTriangle size={14} /> {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 md:gap-6">
                {/* Left rail */}
                <nav className="lg:sticky lg:top-0 self-start" aria-label="Settings sections">
                    {/* Mobile: horizontal scroll tabs */}
                    <div className="lg:hidden -mx-3 px-3 overflow-x-auto">
                        <div className="inline-flex gap-1 rounded-xl bg-white/5 border border-white/10 p-1">
                            {SECTIONS.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => setSection(s.id)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] ${
                                        section === s.id
                                            ? 'bg-gradient-tailr-soft text-white border border-[#FF4F00]/30'
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    {s.icon}
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Desktop: vertical list */}
                    <ul className="hidden lg:flex flex-col gap-1 bg-white/[0.02] border border-white/5 rounded-2xl p-2">
                        {SECTIONS.map((s) => (
                            <li key={s.id}>
                                <button
                                    type="button"
                                    onClick={() => setSection(s.id)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] ${
                                        section === s.id
                                            ? 'bg-white/10 text-white'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                                    aria-current={section === s.id ? 'page' : undefined}
                                >
                                    {s.icon}
                                    {s.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Right pane */}
                <div className="space-y-6">
                    {section === 'api' && (
                        <GlassCard variant="featured" radius="xl" padding="lg" className="space-y-5">
                            <SectionHeader
                                icon={<Key size={18} />}
                                title="LLM provider & API key"
                                subtitle="Stored only in your browser's localStorage. Sent as request headers — never logged or persisted."
                                action={
                                    stored && (
                                        <span className="text-[10px] uppercase tracking-wider text-green-400 font-bold flex items-center gap-1">
                                            <CheckCircle2 size={12} /> Saved
                                        </span>
                                    )
                                }
                            />

                            <div>
                                <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Provider</label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {PROVIDERS.map((p) => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => handleSelectProvider(p)}
                                            className={`text-left p-3 rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] ${
                                                provider === p
                                                    ? 'bg-[#FF4F00]/10 border-[#FF4F00]/40'
                                                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-semibold text-white truncate">{PROVIDER_LABELS[p]}</span>
                                                        {keyPresence[p] && (
                                                            <CheckCircle2 size={12} className="text-green-400 shrink-0" />
                                                        )}
                                                    </div>
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
                            </div>

                            <div>
                                <Input
                                    label={`${PROVIDER_LABELS[provider]} API key`}
                                    type={apiKeyVisible ? 'text' : 'password'}
                                    value={apiKeyInput}
                                    onChange={(e) => setApiKeyInput(e.target.value)}
                                    placeholder={placeholder}
                                    spellCheck={false}
                                    autoComplete="off"
                                    mono
                                    error={
                                        !keyShapeOk
                                            ? `Doesn't look like a ${PROVIDER_LABELS[provider]} key (expected ${help.placeholder})`
                                            : undefined
                                    }
                                    suffix={
                                        <button
                                            type="button"
                                            onClick={() => setApiKeyVisible((v) => !v)}
                                            className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-gray-400"
                                            aria-label={apiKeyVisible ? 'Hide key' : 'Show key'}
                                        >
                                            {apiKeyVisible
                                                ? <EyeOff size={14} />
                                                : <Eye size={14} />}
                                        </button>
                                    }
                                />
                                <div className="flex flex-wrap items-center gap-2 mt-3">
                                    <Button
                                        variant="primary"
                                        size="md"
                                        onClick={handleSaveApiKey}
                                        disabled={!trimmedKey || !keyShapeOk}
                                        icon={apiKeySaved ? <CheckCircle2 size={16} /> : <Save size={16} />}
                                    >
                                        {apiKeySaved ? 'Saved' : 'Save key'}
                                    </Button>
                                    {stored && (
                                        <Button
                                            variant="danger"
                                            size="md"
                                            onClick={handleClearApiKey}
                                            icon={<Trash2 size={14} />}
                                        >
                                            Clear
                                        </Button>
                                    )}
                                    <a
                                        href={help.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="ml-auto text-xs text-[#FF4F00] hover:text-[#FF6B1F] inline-flex items-center gap-1 transition-colors"
                                    >
                                        Get a {PROVIDER_LABELS[provider]} key <ExternalLink size={10} />
                                    </a>
                                </div>
                            </div>
                        </GlassCard>
                    )}

                    {section === 'profile' && (
                        <GlassCard variant="featured" radius="xl" padding="lg" className="space-y-5">
                            <SectionHeader
                                icon={<User size={18} />}
                                title="Profile"
                                subtitle="Contact information shown at the top of every resume."
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Input label="Full name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                                <Input label="Location" value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} placeholder="City, ST" />
                                <Input label="Phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                                <Input label="Email" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs text-gray-400 uppercase tracking-wider">Links</label>
                                    <Button
                                        variant="link"
                                        onClick={addLink}
                                        icon={<Plus size={12} />}
                                        type="button"
                                        className="text-xs"
                                    >
                                        Add link
                                    </Button>
                                </div>
                                {profile.links.length === 0 && (
                                    <p className="text-xs text-gray-600">Add LinkedIn, GitHub, portfolio, or other relevant links.</p>
                                )}
                                <div className="space-y-2">
                                    {profile.links.map((link, i) => (
                                        <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
                                            <Input
                                                value={link.label}
                                                onChange={(e) => updateLink(i, { label: e.target.value })}
                                                placeholder="GitHub"
                                                inputSize="sm"
                                                aria-label="Link label"
                                            />
                                            <Input
                                                value={link.value}
                                                onChange={(e) => updateLink(i, { value: e.target.value })}
                                                placeholder="github.com/username"
                                                inputSize="sm"
                                                aria-label="Link value"
                                            />
                                            <button
                                                onClick={() => removeLink(i)}
                                                className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-gray-400 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00]"
                                                type="button"
                                                aria-label="Remove link"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-3 pt-1">
                                <span className="text-xs text-gray-500">
                                    {profileDirty ? 'You have unsaved changes' : 'All changes saved'}
                                </span>
                                <Button
                                    variant="primary"
                                    size="md"
                                    onClick={handleSaveProfile}
                                    disabled={!profileDirty || savingProfile}
                                    isLoading={savingProfile}
                                    icon={profileSaved ? <CheckCircle2 size={16} /> : <Save size={16} />}
                                >
                                    {profileSaved ? 'Saved' : 'Save profile'}
                                </Button>
                            </div>
                        </GlassCard>
                    )}

                    {section === 'preferences' && (
                        <GlassCard variant="featured" radius="xl" padding="lg" className="space-y-6">
                            <SectionHeader
                                icon={<SettingsIcon size={18} />}
                                title="Tailoring preferences"
                                subtitle="Apply to every resume the optimizer generates."
                            />

                            <div>
                                <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Tone</label>
                                <SegmentedControl
                                    value={prefs.tone}
                                    onChange={(value) => setPrefs({ ...prefs, tone: value })}
                                    items={TONES.map((t) => ({ value: t.value, label: t.label, hint: t.hint }))}
                                    ariaLabel="Resume writing tone"
                                />
                                <p className="text-[11px] text-gray-500 mt-2">
                                    {TONES.find((t) => t.value === prefs.tone)?.hint}
                                </p>
                            </div>

                            <div>
                                <Textarea
                                    label="Additional guidance"
                                    rows={4}
                                    value={prefs.additionalGuidance}
                                    onChange={(e) => setPrefs({ ...prefs, additionalGuidance: e.target.value })}
                                    placeholder={`Free-text instructions sent verbatim to the tailoring prompt.\n\nExamples:\n• Lead with metrics; avoid buzzwords like "synergy."\n• Prefer projects that demonstrate distributed systems work.\n• Keep the summary to two sentences.`}
                                    helper={`${prefs.additionalGuidance.length}/2000 chars`}
                                />
                            </div>

                            <div className="flex items-center justify-between gap-3 pt-1">
                                <span className="text-xs text-gray-500">
                                    {prefsDirty ? 'You have unsaved changes' : 'All changes saved'}
                                </span>
                                <Button
                                    variant="primary"
                                    size="md"
                                    onClick={handleSavePrefs}
                                    disabled={!prefsDirty || savingPrefs}
                                    isLoading={savingPrefs}
                                    icon={prefsSaved ? <CheckCircle2 size={16} /> : <Save size={16} />}
                                >
                                    {prefsSaved ? 'Saved' : 'Save preferences'}
                                </Button>
                            </div>
                        </GlassCard>
                    )}
                </div>
            </div>

            {/* Sticky save bar — only when the current section has unsaved changes. */}
            {showStickySave && (
                <motion.div
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 80, opacity: 0 }}
                    className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-2 bg-[#0A0A0A] border border-white/15 rounded-xl shadow-2xl"
                >
                    <span className="text-xs text-gray-300 px-1">Unsaved changes</span>
                    <Button variant="ghost" size="sm" onClick={handleStickyDiscard} type="button">
                        Discard
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={handleStickySave}
                        isLoading={section === 'profile' ? savingProfile : savingPrefs}
                        icon={<Save size={14} />}
                    >
                        Save changes
                    </Button>
                </motion.div>
            )}
        </motion.div>
    );
};
