/**
 * PdfPreviewModal — Full-screen PDF preview overlay.
 *
 * Adds context (company / role / score) plus inline download CTAs and an
 * "open in new tab" fallback for browsers that don't render the iframe well.
 */

import React from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ScoreRing } from '../ui/ScoreRing';
import { downloadResume } from '../../lib/utils';

interface PdfPreviewModalProps {
    pdfFilename: string;
    onClose: () => void;
    company?: string;
    role?: string;
    score?: number;
    contactName?: string;
}

export const PdfPreviewModal = ({
    pdfFilename,
    onClose,
    company,
    role,
    score,
    contactName = 'Resume',
}: PdfPreviewModalProps) => {
    const headerCompany = company || 'Resume preview';
    const headerRole = role || pdfFilename;

    return (
        <Modal
            onClose={onClose}
            maxWidth="max-w-4xl"
            fullHeight
            contentClassName="flex flex-col p-0"
            title={
                <div className="flex items-center gap-3 min-w-0">
                    {typeof score === 'number' && (
                        <ScoreRing score={score} size={36} strokeWidth={3} animate={false} />
                    )}
                    <div className="min-w-0">
                        <span className="block text-base font-bold text-white truncate">{headerRole}</span>
                        <span className="block text-xs text-gray-400 truncate">{headerCompany}</span>
                    </div>
                </div>
            }
            headerAction={
                <div className="flex items-center gap-1.5">
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={<Download size={13} />}
                        onClick={() => downloadResume(pdfFilename, company || '', 'pdf', contactName)}
                    >
                        PDF
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={<Download size={13} />}
                        onClick={() => downloadResume(pdfFilename, company || '', 'docx', contactName)}
                    >
                        DOCX
                    </Button>
                    <a
                        href={`/api/resume/${pdfFilename}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Open PDF in new tab"
                    >
                        <ExternalLink size={13} />
                    </a>
                </div>
            }
        >
            {/* Mobile: prefer a clear download CTA over the cramped iframe. */}
            <div className="md:hidden flex flex-col items-center gap-3 p-6 bg-white/[0.02] border-b border-white/5">
                <p className="text-sm text-gray-300 text-center">
                    PDFs render poorly on mobile — open or download instead.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                    <a
                        href={`/api/resume/${pdfFilename}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-tailr hover:opacity-95"
                    >
                        Open in new tab <ExternalLink size={12} />
                    </a>
                    <button
                        onClick={() => downloadResume(pdfFilename, company || '', 'pdf', contactName)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/10"
                    >
                        Download PDF <Download size={12} />
                    </button>
                </div>
            </div>
            <iframe
                src={`/api/resume/${pdfFilename}`}
                className="hidden md:block flex-1 w-full bg-white"
                title="Resume preview"
            />
        </Modal>
    );
};
