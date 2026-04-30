/**
 * server/config.ts — file paths and PDF rendering constants.
 *
 * User-specific data (contact info, tailoring preferences) lives in
 * data/profile.json and data/preferences.json and is loaded at runtime
 * via server/userConfig.ts — not hardcoded here.
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ── File Paths ──────────────────────────────────────────────
export const DATA_DIR = path.join(PROJECT_ROOT, 'data');
export const MASTER_RESUME_PATH = path.join(DATA_DIR, 'master_resume.yaml');
export const PROFILE_PATH = path.join(DATA_DIR, 'profile.json');
export const PREFERENCES_PATH = path.join(DATA_DIR, 'preferences.json');
export const JOB_TITLES_PATH = path.join(DATA_DIR, 'job_titles.json');

export const TEMPLATE_PATH = path.join(PROJECT_ROOT, 'templates', 'resume.html');
export const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output');
export const UPLOAD_DIR = path.join(PROJECT_ROOT, 'uploads');
export const PROMPTS_DIR = path.join(PROJECT_ROOT, 'prompts');
export const ENV_PATH = path.join(PROJECT_ROOT, '.env');

// ── PDF Rendering Constants ─────────────────────────────────
export const PAGE_HEIGHT_IN = 11;
export const VERTICAL_PADDING_IN = 0.6; // 0.3in top + 0.3in bottom
export const AVAILABLE_HEIGHT_IN = PAGE_HEIGHT_IN - VERTICAL_PADDING_IN;
export const LINE_HEIGHT_PT = 12.65; // 11pt × 1.15 line-height
export const LINE_HEIGHT_IN = LINE_HEIGHT_PT / 72;
export const DPI = 96;

// ── Server ──────────────────────────────────────────────────
export const PORT = process.env.PORT || 3001;
