/**
 * server/llmCalls.ts — Domain-specific LLM call wrappers.
 *
 * Each function loads a Markdown prompt, builds the user message, and calls
 * the provider-agnostic layer in server/llm.ts. The provider + key are
 * supplied per request by the client (BYOK).
 */

import fs from 'fs';
import path from 'path';
import { MASTER_RESUME_PATH, PROMPTS_DIR } from './config.js';
import { loadPreferences } from './userConfig.js';
import { generateJson, generateText } from './llm.js';
import type {
    ContentSelectionResult,
    OutreachResult,
    JobTitleResult,
    UserPreferences,
    LlmCredentials,
} from '../shared/types.js';

export type { ContentSelectionResult };

const promptCache = new Map<string, string>();

function loadPrompt(filename: string): string {
    if (!promptCache.has(filename)) {
        promptCache.set(filename, fs.readFileSync(path.join(PROMPTS_DIR, filename), 'utf8'));
    }
    return promptCache.get(filename)!;
}

// ── Project scoring (Phase 1) ───────────────────────────────

interface ProjectScore {
    name: string;
    score: number;
    reasoning: string;
}

async function scoreProjects(
    creds: LlmCredentials,
    jobDescription: string,
    masterResume: string,
): Promise<ProjectScore[]> {
    const projectsYaml = extractProjectsYaml(masterResume);
    if (!projectsYaml.trim() || projectsYaml.trim() === 'projects:') return [];

    const userPrompt = `## Job Description
${jobDescription}

## Projects to Score
\`\`\`yaml
${projectsYaml}
\`\`\``;

    try {
        const text = await generateJson(creds, {
            systemPrompt: loadPrompt('project-scorer.md'),
            userPrompt,
            task: 'fast',
            temperature: 0.2,
        });
        const parsed = JSON.parse(text);
        return parsed.scores || [];
    } catch {
        return [];
    }
}

function extractProjectsYaml(masterResume: string): string {
    const lines = masterResume.split('\n');
    const out: string[] = [];
    let inProjects = false;

    for (const line of lines) {
        if (/^projects:\s*$/.test(line)) {
            inProjects = true;
            out.push(line);
            continue;
        }
        if (inProjects) {
            if (/^[a-zA-Z_][a-zA-Z0-9_]*:\s*$/.test(line)) break;
            out.push(line);
        }
    }
    return out.join('\n');
}

function selectTopProjects(
    scores: ProjectScore[],
    masterResume: string,
    maxCount = 3,
): string[] {
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const selected: string[] = [];
    const selectedTechSets: Set<string>[] = [];

    for (const project of sorted) {
        if (selected.length >= maxCount) break;

        const tech = extractProjectTech(masterResume, project.name);
        const techSet = new Set(
            tech.toLowerCase().split(/[,\s]+/).filter((t) => t.length > 1),
        );

        const tooSimilar = selectedTechSets.some((existing) => {
            if (techSet.size === 0 || existing.size === 0) return false;
            const overlap = [...techSet].filter((t) => existing.has(t)).length;
            const minSize = Math.min(techSet.size, existing.size);
            return overlap / minSize > 0.7;
        });

        if (!tooSimilar) {
            selected.push(project.name);
            selectedTechSets.push(techSet);
        }
    }
    return selected;
}

function extractProjectTech(masterResume: string, projectName: string): string {
    const escaped = projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`-\\s*name:\\s*"${escaped}"[\\s\\S]*?tech:\\s*"([^"]*)"`);
    const match = masterResume.match(re);
    return match ? match[1] : '';
}

function filterMasterResumeProjects(masterResume: string, selectedNames: string[]): string {
    if (selectedNames.length === 0) return masterResume;

    const lines = masterResume.split('\n');
    const out: string[] = [];
    let inProjects = false;
    let inProject = false;
    let currentIncluded = false;

    for (const line of lines) {
        if (/^projects:\s*$/.test(line)) {
            inProjects = true;
            inProject = false;
            out.push(line);
            continue;
        }
        if (inProjects && /^[a-zA-Z_][a-zA-Z0-9_]*:\s*$/.test(line)) {
            inProjects = false;
            inProject = false;
            out.push(line);
            continue;
        }
        if (inProjects) {
            const nameMatch = line.match(/^\s*-\s*name:\s*"(.+)"/);
            if (nameMatch) {
                const projectName = nameMatch[1];
                currentIncluded = selectedNames.some(
                    (selected) =>
                        projectName === selected ||
                        projectName.includes(selected) ||
                        selected.includes(projectName),
                );
                inProject = true;
                if (currentIncluded) out.push(line);
                continue;
            }
            if (inProject) {
                if (currentIncluded) out.push(line);
                continue;
            }
            out.push(line);
        } else {
            out.push(line);
        }
    }
    return out.join('\n');
}

