/**
 * src/lib/concurrencyLimiter.ts — Dependency-free promise pool.
 *
 * Runs at most `limit` async tasks concurrently, queuing the rest. Used by the
 * batch JD queue so we don't fire an unbounded number of parallel LLM +
 * Puppeteer pipelines at the server (which would risk provider rate limits and
 * memory spikes). Each task settles independently — a rejecting task does not
 * cancel the others.
 */

/** Default concurrency cap for batch generation. Tune here if needed. */
export const BATCH_CONCURRENCY = 5;

/**
 * Run each task with at most `limit` running at once. Resolves once every task
 * has settled. Results are returned in the same order as `tasks`; a task that
 * throws surfaces as a rejected entry via `Promise.allSettled` semantics, so
 * callers should handle their own per-task errors inside the task itself.
 */
export async function runWithLimit<T>(
    tasks: Array<() => Promise<T>>,
    limit: number = BATCH_CONCURRENCY,
): Promise<void> {
    let cursor = 0;

    async function worker(): Promise<void> {
        while (cursor < tasks.length) {
            const index = cursor++;
            try {
                await tasks[index]();
            } catch {
                // Tasks own their error handling (e.g. updating a job's status).
                // Swallow here so one failure never aborts the pool.
            }
        }
    }

    const workerCount = Math.max(1, Math.min(limit, tasks.length));
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
}
