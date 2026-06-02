/**
 * src/lib/api.ts — Centralized API service layer.
 * All fetch() calls live here. Views import typed functions instead of
 * building fetch requests inline.
 */

import type {
    HistoryEntry,
    GenerationResult,
    DashboardStats,
    JobTitleResult,
    AppConfig,
    UserProfile,
    UserPreferences,
} from '../../shared/types';
import { withApiKey } from './apiKey';

async function readError(res: Response, fallback: string): Promise<string> {
    try {
        const text = await res.text();
        if (!text) return fallback;
        try {
            const data = JSON.parse(text);
            return data.error || fallback;
        } catch {
            return fallback;
        }
    } catch {
        return fallback;
    }
}

// ── Config ──────────────────────────────────────────────────

let cachedConfig: AppConfig | null = null;

export async function fetchConfig(force = false): Promise<AppConfig> {
    if (cachedConfig && !force) return cachedConfig;
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('Failed to load config');
    cachedConfig = await res.json();
    return cachedConfig!;
}

export function clearConfigCache(): void {
    cachedConfig = null;
}

// ── Profile ─────────────────────────────────────────────────

export async function fetchProfile(): Promise<UserProfile> {
    const res = await fetch('/api/profile');
    if (!res.ok) {
        // Non-fatal — fall back to an empty profile so the UI can render its
        // empty state (e.g. on first run before a profile has been created).
        return { name: '', location: '', phone: '', email: '', links: [] };
    }
    return res.json();
}

export async function saveProfile(profile: UserProfile): Promise<void> {
    const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
    });
    if (!res.ok) throw new Error(await readError(res, 'Failed to save profile'));
    clearConfigCache();
}

// ── Preferences ─────────────────────────────────────────────

export async function fetchPreferences(): Promise<UserPreferences> {
    const res = await fetch('/api/preferences');
    if (!res.ok) {
        // Non-fatal — fall back to defaults so the UI can render its empty state.
        return {
            tone: 'professional',
            targetPageLength: 1,
            pinnedExperience: [],
            additionalGuidance: '',
        };
    }
    return res.json();
}

export async function savePreferences(prefs: UserPreferences): Promise<void> {
    const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
    });
    if (!res.ok) throw new Error(await readError(res, 'Failed to save preferences'));
    clearConfigCache();
}

// ── History ─────────────────────────────────────────────────

export async function fetchHistory(): Promise<HistoryEntry[]> {
    const res = await fetch('/api/history');
    if (!res.ok) throw new Error('Failed to load history');
    return res.json();
}

/**
 * Safely parse a JSON-encoded string field returned from the server.
 * Some HistoryEntry fields (`stretch_areas`, `ats_keywords`) come over the wire
 * as JSON-encoded strings. Parsing in the API layer keeps `JSON.parse` out of
 * render code and centralizes the fallback behavior.
 */
export function parseJsonArray<T = string>(value: string | undefined | null): T[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export async function deleteGeneration(id: number): Promise<void> {
    const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete generation');
}

// ── Master Resume ───────────────────────────────────────────

export async function fetchMasterResume(): Promise<string> {
    const res = await fetch('/api/master');
    if (!res.ok) throw new Error('Failed to load master resume');
    const data = await res.json();
    return data.content || '';
}

export async function saveMasterResume(content: string): Promise<void> {
    const res = await fetch('/api/master', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error(await readError(res, 'Failed to save master resume'));
    clearConfigCache();
}

export async function uploadMasterResume(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('resume', file);
    const res = await fetch('/api/master/upload', withApiKey({ method: 'POST', body: formData }));
    if (!res.ok) throw new Error(await readError(res, 'Upload failed'));
    const { content } = await res.json();
    clearConfigCache();
    return content;
}

// ── Generation (SSE) ────────────────────────────────────────

export interface SSECallbacks {
    onProgress: (message: string) => void;
    onComplete: (result: GenerationResult) => void;
    onError: (message: string) => void;
}

async function consumeGenerationStream(response: Response, callbacks: SSECallbacks): Promise<void> {
    if (!response.ok) {
        throw new Error(await readError(response, `Server error: ${response.status}`));
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
            if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.slice(6));
                    if (eventType === 'progress') callbacks.onProgress(data.message);
                    else if (eventType === 'complete') callbacks.onComplete(data.result);
                    else if (eventType === 'error') callbacks.onError(data.message);
                } catch {
                    // malformed SSE — skip
                }
            }
        }
    }
}

export async function generateResume(
    jobDescription: string,
    companyName: string | undefined,
    callbacks: SSECallbacks,
    signal?: AbortSignal,
): Promise<void> {
    const response = await fetch('/api/generate', withApiKey({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, companyName }),
        signal,
    }));
    await consumeGenerationStream(response, callbacks);
}

/**
 * Generate a broad, recruiter-facing summary resume — no job description.
 * The server picks a realistic role cluster from the master resume and
 * compiles a one-page resume that works well as a LinkedIn default. No
 * external services are called.
 */
export async function generateSummaryResume(
    callbacks: SSECallbacks,
    signal?: AbortSignal,
): Promise<void> {
    const response = await fetch('/api/generate/summary', withApiKey({
        method: 'POST',
        signal,
    }));
    await consumeGenerationStream(response, callbacks);
}

// ── Dashboard ───────────────────────────────────────────────

export async function fetchDashboardStats(): Promise<DashboardStats> {
    const res = await fetch('/api/dashboard/stats');
    if (!res.ok) throw new Error('Failed to load dashboard stats');
    return res.json();
}

// ── Job Titles ──────────────────────────────────────────────

export async function fetchJobTitles(): Promise<JobTitleResult> {
    const res = await fetch('/api/job-titles');
    if (!res.ok) throw new Error('Failed to load job titles');
    return res.json();
}

export async function regenerateJobTitles(): Promise<JobTitleResult> {
    const res = await fetch('/api/job-titles/generate', withApiKey({ method: 'POST' }));
    if (!res.ok) throw new Error(await readError(res, 'Failed to generate job titles'));
    return res.json();
}

// ── Summary Resume pointer ──────────────────────────────────

export async function fetchSummaryResume(): Promise<HistoryEntry | null> {
    const res = await fetch('/api/summary-resume');
    if (!res.ok) return null;
    const data = await res.json();
    return data.entry || null;
}
