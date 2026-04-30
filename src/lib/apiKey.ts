/**
 * src/lib/apiKey.ts — Client-side LLM credential storage.
 *
 * Stores one key per provider in localStorage along with which provider is
 * currently active. Switching providers preserves any previously-entered keys.
 */

import type { LlmProvider } from '../../shared/types';

const STORAGE_KEYS = {
    activeProvider: 'tailr.llmProvider',
    keys: 'tailr.llmKeys',
} as const;

const DEFAULT_PROVIDER: LlmProvider = 'gemini';

const listeners = new Set<() => void>();

function isProvider(v: unknown): v is LlmProvider {
    return v === 'gemini' || v === 'anthropic' || v === 'openai';
}

function readActiveProvider(): LlmProvider {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.activeProvider);
        return isProvider(raw) ? raw : DEFAULT_PROVIDER;
    } catch {
        return DEFAULT_PROVIDER;
    }
}

function readAllKeys(): Record<LlmProvider, string> {
    const blank: Record<LlmProvider, string> = { gemini: '', anthropic: '', openai: '' };
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.keys);
        if (!raw) return blank;
        const parsed = JSON.parse(raw);
        return {
            gemini:    typeof parsed.gemini === 'string' ? parsed.gemini : '',
            anthropic: typeof parsed.anthropic === 'string' ? parsed.anthropic : '',
            openai:    typeof parsed.openai === 'string' ? parsed.openai : '',
        };
    } catch {
        return blank;
    }
}

function writeAllKeys(keys: Record<LlmProvider, string>): void {
    try {
        localStorage.setItem(STORAGE_KEYS.keys, JSON.stringify(keys));
    } catch { /* ignore — private mode etc. */ }
}

export function getActiveProvider(): LlmProvider {
    return readActiveProvider();
}

export function setActiveProvider(provider: LlmProvider): void {
    try {
        localStorage.setItem(STORAGE_KEYS.activeProvider, provider);
    } catch { /* ignore */ }
    listeners.forEach((fn) => fn());
}

export function getKeyFor(provider: LlmProvider): string {
    return readAllKeys()[provider] || '';
}

export function setKeyFor(provider: LlmProvider, key: string): void {
    const all = readAllKeys();
    all[provider] = key.trim();
    writeAllKeys(all);
    listeners.forEach((fn) => fn());
}

export function clearKeyFor(provider: LlmProvider): void {
    setKeyFor(provider, '');
}

export function getActiveKey(): string {
    return getKeyFor(getActiveProvider());
}

export function hasActiveKey(): boolean {
    return getActiveKey().length > 0;
}

/** Subscribe to provider/key changes. Returns an unsubscribe function. */
export function subscribeApiKey(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/**
 * Build a request init with X-LLM-Provider + X-Api-Key headers attached
 * when both are set. Pass any existing init; this returns a new object.
 */
export function withApiKey(init: RequestInit = {}): RequestInit {
    const provider = getActiveProvider();
    const key = getKeyFor(provider);
    if (!key) return init;

    const headers = new Headers(init.headers || {});
    headers.set('X-Api-Key', key);
    headers.set('X-LLM-Provider', provider);
    return { ...init, headers };
}

export const PROVIDER_LABELS: Record<LlmProvider, string> = {
    gemini: 'Google Gemini',
    anthropic: 'Anthropic Claude',
    openai: 'OpenAI ChatGPT',
};

export const PROVIDER_KEY_HELP: Record<LlmProvider, { url: string; placeholder: string }> = {
    gemini:    { url: 'https://aistudio.google.com/apikey', placeholder: 'AIza...' },
    anthropic: { url: 'https://console.anthropic.com/settings/keys', placeholder: 'sk-ant-...' },
    openai:    { url: 'https://platform.openai.com/api-keys', placeholder: 'sk-...' },
};
