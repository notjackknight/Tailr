/**
 * MasterResumeModal — Upload your master resume.
 *
 * Accepts .docx, .pdf, .txt, .md, .yaml. Non-YAML uploads are converted by
 * the LLM-backed parser at /api/master/upload.
 */

import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Upload as UploadIcon,
    Save,
    AlertTriangle,
    Check,
    FileText,
    RefreshCw,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { cn } from '../../lib/utils';
import { uploadMasterResume } from '../../lib/api';
import { toast } from '../ui/Toast';

interface MasterResumeModalProps {
    onClose: () => void;
    initialContent: string;
}

type Stage = 'idle' | 'uploading' | 'parsing' | 'success' | 'error';

const STAGES = [
    { id: 'uploading', label: 'Uploading file' },
    { id: 'parsing', label: 'Extracting & parsing with LLM' },
    { id: 'success', label: 'Saved to your master resume' },
] as const;

export const MasterResumeModal = ({ onClose, initialContent }: MasterResumeModalProps) => {
    const [stage, setStage] = useState<Stage>('idle');
    const [dragActive, setDragActive] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const hasExisting = (initialContent || '').trim().length > 0;

    const handleFileUpload = async (file?: File) => {
        if (!file) return;
        setError(null);
        setUploadedFileName(file.name);
        setStage('uploading');

        // After ~600ms transition to "parsing" so the user sees forward motion.
        const parseTimer = setTimeout(() => {
            setStage((s) => (s === 'uploading' ? 'parsing' : s));
        }, 600);

        try {
            await uploadMasterResume(file);
            clearTimeout(parseTimer);
            setStage('success');
            toast.success('Master resume saved');
        } catch (err: any) {
            clearTimeout(parseTimer);
            setError(err?.message || 'Upload failed');
            setStage('error');
            setUploadedFileName(null);
        } finally {
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

    const isBusy = stage === 'uploading' || stage === 'parsing';

    const title = hasExisting ? 'Update master resume' : 'Upload master resume';
    const subtitle = hasExisting
        ? 'Replacing your master resume will not affect previously generated tailored resumes.'
        : 'We extract every role, bullet, and skill, then reuse them when tailoring. Your file is processed locally — only the parsed text is sent to the LLM.';

    const stagedSteps = useMemo(() => STAGES, []);
    const currentStageIndex = stagedSteps.findIndex((s) => s.id === stage);

    return (
        <Modal
            onClose={() => !isBusy && onClose()}
            title={title}
            subtitle={subtitle}
            maxWidth="max-w-2xl"
            closeOnBackdrop={!isBusy}
            footer={
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-[11px] text-gray-500">
                        Accepted: .docx, .pdf, .txt, .md, .yaml — up to 10MB
                    </span>
                    <div className="flex items-center gap-2">
                        {stage === 'success' && (
                            <Button variant="secondary" size="sm" onClick={() => setStage('idle')} icon={<RefreshCw size={14} />}>
                                Replace again
                            </Button>
                        )}
                        <Button
                            variant="primary"
                            size="md"
                            onClick={onClose}
                            disabled={isBusy}
                            icon={stage === 'success' ? <Check size={14} /> : undefined}
                        >
                            {stage === 'success' ? 'Done' : 'Close'}
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="p-5 md:p-7">
                <div
                    className={cn(
                        'relative w-full rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center py-12 px-4 text-center select-none',
                        dragActive
                            ? 'border-[#FF4F00] bg-[#FF4F00]/5'
                            : stage === 'error'
                            ? 'border-red-500/30 bg-red-500/5'
                            : stage === 'success'
                            ? 'border-green-500/30 bg-green-500/5'
                            : 'border-white/15 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.05]',
                        isBusy && 'pointer-events-none opacity-95',
                    )}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => !isBusy && stage !== 'success' && fileInputRef.current?.click()}
                    style={{ cursor: isBusy || stage === 'success' ? 'default' : 'pointer' }}
                    role="button"
                    tabIndex={isBusy || stage === 'success' ? -1 : 0}
                    aria-label="Drop a resume file or click to choose"
                    onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !isBusy && stage !== 'success') {
                            e.preventDefault();
                            fileInputRef.current?.click();
                        }
                    }}
                >
                    <input
                        type="file"
                        accept=".docx,.pdf,.txt,.md,.yaml,.yml"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => handleFileUpload(e.target.files?.[0])}
                    />

                    <AnimatePresence mode="wait">
                        {isBusy ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                className="flex flex-col items-center w-full max-w-sm"
                            >
                                <Spinner size={36} className="text-[#FF4F00]" />
                                <p className="mt-3 text-sm font-semibold text-white truncate w-full">
                                    {uploadedFileName}
                                </p>
                                <ul className="mt-4 space-y-1.5 w-full text-left">
                                    {stagedSteps.map((s, i) => {
                                        const isDone = i < currentStageIndex;
                                        const isActive = s.id === stage;
                                        return (
                                            <li
                                                key={s.id}
                                                className={`flex items-center gap-2 text-xs ${
                                                    isDone ? 'text-green-300' : isActive ? 'text-white' : 'text-gray-500'
                                                }`}
                                            >
                                                {isDone ? (
                                                    <Check size={12} className="text-green-400 shrink-0" />
                                                ) : isActive ? (
                                                    <Spinner size={12} className="text-[#FF4F00]" />
                                                ) : (
                                                    <span className="w-3 h-3 rounded-full border border-gray-600 shrink-0" />
                                                )}
                                                {s.label}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </motion.div>
                        ) : stage === 'error' ? (
                            <motion.div
                                key="error"
                                initial={{ opacity: 0, scale: 0.97 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center"
                            >
                                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20 mb-3">
                                    <AlertTriangle size={28} className="text-red-400" />
                                </div>
                                <h4 className="text-base font-bold text-white mb-1">Upload failed</h4>
                                <p className="text-gray-400 text-sm max-w-sm">{error}</p>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setError(null);
                                        setStage('idle');
                                    }}
                                    className="text-xs text-[#FF4F00] hover:text-[#FF6B1F] mt-3 transition-colors"
                                >
                                    Try a different file
                                </button>
                            </motion.div>
                        ) : stage === 'success' ? (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.97 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center text-center"
                            >
                                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20 mb-3 shadow-[0_0_30px_rgba(50,215,75,0.2)]">
                                    <Save size={28} className="text-green-400" />
                                </div>
                                <h4 className="text-base font-bold text-white mb-1">Resume parsed successfully</h4>
                                <p className="text-gray-400 text-sm max-w-sm">
                                    {uploadedFileName} is now your master resume. Review the result by tailoring a sample JD in Tailor.
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="upload"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="flex flex-col items-center"
                            >
                                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 mb-3">
                                    {hasExisting ? (
                                        <FileText size={28} className="text-gray-300" />
                                    ) : (
                                        <UploadIcon
                                            size={28}
                                            className={cn(
                                                'text-gray-400 transition-colors',
                                                dragActive && 'text-[#FF4F00]',
                                            )}
                                        />
                                    )}
                                </div>
                                <h4 className="text-base md:text-lg font-bold text-white mb-1">
                                    {hasExisting ? 'Replace your master resume' : 'Drop a file or click to choose'}
                                </h4>
                                <p className="text-gray-500 text-xs mb-4">
                                    .docx, .pdf, .txt, .md, .yaml — up to 10MB
                                </p>
                                <Button
                                    variant="secondary"
                                    size="md"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        fileInputRef.current?.click();
                                    }}
                                    icon={<UploadIcon size={14} />}
                                >
                                    Choose file
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </Modal>
    );
};
