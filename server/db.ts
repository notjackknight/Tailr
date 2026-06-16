/**
 * server/db.ts — SQLite database layer (better-sqlite3).
 *
 * Manages the `generations` table: insert, query, and delete.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import type { GenerationRecord, GenerationKind } from '../shared/types.js';

// Re-export for backward compat
export type { GenerationRecord } from '../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'tailr.db');

let db: Database.Database;

export function getDb(): Database.Database {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.exec(`
      CREATE TABLE IF NOT EXISTS generations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT,
        role TEXT,
        score INTEGER,
        reasoning TEXT,
        stretch_areas TEXT,
        ats_keywords TEXT,
        job_description TEXT,
        resume_data_json TEXT,
        pdf_filename TEXT,
        fill_status TEXT,
        iterations INTEGER DEFAULT 1,
        kind TEXT NOT NULL DEFAULT 'tailored',
        outreach_dm TEXT DEFAULT '',
        chosen_tone TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
        // Migrations for databases created before later columns existed.
        const cols = db.prepare(`PRAGMA table_info(generations)`).all() as Array<{ name: string }>;
        if (!cols.some((c) => c.name === 'kind')) {
            db.exec(`ALTER TABLE generations ADD COLUMN kind TEXT NOT NULL DEFAULT 'tailored'`);
        }
        if (!cols.some((c) => c.name === 'outreach_dm')) {
            db.exec(`ALTER TABLE generations ADD COLUMN outreach_dm TEXT DEFAULT ''`);
        }
        if (!cols.some((c) => c.name === 'chosen_tone')) {
            db.exec(`ALTER TABLE generations ADD COLUMN chosen_tone TEXT DEFAULT ''`);
        }
    }
    return db;
}

export function insertGeneration(data: {
    company: string;
    role: string;
    score: number;
    reasoning: string;
    stretchAreas: string[];
    atsKeywords: string[];
    jobDescription: string;
    resumeDataJson: string;
    pdfFilename: string;
    fillStatus: string;
    iterations: number;
    kind?: GenerationKind;
    outreachDm?: string;
    chosenTone?: string;
}): number {
    const db = getDb();
    const stmt = db.prepare(`
    INSERT INTO generations (company, role, score, reasoning, stretch_areas, ats_keywords, job_description, resume_data_json, pdf_filename, fill_status, iterations, kind, outreach_dm, chosen_tone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const result = stmt.run(
        data.company,
        data.role,
        data.score,
        data.reasoning,
        JSON.stringify(data.stretchAreas),
        JSON.stringify(data.atsKeywords),
        data.jobDescription,
        data.resumeDataJson,
        data.pdfFilename,
        data.fillStatus,
        data.iterations,
        data.kind ?? 'tailored',
        data.outreachDm ?? '',
        data.chosenTone ?? '',
    );
    return result.lastInsertRowid as number;
}

export function getHistory(limit = 50): GenerationRecord[] {
    const db = getDb();
    return db.prepare('SELECT * FROM generations ORDER BY created_at DESC LIMIT ?').all(limit) as GenerationRecord[];
}

export function getGeneration(id: number): GenerationRecord | undefined {
    const db = getDb();
    return db.prepare('SELECT * FROM generations WHERE id = ?').get(id) as GenerationRecord | undefined;
}

export function deleteGeneration(id: number): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM generations WHERE id = ?').run(id);
    return result.changes > 0;
}

export function getDashboardStats(): import('../shared/types.js').DashboardStats {
    const db = getDb();

    const totalRow = db.prepare('SELECT COUNT(*) as count FROM generations').get() as any;
    const avgRow = db.prepare('SELECT AVG(score) as avg FROM generations').get() as any;
    const topRow = db.prepare(
        'SELECT company, COUNT(*) as cnt FROM generations GROUP BY company ORDER BY cnt DESC LIMIT 1'
    ).get() as any;

    const trendRows = db.prepare(
        'SELECT score, created_at as date FROM generations ORDER BY created_at DESC LIMIT 20'
    ).all() as Array<{ score: number; date: string }>;

    // Categorize roles into broad buckets instead of exact titles
    const allRoles = db.prepare(
        'SELECT role FROM generations'
    ).all() as Array<{ role: string }>;

    const categoryMap: Record<string, string[]> = {
        'Engineering': ['engineer', 'developer', 'programmer', 'swe', 'software', 'frontend', 'backend', 'fullstack', 'full-stack', 'devops', 'sre', 'platform'],
        'Data & Analytics': ['data', 'analytics', 'analyst', 'scientist', 'machine learning', 'ml', 'bi ', 'business intelligence'],
        'AI & Automation': ['ai ', 'artificial intelligence', 'automation', 'nlp', 'deep learning', 'genai'],
        'Product & Design': ['product', 'design', 'ux', 'ui ', 'researcher'],
        'Leadership': ['director', 'vp', 'head of', 'chief', 'cto', 'cio', 'principal', 'staff', 'lead', 'manager', 'management'],
        'Operations': ['operations', 'systems', 'integration', 'infrastructure', 'cloud', 'security', 'network'],
        'Business': ['business', 'consultant', 'strategy', 'project', 'program', 'scrum', 'agile'],
    };

    const categoryCounts: Record<string, number> = {};
    for (const { role } of allRoles) {
        const lower = role.toLowerCase();
        let matched = false;
        for (const [category, keywords] of Object.entries(categoryMap)) {
            if (keywords.some((kw) => lower.includes(kw))) {
                categoryCounts[category] = (categoryCounts[category] || 0) + 1;
                matched = true;
                break;
            }
        }
        if (!matched) {
            categoryCounts['Other'] = (categoryCounts['Other'] || 0) + 1;
        }
    }

    const roleDistribution = Object.entries(categoryCounts)
        .map(([role, count]) => ({ role, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

    return {
        totalGenerations: totalRow?.count || 0,
        averageScore: Math.round((avgRow?.avg || 0) * 10) / 10,
        topCompany: topRow?.company || '—',
        scoreTrend: trendRows.reverse(),
        roleDistribution,
    };
}
