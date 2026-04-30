/**
 * src/lib/utils.ts — Shared frontend utilities.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes with clsx. */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Map a fit score (1-10) to a color string. */
export function scoreColor(score: number): string {
    if (score >= 8) return '#32D74B';
    if (score >= 6) return '#FFD60A';
    return '#FF453A';
}

/** Map a fit score (1-10) to a Tailwind text class. */
export function scoreTextClass(score: number): string {
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-red-400';
}

/** Trigger a download via a temporary anchor element. */
export function downloadFile(url: string, filename: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
}

/** Build a safe filename slug from a free-text string. */
function slugify(input: string): string {
    return (input || '').replace(/\s+/g, '_').replace(/[^A-Za-z0-9_\-.]/g, '') || 'Resume';
}

/** Download a generated resume as PDF or DOCX. */
export function downloadResume(
    pdfFilename: string,
    company: string,
    format: 'pdf' | 'docx' = 'pdf',
    contactName = 'Resume',
) {
    const filename = format === 'pdf' ? pdfFilename : pdfFilename.replace(/\.pdf$/, '.docx');
    const downloadName = `${slugify(contactName)}_Resume_${slugify(company)}.${format}`;
    downloadFile(`/api/resume/${filename}`, downloadName);
}

/** Format a DB timestamp (UTC, no Z) to a relative time string. */
export function formatRelativeDate(dateStr: string): string {
    const date = new Date(dateStr + 'Z');
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}
