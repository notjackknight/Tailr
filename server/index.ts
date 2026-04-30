/**
 * server/index.ts — Express API server.
 *
 * BYOK + multi-provider: each LLM-touching request carries:
 *   X-LLM-Provider: gemini | anthropic | openai
 *   X-Api-Key:      <the corresponding API key>
 *
 * The server never persists the key.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import multer from 'multer';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { runPipeline } from './pipeline.js';
import { getHistory, getGeneration, deleteGeneration, getDashboardStats } from './db.js';
import { getOutputDir } from './renderer.js';
import { convertMasterResume, generateOutreach, generateJobTitles } from './llmCalls.js';
import { isValidProvider } from './llm.js';
import { closeBrowser } from './browser.js';
import {
    MASTER_RESUME_PATH,
    UPLOAD_DIR,
    ENV_PATH,
    PORT,
    JOB_TITLES_PATH,
    DATA_DIR,
} from './config.js';
import {
    loadProfile,
    saveProfile,
    loadPreferences,
    savePreferences,
    isProfileConfigured,
} from './userConfig.js';
import type {
    UserProfile,
    UserPreferences,
    AppConfig,
    LlmCredentials,
} from '../shared/types.js';

dotenv.config({ path: ENV_PATH });

const upload = multer({
    dest: UPLOAD_DIR,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.text({ limit: '1mb' }));

function ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Pull the LLM provider + key from request headers. Returns null if either
 * is missing or the provider is invalid. Routes that need creds validate
 * themselves and return a clean 400.
 */
function getCredentials(req: express.Request): LlmCredentials | null {
    const providerRaw = req.headers['x-llm-provider'];
    const keyRaw = req.headers['x-api-key'];
    if (typeof providerRaw !== 'string' || typeof keyRaw !== 'string') return null;
    const provider = providerRaw.trim().toLowerCase();
    const apiKey = keyRaw.trim();
    if (!apiKey || !isValidProvider(provider)) return null;
    return { provider, apiKey };
}

const MISSING_CREDS_RESPONSE = {
    error: 'Missing LLM credentials. Choose a provider and add your API key in Settings → API Key.',
};

// ── Config ──────────────────────────────────────────────────

app.get('/api/config', (_req, res) => {
    const profile = loadProfile();
    const preferences = loadPreferences();
    const payload: AppConfig = {
        profile,
        preferences,
        profileConfigured: isProfileConfigured(profile),
        masterResumePresent: fs.existsSync(MASTER_RESUME_PATH),
        // Server can't see localStorage; client overrides this before rendering.
        apiKeyConfigured: false,
    };
    res.json(payload);
});

// ── Profile ─────────────────────────────────────────────────

app.get('/api/profile', (_req, res) => {
    res.json(loadProfile());
});

app.put('/api/profile', (req, res) => {
    const body = req.body as Partial<UserProfile>;
    if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Invalid profile payload' });
        return;
    }
    const profile: UserProfile = {
        name: typeof body.name === 'string' ? body.name : '',
        location: typeof body.location === 'string' ? body.location : '',
        phone: typeof body.phone === 'string' ? body.phone : '',
        email: typeof body.email === 'string' ? body.email : '',
        links: Array.isArray(body.links)
            ? body.links
                .filter((l) => l && typeof l.label === 'string' && typeof l.value === 'string')
                .map((l) => ({ label: l.label, value: l.value }))
            : [],
    };
    try {
        saveProfile(profile);
        res.json({ success: true, profile });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to save profile' });
    }
});

// ── Preferences ─────────────────────────────────────────────

app.get('/api/preferences', (_req, res) => {
    res.json(loadPreferences());
});

