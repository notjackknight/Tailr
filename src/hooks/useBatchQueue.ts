/**
 * src/hooks/useBatchQueue.ts — State + orchestration for concurrent batch JD tailoring.
 *
 * Each job is an independent unit that runs through the SAME `generateResume()`
 * SSE call the single-JD Studio flow uses. Jobs are executed through a
 * concurrency-limited pool (see concurrencyLimiter) so we never exceed a small
 * number of parallel LLM + Puppeteer pipelines. Per-job SSE callbacks update
 * only that job's slot, so result cards fill in independently.
 */

import { useCallback, useRef, useState } from 'react';
import type { GenerationResult } from '../../shared/types';
import { generateResume } from '../lib/api';
import { runWithLimit, BATCH_CONCURRENCY } from '../lib/concurrencyLimiter';

export type BatchJobStatus = 'queued' | 'running' | 'done' | 'error';

/** A single editable JD entry in the batch input form. */
export interface BatchEntry {
    id: string;
    jobDescription: string;
    companyName: string;
}

/** A job once submitted — carries live status + result for its card. */
export interface BatchJob {
    id: string;
    jobDescription: string;
    companyName: string;
    status: BatchJobStatus;
    statusMessage: string;
    result: GenerationResult | null;
    error: string | null;
}

let entrySeq = 0;
function newEntryId(): string {
    entrySeq += 1;
    return `entry_${entrySeq}`;
}

/** Create a fresh, empty entry row. */
export function makeEmptyEntry(): BatchEntry {
    return { id: newEntryId(), jobDescription: '', companyName: '' };
}

/** Minimum JD length mirrors the server-side validation in /api/generate. */
export const MIN_JD_LENGTH = 50;

export function isEntryValid(entry: BatchEntry): boolean {
    return entry.jobDescription.trim().length >= MIN_JD_LENGTH;
}

export function useBatchQueue() {
    const [jobs, setJobs] = useState<BatchJob[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    // Abort controllers keyed by job id — lets us cancel an individual job.
    const abortRef = useRef<Map<string, AbortController>>(new Map());

    const patchJob = useCallback((id: string, patch: Partial<BatchJob>) => {
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
    }, []);

    /** Kick off all valid entries concurrently (capped by the limiter). */
    const runAll = useCallback(async (entries: BatchEntry[]) => {
        const valid = entries.filter(isEntryValid);
        if (valid.length === 0 || isRunning) return;

        const initialJobs: BatchJob[] = valid.map((e) => ({
            id: e.id,
            jobDescription: e.jobDescription.trim(),
            companyName: e.companyName.trim(),
            status: 'queued',
            statusMessage: 'Queued…',
            result: null,
            error: null,
        }));
        setJobs(initialJobs);
        setIsRunning(true);
        abortRef.current.clear();

        const tasks = initialJobs.map((job) => async () => {
            const controller = new AbortController();
            abortRef.current.set(job.id, controller);
            patchJob(job.id, { status: 'running', statusMessage: 'Connecting…' });

            try {
                await generateResume(
                    job.jobDescription,
                    job.companyName || undefined,
                    {
                        onProgress: (message) => patchJob(job.id, { statusMessage: message }),
                        onComplete: (result) =>
                            patchJob(job.id, { status: 'done', statusMessage: '', result }),
                        onError: (message) =>
                            patchJob(job.id, { status: 'error', statusMessage: '', error: message }),
                    },
                    controller.signal,
                );
            } catch (err: any) {
                if (err?.name === 'AbortError') {
                    patchJob(job.id, { status: 'error', statusMessage: '', error: 'Canceled' });
                } else {
                    patchJob(job.id, {
                        status: 'error',
                        statusMessage: '',
                        error: err?.message || 'Generation failed',
                    });
                }
            } finally {
                abortRef.current.delete(job.id);
            }
        });

        await runWithLimit(tasks, BATCH_CONCURRENCY);
        setIsRunning(false);
    }, [isRunning, patchJob]);

    /** Cancel a single in-flight job. */
    const cancelJob = useCallback((id: string) => {
        abortRef.current.get(id)?.abort();
    }, []);

    /** Cancel every in-flight job. */
    const cancelAll = useCallback(() => {
        for (const controller of abortRef.current.values()) controller.abort();
    }, []);

    /** Clear the result list (only when nothing is running). */
    const clearJobs = useCallback(() => {
        if (isRunning) return;
        setJobs([]);
    }, [isRunning]);

    return { jobs, isRunning, runAll, cancelJob, cancelAll, clearJobs };
}
