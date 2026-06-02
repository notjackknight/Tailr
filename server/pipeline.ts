/**
 * server/pipeline.ts — Resume generation pipeline orchestrator.
 *
 * Yields SSE progress events as it:
 *   1. Calls the chosen LLM to score projects, analyze the JD, and select tailored content
 *   2. Renders to PDF + DOCX, deterministically truncating overflow
 *   3. Saves the result to the database
 */

import { selectContent, selectContentLinkedInDefault, generateColdDm } from './llmCalls.js';
import { populateTemplate, renderPdf, performDeterministicTruncation } from './renderer.js';
import { insertGeneration } from './db.js';
import type {
    ResumeData,
    RenderResult,
    ProgressEvent,
    GenerationResult,
    ContentSelectionResult,
    LlmCredentials,
    GenerationKind,
} from '../shared/types.js';

export interface PipelineOptions {
    /** Tailoring mode. Defaults to 'tailored'. */
    kind?: GenerationKind;
    /** Job description — required for 'tailored', ignored for 'linkedin-default'. */
    jobDescription?: string;
    /** Optional company override (only meaningful for 'tailored'). */
    companyOverride?: string;
}

export async function* runPipeline(
    creds: LlmCredentials,
    options: PipelineOptions,
): AsyncGenerator<
    ProgressEvent | { type: 'complete'; result: GenerationResult } | { type: 'error'; message: string }
> {
    const kind: GenerationKind = options.kind ?? 'tailored';
    const jobDescription = options.jobDescription?.trim() ?? '';
    const companyOverride = options.companyOverride;

    try {
        if (kind === 'linkedin-default') {
            yield { step: 'analyzing', message: 'Inferring your role cluster from your master resume...' };
        } else {
            yield { step: 'analyzing', message: 'Analyzing job description and scoring projects...' };
        }

        let contentResult: ContentSelectionResult;
        try {
            contentResult = kind === 'linkedin-default'
                ? await selectContentLinkedInDefault(creds)
                : await selectContent(creds, jobDescription);
        } catch (err: any) {
            yield { type: 'error', message: err.message || 'Content selection failed' };
            return;
        }

        const { fit_assessment, resume_data } = contentResult;

        const reasoningPreview = (fit_assessment.reasoning || '').slice(0, 80);
        const scoreLabel = kind === 'linkedin-default' ? 'Cluster confidence' : 'Fit score';
        yield {
            step: 'selected',
            message: `${scoreLabel}: ${fit_assessment.score}/10 — ${reasoningPreview}${reasoningPreview.length === 80 ? '...' : ''}`,
        };

        // Render + truncate to fit one page
        let currentData: ResumeData = resume_data;
        let renderResult: RenderResult;

        yield { step: 'rendering', message: 'Tailoring layout for a perfect 1-page fit...' };

        // Suffix guards against collisions when multiple generations run
        // concurrently (batch mode) and land in the same millisecond.
        const filename = `resume_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pdf`;
        renderResult = await renderPdf(populateTemplate(currentData), filename, currentData);

        let crops = 0;
        while (renderResult.pages > 1 && crops < 30) {
            crops++;
            const truncated = performDeterministicTruncation(currentData);
            // No more cuts available — stop to avoid infinite loop
            if (JSON.stringify(truncated) === JSON.stringify(currentData)) break;
            currentData = truncated;
            renderResult = await renderPdf(populateTemplate(currentData), filename, currentData);
        }

        yield {
            step: 'perfect',
            message: 'Layout optimized to fill one page.',
            remainingLines: renderResult.remainingLines,
        };

        // For linkedin-default we ignore any companyOverride and always use the
        // sentinel from the prompt; for tailored we honor the override chain.
        const company = kind === 'linkedin-default'
            ? (fit_assessment.company || 'LinkedIn Default')
            : (companyOverride || fit_assessment.company || 'Company');
        const role = fit_assessment.role || 'Role';

        // Cold DM — only for JD-tailored resumes (a LinkedIn-default resume has
        // no specific role/company to pitch). Non-fatal: a failure leaves it ''.
        let outreachDm = '';
        if (kind !== 'linkedin-default') {
            yield { step: 'outreach', message: 'Writing a cold DM to go with it...' };
            try {
                outreachDm = await generateColdDm(creds, company, role, currentData);
            } catch {
                outreachDm = '';
            }
        }

        yield { step: 'saving', message: 'Saving to your vault...' };

        const id = insertGeneration({
            company,
            role,
            score: fit_assessment.score,
            reasoning: fit_assessment.reasoning,
            stretchAreas: fit_assessment.stretch_areas || [],
            atsKeywords: fit_assessment.keyword_overlap || [],
            jobDescription: kind === 'linkedin-default' ? '' : jobDescription,
            resumeDataJson: JSON.stringify(currentData),
            pdfFilename: renderResult.pdfPath.split(/[/\\]/).pop()!,
            fillStatus: renderResult.fillStatus,
            iterations: 1,
            kind,
            outreachDm,
        });

        yield {
            type: 'complete',
            result: {
                id,
                fitAssessment: {
                    score: fit_assessment.score,
                    reasoning: fit_assessment.reasoning,
                    stretchAreas: fit_assessment.stretch_areas || [],
                    atsKeywords: fit_assessment.keyword_overlap || [],
                    company,
                    role,
                },
                pdfFilename: renderResult.pdfPath.split(/[/\\]/).pop()!,
                fillStatus: renderResult.fillStatus,
                iterations: 1,
                kind,
                outreachDm,
            },
        };
    } catch (err: any) {
        yield { type: 'error', message: err?.message || 'Unknown error occurred' };
    }
}
