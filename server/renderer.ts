/**
 * server/renderer.ts — HTML population + Puppeteer PDF rendering.
 *
 * - Populate the Mustache HTML template with ResumeData + the user's profile
 * - Render to PDF via the shared Puppeteer browser singleton
 * - Measure utilization for the deterministic truncation loop
 * - Generate the parallel DOCX
 */

import Mustache from 'mustache';
import fs from 'fs';
import path from 'path';
import { getBrowser } from './browser.js';
import { generateDocx } from './docx.js';
import { loadProfile } from './userConfig.js';
import {
    TEMPLATE_PATH,
    OUTPUT_DIR,
    AVAILABLE_HEIGHT_IN,
    VERTICAL_PADDING_IN,
    LINE_HEIGHT_IN,
    DPI,
} from './config.js';
import type { ResumeData, RenderResult } from '../shared/types.js';

let templateHtmlCache: string | null = null;

function getTemplate(): string {
    if (!templateHtmlCache) {
        templateHtmlCache = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    }
    return templateHtmlCache;
}

export type { ResumeData, RenderResult } from '../shared/types.js';

/**
 * Build the contact line parts (location, phone, email, links) from the user's profile.
 * Empty fields are skipped so the contact line never has dangling separators.
 */
function buildContactParts(): Array<{ value: string; last: boolean }> {
    const profile = loadProfile();
    const parts: string[] = [];
    if (profile.location) parts.push(profile.location);
    if (profile.phone) parts.push(profile.phone);
    if (profile.email) parts.push(profile.email);
    for (const link of profile.links || []) {
        if (link.value?.trim()) parts.push(link.label ? `${link.label}: ${link.value}` : link.value);
    }
    return parts.map((value, i) => ({ value, last: i === parts.length - 1 }));
}

/**
 * Mustache requires `{{.}}` to render array items as strings, but we also need
 * a `last` flag for the separator logic in the template. We solve this by
 * giving each part a `toString` so `{{.}}` prints the value.
 */
function makeContactParts(): Array<{ toString: () => string; last: boolean }> {
    return buildContactParts().map((p) => ({
        toString: () => p.value,
        last: p.last,
    }));
}

export function populateTemplate(resumeData: ResumeData): string {
    const profile = loadProfile();

    const educationProcessed = (resumeData.education || []).map((edu) => ({
        ...edu,
        honorsLine: edu.honors?.length ? edu.honors.join(', ') : null,
    }));

    const context = {
        // contact info
        name: profile.name || 'Your Name',
        contactParts: makeContactParts(),

        // resume content
        profile: resumeData.profile,
        skills: resumeData.skills || [],
        experience: resumeData.experience || [],
        projects: resumeData.projects || [],
        education: educationProcessed,
        certifications: resumeData.certifications || [],
        awards: resumeData.awards || [],
        volunteer: (resumeData.volunteer || []).map((v) => ({
            ...v,
            bullets: v.bullets || [],
        })),

        // section visibility flags
        hasProfile: Boolean(resumeData.profile?.trim()),
        hasSkills: (resumeData.skills?.length || 0) > 0,
        hasExperience: (resumeData.experience?.length || 0) > 0,
        hasProjects: (resumeData.projects?.length || 0) > 0,
        hasEducation: (resumeData.education?.length || 0) > 0,
        hasCertifications: (resumeData.certifications?.length || 0) > 0,
        hasAwards: (resumeData.awards?.length || 0) > 0,
        hasVolunteer: (resumeData.volunteer?.length || 0) > 0,
    };

    return Mustache.render(getTemplate(), context);
}

