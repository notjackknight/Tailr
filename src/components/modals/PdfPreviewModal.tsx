/**
 * PdfPreviewModal — Full-screen PDF preview overlay.
 * Used by the Vault to preview generated resumes.
 */

import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

interface PdfPreviewModalProps {
    pdfFilename: string;
    onClose: () => void;
}

export const PdfPreviewModal = ({ pdfFilename, onClose }: PdfPreviewModalProps) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-3xl h-[90vh] bg-[#0A0A0A] rounded-3xl overflow-hidden border border-white/10 flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 flex justify-between items-center border-b border-white/10 bg-white/5">
                    <span className="text-sm text-gray-400 font-mono">Resume Preview</span>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X size={16} className="text-white" />
                    </button>
                </div>
                <iframe
                    src={`/api/resume/${pdfFilename}`}
                    className="flex-1 w-full bg-white rounded-b-3xl"
                    title="Resume Preview"
                />
            </motion.div>
        </motion.div>
    );
};
