/**
 * server/docx.ts — Adaptive DOCX generation.
 *
 * Builds a Word document with dynamic spacing that adapts to content volume.
 * The Puppeteer-measured content height is preferred when available — that
 * keeps the DOCX layout in lockstep with the rendered PDF.
 */

import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    convertInchesToTwip,
} from 'docx';
import { loadProfile } from './userConfig.js';
import type { ResumeData } from '../shared/types.js';

// ── Style constants ─────────────────────────────────────────
const FONT = 'Times New Roman';
const BODY_SIZE = 22;            // 11pt in half-points
const NAME_SIZE = 40;            // 20pt in half-points
const SECTION_HEADING_SIZE = 22; // 11pt in half-points

const BASE_LINE_SPACING = 252;
const BASE_HEADING_BEFORE = 50;
const BASE_HEADING_AFTER = 25;

const PAGE_HEIGHT_TWIPS = 15840;
const MARGIN_TOP_TWIPS = 432;
const MARGIN_BOTTOM_TWIPS = 432;
const AVAILABLE_HEIGHT_TWIPS = PAGE_HEIGHT_TWIPS - MARGIN_TOP_TWIPS - MARGIN_BOTTOM_TWIPS;

const NO_BORDERS = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
} as const;

const ZERO_CELL_MARGIN = { top: 0, bottom: 0, left: 0, right: 0 };
const AVAILABLE_WIDTH_TWIPS = convertInchesToTwip(7.5);

// Word renders TNR 11pt slightly taller than Chrome — buffer for the gap.
const CHROME_TO_WORD_BUFFER = 0.05;
const PUPPETEER_DPI = 96;

interface SpacingConfig {
    lineSpacing: number;
    headingBefore: number;
    headingAfter: number;
}

function estimateLineCount(resumeData: ResumeData): { lineCount: number; sectionCount: number } {
    const WORDS_PER_LINE = 13;
    const textLines = (text: string) =>
        Math.max(1, Math.ceil(text.split(/\s+/).length / WORDS_PER_LINE));

    let lineCount = 1.5 + 1; // name + contact
    let sectionCount = 0;

    if (resumeData.profile) { sectionCount++; lineCount += textLines(resumeData.profile); }

    if (resumeData.skills?.length) {
        sectionCount++;
        for (const s of resumeData.skills) lineCount += textLines(`${s.category}: ${s.items}`);
    }

    if (resumeData.experience?.length) {
        sectionCount++;
        for (const job of resumeData.experience) {
            lineCount += 2;
            for (const b of job.bullets || []) {
                const words = (b.boldPrefix ? b.boldPrefix + ' ' : '').length + b.text.split(/\s+/).length;
                lineCount += Math.max(1, Math.ceil(words / 11));
            }
        }
    }

    if (resumeData.projects?.length) {
        sectionCount++;
        for (const p of resumeData.projects) {
            lineCount += textLines(p.name + (p.tech ? ` — (${p.tech})` : ''));
            for (const b of p.bullets || []) {
                lineCount += Math.max(1, Math.ceil(b.text.split(/\s+/).length / 11));
            }
        }
    }

    if (resumeData.education?.length) {
        sectionCount++;
        for (const e of resumeData.education) {
            lineCount += 2;
            if (e.honors?.length) lineCount += 1;
            if (e.coursework) lineCount += textLines(e.coursework);
        }
    }

    if (resumeData.certifications?.length) {
        sectionCount++;
        lineCount += resumeData.certifications.length;
    }

    if (resumeData.awards?.length) {
        sectionCount++;
        lineCount += resumeData.awards.length;
    }

    if (resumeData.volunteer?.length) {
        sectionCount++;
        for (const v of resumeData.volunteer) {
            lineCount += 1 + (v.role ? 1 : 0);
            for (const b of v.bullets || []) {
                lineCount += Math.max(1, Math.ceil(b.text.split(/\s+/).length / 11));
            }
        }
    }

    return { lineCount, sectionCount };
}

function calculateSpacing(resumeData: ResumeData): SpacingConfig {
    const { lineCount, sectionCount } = estimateLineCount(resumeData);
    const contentHeight =
        (lineCount * BASE_LINE_SPACING) +
        (sectionCount * (BASE_LINE_SPACING + BASE_HEADING_BEFORE + BASE_HEADING_AFTER));
    const remaining = AVAILABLE_HEIGHT_TWIPS - contentHeight;

    if (remaining <= 0) {
        return {
            lineSpacing: BASE_LINE_SPACING,
            headingBefore: BASE_HEADING_BEFORE,
            headingAfter: BASE_HEADING_AFTER,
        };
    }

    const headingShare = Math.floor(remaining * 0.6 / Math.max(sectionCount, 1));
    const lineShare = Math.floor(remaining * 0.4 / Math.max(lineCount, 1));

    return {
        lineSpacing: BASE_LINE_SPACING + Math.min(lineShare, 12),
        headingBefore: BASE_HEADING_BEFORE + Math.min(headingShare, 100),
        headingAfter: BASE_HEADING_AFTER,
    };
}

