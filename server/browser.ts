/**
 * server/browser.ts — Puppeteer browser singleton.
 *
 * Lazily launches one Chromium instance and reuses it for all rendering.
 * This avoids cold-starting a new browser on every renderPdf() call,
 * which is especially important during the truncation loop.
 */

import puppeteer, { type Browser } from 'puppeteer';

let browserInstance: Browser | null = null;

/**
 * Get the shared browser instance, launching it on first call.
 */
export async function getBrowser(): Promise<Browser> {
    if (!browserInstance || !browserInstance.connected) {
        browserInstance = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
    }
    return browserInstance;
}

/**
 * Gracefully close the browser (for shutdown hooks).
 */
export async function closeBrowser(): Promise<void> {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}