function preferencesToPromptBlock(prefs: UserPreferences): string {
    const lines: string[] = [];
    lines.push(`tone: "${prefs.tone}"`);
    lines.push(`targetPageLength: ${prefs.targetPageLength}`);
    if (prefs.pinnedExperience.length > 0) {
        lines.push('pinnedExperience:');
        for (const p of prefs.pinnedExperience) {
            lines.push(`  - company: "${p.company}"`);
            if (p.note) lines.push(`    note: "${p.note.replace(/"/g, '\\"')}"`);
        }
    } else {
        lines.push('pinnedExperience: []');
    }
    if (prefs.additionalGuidance?.trim()) {
        lines.push(`additionalGuidance: |`);
        for (const ln of prefs.additionalGuidance.split('\n')) lines.push(`  ${ln}`);
    }
    return lines.join('\n');
}

// ── Phase 2: tailored resume generation ─────────────────────

export async function selectContent(
    creds: LlmCredentials,
    jobDescription: string,
): Promise<ContentSelectionResult> {
    const masterResume = fs.readFileSync(MASTER_RESUME_PATH, 'utf8');
    const preferences = loadPreferences();

    const projectScores = await scoreProjects(creds, jobDescription, masterResume);
    let resumeForPrompt = masterResume;
    if (projectScores.length > 0) {
        const selectedNames = selectTopProjects(projectScores, masterResume);
        if (selectedNames.length > 0) {
            resumeForPrompt = filterMasterResumeProjects(masterResume, selectedNames);
        }
    }

    const systemPrompt = `${loadPrompt('content-selector.md')}

---

## Candidate Master Resume (YAML)

The \`projects:\` section below has been pre-filtered to the most JD-relevant entries — use all of them.

\`\`\`yaml
${resumeForPrompt}
\`\`\`

---

## Candidate Preferences

\`\`\`yaml
${preferencesToPromptBlock(preferences)}
\`\`\`

---

## Output Rules
- Output ONLY valid JSON — no markdown fences, no commentary, no preamble.
- The JSON must match the schema in the system prompt above exactly.
- Extract \`company\` and \`role\` from the JD. If unclear, use "Company" and "Role" respectively.
- Aim to fill the page densely — slight overflow is auto-trimmed by a deterministic post-pass.`;

    const userPrompt = `Analyze this job description and generate a tailored resume.

## Job Description
${jobDescription}`;

    const text = await generateJson(creds, {
        systemPrompt,
        userPrompt,
        task: 'smart',
        temperature: 0.3,
    });

    const result: ContentSelectionResult = JSON.parse(text);
    if (!result.fit_assessment || !result.resume_data) {
        throw new Error('Invalid response structure from LLM — missing fit_assessment or resume_data');
    }
    return result;
}

// ── Resume parser ───────────────────────────────────────────

export async function convertMasterResume(
    creds: LlmCredentials,
    text: string,
): Promise<string> {
    const yamlStr = await generateText(creds, {
        systemPrompt: loadPrompt('resume-parser.md'),
        userPrompt: text,
        task: 'fast',
        temperature: 0.1,
    });
    return yamlStr.trim();
}

// ── Outreach ────────────────────────────────────────────────

export async function generateOutreach(
    creds: LlmCredentials,
    company: string,
    role: string,
): Promise<OutreachResult> {
    const masterResume = fs.existsSync(MASTER_RESUME_PATH)
        ? fs.readFileSync(MASTER_RESUME_PATH, 'utf8')
        : '';

    if (!masterResume.trim()) {
        throw new Error('No master resume found. Upload one to personalize outreach.');
    }

    const systemPrompt = `${loadPrompt('outreach.md')}

---

## Candidate Master Resume

\`\`\`yaml
${masterResume}
\`\`\``;

    const userPrompt = `Target Company: ${company}
Target Role: ${role}`;

    const text = await generateJson(creds, {
        systemPrompt,
        userPrompt,
        task: 'fast',
        temperature: 0.5,
    });
    return JSON.parse(text) as OutreachResult;
}

// ── Job titles ──────────────────────────────────────────────

export async function generateJobTitles(creds: LlmCredentials): Promise<JobTitleResult> {
    if (!fs.existsSync(MASTER_RESUME_PATH)) {
        throw new Error('No master resume found. Upload one first.');
    }
    const masterResume = fs.readFileSync(MASTER_RESUME_PATH, 'utf8');

    const userPrompt = `Master Resume:
\`\`\`yaml
${masterResume}
\`\`\``;

    const text = await generateJson(creds, {
        systemPrompt: loadPrompt('job-titles.md'),
        userPrompt,
        task: 'fast',
        temperature: 0.4,
    });
    const parsed = JSON.parse(text);
    return {
        titles: parsed.titles || [],
        generatedAt: new Date().toISOString(),
    };
}