function calculateSpacingFromMeasured(contentHeightPx: number, sectionCount: number): SpacingConfig {
    const contentHeightTwips = (contentHeightPx / PUPPETEER_DPI) * 1440;
    const adjustedHeightTwips = contentHeightTwips * (1 + CHROME_TO_WORD_BUFFER);
    const remaining = Math.max(0, AVAILABLE_HEIGHT_TWIPS - adjustedHeightTwips);
    const gapTwips = Math.floor(remaining / Math.max(sectionCount, 1));

    return {
        lineSpacing: BASE_LINE_SPACING,
        headingBefore: BASE_HEADING_BEFORE + gapTwips,
        headingAfter: BASE_HEADING_AFTER,
    };
}

function countSections(r: ResumeData): number {
    let n = 0;
    if (r.profile) n++;
    if (r.skills?.length) n++;
    if (r.experience?.length) n++;
    if (r.projects?.length) n++;
    if (r.education?.length) n++;
    if (r.certifications?.length) n++;
    if (r.awards?.length) n++;
    if (r.volunteer?.length) n++;
    return n;
}

// ── Element builders ────────────────────────────────────────

function alignedRow(
    leftText: string,
    rightText: string,
    lineSpacing: number,
    leftBold = false,
    leftItalic = false,
): Table {
    return new Table({
        width: { size: AVAILABLE_WIDTH_TWIPS, type: WidthType.DXA },
        borders: NO_BORDERS,
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({
                            spacing: { before: 0, after: 0, line: lineSpacing },
                            children: [new TextRun({
                                text: leftText, font: FONT, size: BODY_SIZE,
                                bold: leftBold, italics: leftItalic,
                            })],
                        })],
                        borders: NO_BORDERS,
                        margins: ZERO_CELL_MARGIN,
                        width: { size: 70, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                        children: [new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            spacing: { before: 0, after: 0, line: lineSpacing },
                            children: [new TextRun({ text: rightText, font: FONT, size: BODY_SIZE })],
                        })],
                        borders: NO_BORDERS,
                        margins: ZERO_CELL_MARGIN,
                        width: { size: 30, type: WidthType.PERCENTAGE },
                    }),
                ],
            }),
        ],
    });
}

function sectionHeading(text: string, spacing: SpacingConfig): Paragraph {
    return new Paragraph({
        spacing: { before: spacing.headingBefore, after: spacing.headingAfter, line: spacing.lineSpacing },
        border: { bottom: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 6 } },
        children: [new TextRun({
            text: text.toUpperCase(),
            font: FONT,
            size: SECTION_HEADING_SIZE,
            bold: true,
        })],
    });
}

function bulletPoint(text: string, lineSpacing: number, boldPrefix?: string): Paragraph {
    const children: TextRun[] = [];
    if (boldPrefix) {
        children.push(new TextRun({ text: boldPrefix + ' ', font: FONT, size: BODY_SIZE, bold: true }));
    }
    children.push(new TextRun({ text, font: FONT, size: BODY_SIZE }));
    return new Paragraph({
        bullet: { level: 0 },
        spacing: { before: 0, after: 0, line: lineSpacing },
        children,
    });
}

function bodyText(text: string, lineSpacing: number): Paragraph {
    return new Paragraph({
        spacing: { before: 0, after: 0, line: lineSpacing },
        children: [new TextRun({ text, font: FONT, size: BODY_SIZE })],
    });
}

function buildContactLine(): string {
    const profile = loadProfile();
    const parts: string[] = [];
    if (profile.location) parts.push(profile.location);
    if (profile.phone) parts.push(profile.phone);
    if (profile.email) parts.push(profile.email);
    for (const link of profile.links || []) {
        if (link.value?.trim()) parts.push(link.label ? `${link.label}: ${link.value}` : link.value);
    }
    return parts.join(' • ');
}

// ── Main entry ──────────────────────────────────────────────