app.put('/api/preferences', (req, res) => {
    const body = req.body as Partial<UserPreferences>;
    if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Invalid preferences payload' });
        return;
    }
    const allowedTones: UserPreferences['tone'][] =
        ['professional', 'concise', 'impact-driven', 'technical', 'leadership'];
    const tone = allowedTones.includes(body.tone as UserPreferences['tone'])
        ? (body.tone as UserPreferences['tone'])
        : 'professional';
    const prefs: UserPreferences = {
        tone,
        targetPageLength: 1,
        pinnedExperience: Array.isArray(body.pinnedExperience)
            ? body.pinnedExperience
                .filter((p) => p && typeof p.company === 'string' && p.company.trim())
                .map((p) => ({
                    company: p.company.trim(),
                    note: typeof p.note === 'string' ? p.note : undefined,
                }))
            : [],
        additionalGuidance: typeof body.additionalGuidance === 'string' ? body.additionalGuidance : '',
    };
    try {
        savePreferences(prefs);
        res.json({ success: true, preferences: prefs });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to save preferences' });
    }
});

// ── Master Resume ───────────────────────────────────────────

app.get('/api/master', (_req, res) => {
    try {
        if (!fs.existsSync(MASTER_RESUME_PATH)) {
            res.json({ content: '' });
            return;
        }
        res.json({ content: fs.readFileSync(MASTER_RESUME_PATH, 'utf8') });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to read master resume' });
    }
});

app.put('/api/master', (req, res) => {
    const { content } = req.body || {};
    if (typeof content !== 'string') {
        res.status(400).json({ error: 'Content must be a string' });
        return;
    }
    if (!content.trim()) {
        res.status(400).json({ error: 'Master resume cannot be empty' });
        return;
    }
    try {
        ensureDataDir();
        fs.writeFileSync(MASTER_RESUME_PATH, content, 'utf8');
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to save master resume' });
    }
});

app.post('/api/master/upload', upload.single('resume'), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }

    const filePath = req.file.path;
    const name = req.file.originalname.toLowerCase();
    let text = '';

    try {
        if (name.endsWith('.docx')) {
            const result = await mammoth.extractRawText({ path: filePath });
            text = result.value;
        } else if (name.endsWith('.pdf')) {
            const buf = new Uint8Array(fs.readFileSync(filePath));
            const parser = new PDFParse(buf);
            text = (await parser.getText()).text;
        } else if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.yaml') || name.endsWith('.yml')) {
            text = fs.readFileSync(filePath, 'utf8');
        } else {
            res.status(400).json({ error: 'Unsupported file type. Upload .docx, .pdf, .txt, .md, or .yaml.' });
            return;
        }

        if (!text.trim()) {
            res.status(400).json({ error: 'Could not extract text from file. Try pasting the content directly.' });
            return;
        }

        const isYaml = name.endsWith('.yaml') || name.endsWith('.yml');
        let yamlContent: string;
        if (isYaml) {
            yamlContent = text;
        } else {
            const creds = getCredentials(req);
            if (!creds) {
                res.status(400).json(MISSING_CREDS_RESPONSE);
                return;
            }
            yamlContent = await convertMasterResume(creds, text);
        }

        ensureDataDir();
        fs.writeFileSync(MASTER_RESUME_PATH, yamlContent, 'utf8');
        res.json({ success: true, content: yamlContent });
    } catch (err: any) {
        console.error('Upload processing error:', err?.message || err);
        res.status(500).json({ error: err?.message || 'Failed to process uploaded resume' });
    } finally {
        try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch { /* noop */ }
    }
});

// ── Generate (SSE) ──────────────────────────────────────────