export async function renderPdf(
    htmlContent: string,
    filename: string,
    resumeData: ResumeData,
): Promise<RenderResult> {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const pdfPath = path.join(OUTPUT_DIR, filename);
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        const contentMetrics = await page.evaluate(() => {
            const container = document.querySelector('.resume-container') as HTMLElement;
            if (!container) {
                let maxBottom = 0;
                for (const child of document.body.children) {
                    const rect = child.getBoundingClientRect();
                    if (rect.bottom > maxBottom) maxBottom = rect.bottom;
                }
                return { contentHeightPx: maxBottom };
            }

            container.style.height = 'auto';
            const height = container.getBoundingClientRect().height;
            container.style.height = '100%';
            return { contentHeightPx: height };
        });

        const contentHeightIn = contentMetrics.contentHeightPx / DPI;

        await page.pdf({
            path: pdfPath,
            format: 'Letter',
            margin: { top: '0', bottom: '0', left: '0', right: '0' },
            printBackground: true,
            preferCSSPageSize: true,
        });

        const pdfContent = fs.readFileSync(pdfPath);
        const pageCount = countPdfPages(pdfContent);

        const docxBuffer = await generateDocx(resumeData, contentMetrics.contentHeightPx);
        const docxPath = pdfPath.replace(/\.pdf$/, '.docx');
        fs.writeFileSync(docxPath, docxBuffer);

        const contentOnlyHeightIn = contentHeightIn - VERTICAL_PADDING_IN;
        const remainingSpaceIn = Math.max(0, AVAILABLE_HEIGHT_IN - contentOnlyHeightIn);
        const remainingLines = Math.floor(remainingSpaceIn / LINE_HEIGHT_IN);

        let fillStatus: 'perfect' | 'has_space' | 'overflow';
        if (pageCount > 1) fillStatus = 'overflow';
        else if (remainingLines <= 2) fillStatus = 'perfect';
        else fillStatus = 'has_space';

        return {
            success: pageCount === 1 && fillStatus !== 'overflow',
            pages: pageCount,
            pdfPath,
            docxPath,
            pdfBuffer: pdfContent,
            fileSizeKB: Math.round(pdfContent.length / 1024),
            contentHeightIn: Math.round(contentOnlyHeightIn * 100) / 100,
            availableHeightIn: AVAILABLE_HEIGHT_IN,
            remainingSpaceIn: Math.round(remainingSpaceIn * 100) / 100,
            remainingLines,
            fillStatus,
        };
    } finally {
        await page.close();
    }
}

function countPdfPages(buffer: Buffer): number {
    const text = buffer.toString('latin1');
    const matches = text.match(/\/Type\s*\/Page(?!s)/g);
    return matches ? matches.length : 0;
}

export function getOutputDir(): string {
    return OUTPUT_DIR;
}

/**
 * Strips lowest-priority items from the resume to force a 1-page fit.
 * Walks an explicit priority order; each call removes one item.
 */
export function performDeterministicTruncation(data: ResumeData): ResumeData {
    const out: ResumeData = JSON.parse(JSON.stringify(data));

    // 1. Drop the last bullet of the last project (keep ≥1 bullet)
    if (out.projects?.length) {
        for (let i = out.projects.length - 1; i >= 0; i--) {
            if ((out.projects[i].bullets?.length || 0) > 1) {
                out.projects[i].bullets.pop();
                return out;
            }
        }
    }

    // 2. Drop the last bullet of the last experience (keep ≥1 bullet)
    if (out.experience?.length) {
        for (let i = out.experience.length - 1; i >= 0; i--) {
            if ((out.experience[i].bullets?.length || 0) > 1) {
                out.experience[i].bullets.pop();
                return out;
            }
        }
    }

    // 3. Trim optional sections from the bottom up before touching core sections
    if (out.volunteer?.length) {
        out.volunteer.pop();
        return out;
    }
    if (out.awards?.length) {
        out.awards.pop();
        return out;
    }
    if (out.certifications?.length) {
        out.certifications.pop();
        return out;
    }

    // 4. Drop the entire last project
    if (out.projects?.length) {
        out.projects.pop();
        return out;
    }

    // 5. Drop the last skill category
    if (out.skills?.length) {
        out.skills.pop();
        return out;
    }

    // 6. Drop the oldest experience (keep ≥1)
    if ((out.experience?.length || 0) > 1) {
        out.experience.pop();
        return out;
    }

    return out;
}
