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
    JobTitleResult,
    UserPreferences,
    LlmCredentials,
    ResumeData,
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

// ── Phase 2 (alt): LinkedIn-default resume generation ───────
//
// Same output schema as selectContent() so the renderer + DB layer
// can be reused unchanged. The differences are:
//   • no job description — the prompt picks a realistic role cluster
//     from the candidate's background.
//   • project pre-scoring is skipped (we don't have a JD to score against);
//     the prompt is told to pick the 2–3 most broadly relevant projects
//     from the master resume directly.

export async function selectContentLinkedInDefault(
    creds: LlmCredentials,
): Promise<ContentSelectionResult> {
    const masterResume = fs.readFileSync(MASTER_RESUME_PATH, 'utf8');
    const preferences = loadPreferences();

    const systemPrompt = `${loadPrompt('linkedin-default.md')}

---

## Candidate Master Resume (YAML)

Pick the 2–3 most broadly relevant projects from the \`projects:\` section yourself — there is no job description to score against.

\`\`\`yaml
${masterResume}
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
- Set \`fit_assessment.company\` to the literal string "LinkedIn Default".
- Set \`fit_assessment.role\` to the primary title of the cluster you chose.
- Aim to fill the page densely — slight overflow is auto-trimmed by a deterministic post-pass.`;

    const userPrompt = `Generate a broad, recruiter-facing default resume for this candidate. There is no specific job description — infer a realistic role cluster from the resume and tailor to that cluster.`;

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
    // Force the company sentinel even if the model drifts — the vault uses
    // it to distinguish LinkedIn-default entries from JD-tailored ones.
    result.fit_assessment.company = 'LinkedIn Default';
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

// ── Cold DM ─────────────────────────────────────────────────
//
// A short, human LinkedIn cold message generated per tailored resume. The
// model picks one real, relevant skill/project from the ALREADY-tailored
// resume data so the hook lines up with the resume the recruiter just got.

/** Compact, token-light view of the tailored resume for the DM prompt. */
function summarizeResumeForDm(resume: ResumeData): string {
    const skills = (resume.skills || [])
        .map((s) => `${s.category}: ${s.items}`)
        .join('\n');
    const projects = (resume.projects || [])
        .map((p) => `- ${p.name}${p.tech ? ` (${p.tech})` : ''}`)
        .join('\n');
    const experience = (resume.experience || [])
        .map((e) => `- ${e.title} @ ${e.company}`)
        .join('\n');

    return [
        resume.profile ? `Summary: ${resume.profile}` : '',
        skills ? `Skills:\n${skills}` : '',
        projects ? `Projects:\n${projects}` : '',
        experience ? `Experience:\n${experience}` : '',
    ]
        .filter(Boolean)
        .join('\n\n');
}

export async function generateColdDm(
    creds: LlmCredentials,
    company: string,
    role: string,
    resume: ResumeData,
): Promise<string> {
    const userPrompt = `Target Role: ${role}
Target Company: ${company}

## Candidate's tailored resume (pick one real, relevant hook from here)
${summarizeResumeForDm(resume)}`;

    const text = await generateJson(creds, {
        systemPrompt: loadPrompt('cold-dm.md'),
        userPrompt,
        task: 'fast',
        temperature: 0.7,
    });

    try {
        const parsed = JSON.parse(text);
        const dm = typeof parsed?.dm === 'string' ? parsed.dm.trim() : '';
        // Defensive: strip any stray em dashes the model slips in.
        return dm.replace(/\s*—\s*/g, ', ');
    } catch {
        return '';
    }
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
    const validTiers = new Set(['realistic', 'low_hanging_fruit', 'reach', 'long_term_fit']);
    const titles = (Array.isArray(parsed.titles) ? parsed.titles : [])
        .filter((t: any) => t && typeof t.title === 'string' && t.title.trim())
        .map((t: any) => ({
            title: t.title.trim(),
            // Default unknown/missing tiers to "realistic" so old cached payloads
            // and lenient model outputs still render sensibly.
            tier: validTiers.has(t.tier) ? t.tier : 'realistic',
            reasoning: typeof t.reasoning === 'string' ? t.reasoning : '',
        }));
    return {
        titles,
        generatedAt: new Date().toISOString(),
    };
}