export async function generateDocx(
    resumeData: ResumeData,
    contentHeightPx?: number,
): Promise<Buffer> {
    const profile = loadProfile();
    const spacing = contentHeightPx
        ? calculateSpacingFromMeasured(contentHeightPx, countSections(resumeData))
        : calculateSpacing(resumeData);
    const ls = spacing.lineSpacing;
    const children: (Paragraph | Table)[] = [];

    // Header
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 20, line: ls },
        children: [new TextRun({
            text: profile.name || 'Your Name',
            font: FONT, size: NAME_SIZE, bold: true,
        })],
    }));
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0, line: ls },
        children: [new TextRun({ text: buildContactLine(), font: FONT, size: BODY_SIZE })],
    }));

    // Profile
    if (resumeData.profile) {
        children.push(sectionHeading('Profile', spacing));
        children.push(bodyText(resumeData.profile, ls));
    }

    // Skills
    if (resumeData.skills?.length) {
        children.push(sectionHeading('Skills', spacing));
        for (const skill of resumeData.skills) {
            children.push(new Paragraph({
                spacing: { before: 0, after: 0, line: ls },
                children: [
                    new TextRun({ text: skill.category + ': ', font: FONT, size: BODY_SIZE, bold: true }),
                    new TextRun({ text: skill.items, font: FONT, size: BODY_SIZE }),
                ],
            }));
        }
    }

    // Experience
    if (resumeData.experience?.length) {
        children.push(sectionHeading('Experience', spacing));
        for (const job of resumeData.experience) {
            children.push(alignedRow(job.company, job.location || '', ls, true));
            children.push(alignedRow(job.title, job.dates || '', ls, false, true));
            for (const b of job.bullets || []) {
                children.push(bulletPoint(b.text, ls, b.boldPrefix));
            }
        }
    }

    // Projects
    if (resumeData.projects?.length) {
        children.push(sectionHeading('Projects', spacing));
        for (const proj of resumeData.projects) {
            const projChildren: TextRun[] = [
                new TextRun({ text: proj.name, font: FONT, size: BODY_SIZE, bold: true }),
            ];
            if (proj.tech) {
                projChildren.push(new TextRun({
                    text: ` — (${proj.tech})`, font: FONT, size: BODY_SIZE, italics: true,
                }));
            }
            children.push(new Paragraph({
                spacing: { before: 20, after: 0, line: ls },
                children: projChildren,
            }));
            for (const b of proj.bullets || []) children.push(bulletPoint(b.text, ls));
        }
    }

    // Certifications
    if (resumeData.certifications?.length) {
        children.push(sectionHeading('Certifications', spacing));
        for (const c of resumeData.certifications) {
            const runs: TextRun[] = [new TextRun({ text: c.name, font: FONT, size: BODY_SIZE, bold: true })];
            if (c.issuer) runs.push(new TextRun({ text: ` — ${c.issuer}`, font: FONT, size: BODY_SIZE }));
            if (c.date) runs.push(new TextRun({ text: ` (${c.date})`, font: FONT, size: BODY_SIZE }));
            children.push(new Paragraph({ spacing: { before: 0, after: 0, line: ls }, children: runs }));
        }
    }

    // Awards
    if (resumeData.awards?.length) {
        children.push(sectionHeading('Awards', spacing));
        for (const a of resumeData.awards) {
            const runs: TextRun[] = [new TextRun({ text: a.name, font: FONT, size: BODY_SIZE, bold: true })];
            if (a.issuer) runs.push(new TextRun({ text: ` — ${a.issuer}`, font: FONT, size: BODY_SIZE }));
            if (a.date) runs.push(new TextRun({ text: ` (${a.date})`, font: FONT, size: BODY_SIZE }));
            if (a.description) runs.push(new TextRun({
                text: ` — ${a.description}`, font: FONT, size: BODY_SIZE, italics: true,
            }));
            children.push(new Paragraph({ spacing: { before: 0, after: 0, line: ls }, children: runs }));
        }
    }

    // Volunteer
    if (resumeData.volunteer?.length) {
        children.push(sectionHeading('Volunteer', spacing));
        for (const v of resumeData.volunteer) {
            children.push(alignedRow(v.organization, v.dates || '', ls, true));
            if (v.role) {
                children.push(new Paragraph({
                    spacing: { before: 0, after: 0, line: ls },
                    children: [new TextRun({ text: v.role, font: FONT, size: BODY_SIZE, italics: true })],
                }));
            }
            for (const b of v.bullets || []) children.push(bulletPoint(b.text, ls));
        }
    }

    // Education
    if (resumeData.education?.length) {
        children.push(sectionHeading('Education', spacing));
        for (const edu of resumeData.education) {
            const left = edu.graduation ? `${edu.institution} | ${edu.graduation}` : edu.institution;
            children.push(alignedRow(left, edu.location || '', ls, true));

            const degreeRuns: TextRun[] = [new TextRun({
                text: edu.degree, font: FONT, size: BODY_SIZE, italics: true,
            })];
            if (edu.minor) degreeRuns.push(new TextRun({
                text: ` | Minor: ${edu.minor}`, font: FONT, size: BODY_SIZE, italics: true,
            }));
            if (edu.gpa) degreeRuns.push(new TextRun({
                text: ` | GPA: ${edu.gpa}`, font: FONT, size: BODY_SIZE, italics: true,
            }));
            children.push(new Paragraph({
                spacing: { before: 0, after: 0, line: ls },
                children: degreeRuns,
            }));

            if (edu.honors?.length) children.push(bodyText('Honors: ' + edu.honors.join(', '), ls));
            if (edu.coursework) children.push(bodyText('Relevant Coursework: ' + edu.coursework, ls));
        }
    }

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font: FONT, size: BODY_SIZE },
                    paragraph: { spacing: { before: 0, after: 0, line: ls } },
                },
            },
        },
        numbering: {
            config: [{
                reference: 'default-bullet',
                levels: [{
                    level: 0,
                    format: 'bullet',
                    text: '•',
                    alignment: AlignmentType.LEFT,
                    style: {
                        paragraph: {
                            indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.15) },
                        },
                    },
                }],
            }],
        },
        sections: [{
            properties: {
                page: {
                    margin: { top: MARGIN_TOP_TWIPS, bottom: MARGIN_BOTTOM_TWIPS, left: 720, right: 720 },
                },
            },
            children,
        }],
    });

    return await Packer.toBuffer(doc);
}