app.post('/api/generate', async (req, res) => {
    const { jobDescription, companyName } = req.body || {};

    if (!jobDescription || typeof jobDescription !== 'string' || jobDescription.trim().length < 50) {
        res.status(400).json({ error: 'Job description is required (minimum 50 characters)' });
        return;
    }
    const creds = getCredentials(req);
    if (!creds) {
        res.status(400).json(MISSING_CREDS_RESPONSE);
        return;
    }
    if (!fs.existsSync(MASTER_RESUME_PATH)) {
        res.status(400).json({
            error: 'No master resume found. Upload one from the Dashboard before generating.',
        });
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    try {
        const pipeline = runPipeline(creds, jobDescription.trim(), companyName?.trim());
        for await (const event of pipeline) {
            if ('type' in event) {
                res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
            } else {
                res.write(`event: progress\ndata: ${JSON.stringify(event)}\n\n`);
            }
        }
    } catch (err: any) {
        res.write(`event: error\ndata: ${JSON.stringify({
            type: 'error',
            message: err?.message || 'Generation failed',
        })}\n\n`);
    }
    res.end();
});

// ── History ─────────────────────────────────────────────────

app.get('/api/history', (_req, res) => {
    try {
        res.json(getHistory());
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to load history' });
    }
});

app.get('/api/generation/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const record = getGeneration(id);
    if (!record) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(record);
});

app.delete('/api/history/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    try {
        const record = getGeneration(id);
        if (record?.pdf_filename) {
            const pdfPath = path.join(getOutputDir(), record.pdf_filename);
            if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
            const docxPath = pdfPath.replace(/\.pdf$/, '.docx');
            if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
        }
        const deleted = deleteGeneration(id);
        res.json({ deleted });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to delete generation' });
    }
});

// ── Resume file serving (path-traversal-protected) ──────────

app.get('/api/resume/:filename', (req, res) => {
    const { filename } = req.params;
    const outputDir = getOutputDir();
    const resolvedPath = path.resolve(outputDir, filename);
    if (!resolvedPath.startsWith(path.resolve(outputDir))) {
        res.status(400).json({ error: 'Invalid filename' });
        return;
    }
    if (!fs.existsSync(resolvedPath)) {
        res.status(404).json({ error: 'File not found' });
        return;
    }
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.pdf') res.setHeader('Content-Type', 'application/pdf');
    else if (ext === '.docx') res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(resolvedPath);
});

// ── Dashboard ───────────────────────────────────────────────

app.get('/api/dashboard/stats', (_req, res) => {
    try {
        res.json(getDashboardStats());
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to load dashboard stats' });
    }
});

// ── Outreach ────────────────────────────────────────────────

app.post('/api/outreach', async (req, res) => {
    const { company, role } = req.body || {};
    if (!company || !role || typeof company !== 'string' || typeof role !== 'string') {
        res.status(400).json({ error: 'Company and role are required' });
        return;
    }
    const creds = getCredentials(req);
    if (!creds) {
        res.status(400).json(MISSING_CREDS_RESPONSE);
        return;
    }
    try {
        res.json(await generateOutreach(creds, company.trim(), role.trim()));
    } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Failed to generate outreach' });
    }
});

// ── Job titles ──────────────────────────────────────────────

app.get('/api/job-titles', (_req, res) => {
    try {
        if (!fs.existsSync(JOB_TITLES_PATH)) {
            res.json({ titles: [], generatedAt: '' });
            return;
        }
        res.json(JSON.parse(fs.readFileSync(JOB_TITLES_PATH, 'utf8')));
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to load job titles' });
    }
});

app.post('/api/job-titles/generate', async (req, res) => {
    const creds = getCredentials(req);
    if (!creds) {
        res.status(400).json(MISSING_CREDS_RESPONSE);
        return;
    }
    try {
        const result = await generateJobTitles(creds);
        ensureDataDir();
        fs.writeFileSync(JOB_TITLES_PATH, JSON.stringify(result, null, 2), 'utf8');
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Failed to generate job titles' });
    }
});

// ── Start server ────────────────────────────────────────────

const server = app.listen(PORT, () => {
    console.log(`\n  Tailr API server running on http://localhost:${PORT}`);
    console.log('  BYOK: provider + key arrive on each request via X-LLM-Provider + X-Api-Key.\n');
});

process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await closeBrowser();
    server.close();
});
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await closeBrowser();
    server.close();
    process.exit(0);
});
