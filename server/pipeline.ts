/**
 * server/pipeline.ts — Resume generation pipeline orchestrator.
 *
 * Yields SSE progress events as it:
 *   1. Calls the chosen LLM to score projects, analyze the JD, and select tailored content
 *   2. Renders to PDF + DOCX, deterministically truncating overflow
 *   3. Saves the result to the database
 */

import { selectContent } from './llmCalls.js';
import { populateTemplate, renderPdf, performDeterministicTruncation } from './renderer.js';
import { insertGeneration } from './db.js';
import type {
    ResumeData,
    RenderResult,
    ProgressEvent,
    GenerationResult,
    ContentSelectionResult,
    LlmCredentials,
} from '../shared/types.js';

export async function* runPipeline(
    creds: LlmCredentials,
    jobDescription: string,
    companyOverride?: string,
): AsyncGenerator<
    ProgressEvent | { type: 'complete'; result: GenerationResult } | { type: 'error'; message: string }
> {
    try {
        yield { step: 'analyzing', message: 'Analyzing job description and scoring projects...' };

        let contentResult: ContentSelectionResult;
        try {
            contentResult = await selectContent(creds, jobDescription);
        } catch (err: any) {
            yield { type: 'error', message: err.message || 'Content selection failed' };
            return;
        }

        const { fit_assessment, resume_data } = contentResult;

        const reasoningPreview = (fit_assessment.reasoning || '').slice(0, 80);
        yield {
            step: 'selected',
            message: `Fit score: ${fit_assessment.score}/10 — ${reasoningPreview}${reasoningPreview.length === 80 ? '...' : ''}`,
        };

        // Render + truncate to fit one page
        let currentData: ResumeData = resume_data;
        let renderResult: RenderResult;

        yield { step: 'rendering', message: 'Tailoring layout for a perfect 1-page fit...' };

        const filename = `resume_${Date.now()}.pdf`;
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

        yield { step: 'saving', message: 'Saving to your vault...' };

        const company = companyOverride || fit_assessment.company || 'Company';
        const role = fit_assessment.role || 'Role';

        const id = insertGeneration({
            company,
            role,
            score: fit_assessment.score,
            reasoning: fit_assessment.reasoning,
            stretchAreas: fit_assessment.stretch_areas || [],
            atsKeywords: fit_assessment.keyword_overlap || [],
            jobDescription,
            resumeDataJson: JSON.stringify(currentData),
            pdfFilename: renderResult.pdfPath.split(/[/\\]/).pop()!,
            fillStatus: renderResult.fillStatus,
            iterations: 1,
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
            },
        };
    } catch (err: any) {
        yield { type: 'error', message: err?.message || 'Unknown error occurred' };
    }
}
