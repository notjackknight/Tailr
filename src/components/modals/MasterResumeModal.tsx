/**
 * MasterResumeModal — Upload your master resume.
 *
 * Accepts .docx, .pdf, .txt, .md, .yaml. Non-YAML uploads are converted by
 * the LLM-backed parser at /api/master/upload.
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload as UploadIcon, Save, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { uploadMasterResume } from '../../lib/api';

interface MasterResumeModalProps {
    onClose: () => void;
    initialContent: string;
}

export const MasterResumeModal = ({ onClose, initialContent }: MasterResumeModalProps) => {
    const [_masterContent, setMasterContent] = useState(initialContent);
    const [isLoading, setIsLoading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (file?: File) => {
        if (!file) return;

        setError(null);
        setUploadedFileName(file.name);
        setIsLoading(true);

        try {
            const content = await uploadMasterResume(file);
            setMasterContent(content);
            setTimeout(() => onClose(), 1800);
        } catch (err: any) {
            setError(err?.message || 'Upload failed');
            setUploadedFileName(null);
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
        else if (e.type === 'dragleave') setDragActive(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
    };

    const showSuccess = !isLoading && !error && uploadedFileName;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
            onClick={() => !isLoading && onClose()}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="w-full max-w-2xl bg-[#0A0A0A] rounded-3xl overflow-hidden border border-white/10 flex flex-col shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 flex justify-between items-center border-b border-white/10 bg-white/[0.02]">
                    <div>
                        <h3 className="text-xl font-bold text-white">Upload Master Resume</h3>
                        <p className="text-sm text-gray-400 mt-1">
                            We extract and structure the content automatically. Your file is processed locally — only the parsed text is sent to the LLM.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                        aria-label="Close"
                    >
                        <X size={20} className="text-white" />
                    </button>
                </div>

                <div className="p-8">
                    <div
                        className={cn(
                            'relative w-full rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center py-16 px-6 text-center select-none',
                            dragActive
                                ? 'border-[#FF4F00] bg-[#FF4F00]/5'
                                : error
                                ? 'border-red-500/30 bg-red-500/5'
                                : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10',
                            isLoading && 'pointer-events-none opacity-80',
                        )}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => !isLoading && fileInputRef.current?.click()}
                        style={{ cursor: isLoading ? 'default' : 'pointer' }}
                    >
                        <input
                            type="file"
                            accept=".docx,.pdf,.txt,.md,.yaml,.yml"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={(e) => handleFileUpload(e.target.files?.[0])}
                        />

                        <AnimatePresence mode="wait">
                            {isLoading ? (
                                <motion.div key="loading" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col items-center">
                                    <div className="w-16 h-16 border-4 border-[#FF4F00]/30 border-t-[#FF4F00] rounded-full animate-spin mb-4 shadow-[0_0_30px_rgba(255,79,0,0.3)]" />
                                    <h4 className="text-lg font-bold text-white mb-2">Parsing Resume...</h4>
                                    <p className="text-sm text-gray-500">{uploadedFileName}</p>
                                </motion.div>
                            ) : error ? (
                                <motion.div key="error" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
                                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20 mb-4">
                                        <AlertTriangle size={32} className="text-red-400" />
                                    </div>
                                    <h4 className="text-lg font-bold text-white mb-2">Upload Failed</h4>
                                    <p className="text-gray-400 text-sm max-w-sm">{error}</p>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setError(null); }}
                                        className="text-xs text-[#FF4F00] hover:text-[#FF6B1F] mt-4 transition-colors"
                                    >
                                        Try again
                                    </button>
                                </motion.div>
                            ) : showSuccess ? (
                                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
                                    <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20 mb-4 shadow-[0_0_30px_rgba(50,215,75,0.2)]">
                                        <Save size={32} className="text-green-400" />
                                    </div>
                                    <h4 className="text-lg font-bold text-white mb-2">Successfully Parsed!</h4>
                                    <p className="text-gray-400 text-sm">{uploadedFileName} is now your master resume.</p>
                                </motion.div>
                            ) : (
                                <motion.div key="upload" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col items-center">
                                    <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 mb-6 group-hover:bg-white/10 transition-colors">
                                        <UploadIcon size={32} className={cn('text-gray-400 transition-colors', dragActive && 'text-[#FF4F00]')} />
                                    </div>
                                    <h4 className="text-xl font-bold text-white mb-2">Drop a file or click to choose</h4>
                                    <p className="text-gray-500 text-sm mb-6">.docx, .pdf, .txt, .md, .yaml — up to 10MB</p>
                                    <Button
                                        variant="secondary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            fileInputRef.current?.click();
                                        }}
                                    >
                                        Choose File
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};
