/**
 * server/userConfig.ts — Loads and persists per-user configuration.
 *
 * Two files live in data/:
 *   - profile.json:     contact info shown on the resume (name, email, links)
 *   - preferences.json: tailoring preferences (tone, page length, pinned sections)
 *
 * Both are read on demand (no caching) so edits via the Settings UI take effect
 * without a server restart. Both auto-fill with sensible defaults if missing.
 */

import fs from 'fs';
import { PROFILE_PATH, PREFERENCES_PATH, DATA_DIR } from './config.js';
import type { UserProfile, UserPreferences } from '../shared/types.js';

const DEFAULT_PROFILE: UserProfile = {
    name: '',
    location: '',
    phone: '',
    email: '',
    links: [],
};

const DEFAULT_PREFERENCES: UserPreferences = {
    tone: 'professional',
    targetPageLength: 1,
    pinnedExperience: [],
    additionalGuidance: '',
};

function ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

export function loadProfile(): UserProfile {
    if (!fs.existsSync(PROFILE_PATH)) return { ...DEFAULT_PROFILE };
    try {
        const raw = JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8'));
        return { ...DEFAULT_PROFILE, ...raw };
    } catch {
        return { ...DEFAULT_PROFILE };
    }
}

export function saveProfile(profile: UserProfile): void {
    ensureDataDir();
    fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2), 'utf8');
}

export function loadPreferences(): UserPreferences {
    if (!fs.existsSync(PREFERENCES_PATH)) return { ...DEFAULT_PREFERENCES };
    try {
        const raw = JSON.parse(fs.readFileSync(PREFERENCES_PATH, 'utf8'));
        return { ...DEFAULT_PREFERENCES, ...raw };
    } catch {
        return { ...DEFAULT_PREFERENCES };
    }
}

export function savePreferences(prefs: UserPreferences): void {
    ensureDataDir();
    fs.writeFileSync(PREFERENCES_PATH, JSON.stringify(prefs, null, 2), 'utf8');
}

export function isProfileConfigured(profile: UserProfile = loadProfile()): boolean {
    return Boolean(profile.name?.trim() && profile.email?.trim());
}
