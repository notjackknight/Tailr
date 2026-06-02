/**
 * MasterResumeModal — Edit or replace your master resume.
 *
 * Two tabs:
 *  - Edit:   a raw YAML text editor. Saves verbatim via PUT /api/master —
 *            no LLM, no API cost, nothing is altered. Best for small revisions.
 *  - Upload: drop a .docx/.pdf/.txt/.md/.yaml file. Non-YAML uploads are
 *            converted by the LLM-backed parser at /api/master/upload (this can
 *            rephrase/restructure content), so after an upload we reload the
 *            Edit tab so the result can be reviewed and corrected.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Upload as UploadIcon,
    Save,
    AlertTriangle,
    Check,
    RefreshCw,
    Pencil,
} from 'lucide-react';
import { Code2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { cn } from '../../lib/utils';
import { uploadMasterResume, saveMasterResume } from '../../lib/api';
import { toast } from '../ui/Toast';
import { MasterResumeForm } from '../MasterResumeForm';
import { parseMasterResume, serializeMasterResume } from '../../lib/masterResume';
import type { ResumeData } from '../../../shared/types';

interface MasterResumeModalProps {
    onClose: () => void;
    initialContent: string;
    /** Which tab to open on. Defaults to 'edit' when content exists, else 'upload'. */
    defaultTab?: 'edit' | 'upload';
}

type Tab = 'edit' | 'upload';
type Stage = 'idle' | 'uploading' | 'parsing' | 'success' | 'error';

const STAGES = [
    { id: 'uploading', label: 'Uploading file' },
    { id: 'parsing', label: 'Extracting & parsing with LLM' },
    { id: 'success', label: 'Saved to your master resume' },
] as const;

export const MasterResumeModal = ({ onClose, initialContent, defaultTab }: MasterResumeModalProps) => {
    const hasExisting = (initialContent || '').trim().length > 0;
    const [tab, setTab] = useState<Tab>(defaultTab ?? (hasExisting ? 'edit' : 'upload'));

    // ── Edit-tab state ──────────────────────────────────────────────
    // `content` (YAML string) is the source of truth for dirty-tracking + save.
    // The structured form edits a parsed model and writes back to `content` on
    // every change. A raw-YAML escape hatch edits `content` directly.
    const [content, setContent] = useState(initialContent || '');
    const [savedContent, setSavedContent] = useState(initialContent || '');
    const [isSaving, setIsSaving] = useState(false);
    const [rawMode, setRawMode] = useState(false);
    const dirty = content !== savedContent;

    // Parse the current YAML into the form model. On parse error, fall back to
    // raw mode so the user can fix the underlying text instead of losing it.
    const parsedResult = useMemo(() => {
        try {
            return { ok: true as const, ...parseMasterResume(content) };
        } catch (err: any) {
            return { ok: false as const, error: err?.message || 'Could not parse resume', data: null, extraKeys: {} };
        }
    }, [content]);

    const handleFormChange = useCallback((next: ResumeData) => {
        const extraKeys = parsedResult.ok ? parsedResult.extraKeys : {};
        setContent(serializeMasterResume(next, extraKeys));
    }, [parsedResult]);

    // ── Upload-tab state (unchanged behavior) ───────────────────────
    const [stage, setStage] = useState<Stage>('idle');
    const [dragActive, setDragActive] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isUploadBusy = stage === 'uploading' || stage === 'parsing';

    const confirmDiscardIfDirty = useCallback(() => {
        if (!dirty) return true;
        return window.confirm('You have unsaved changes to your master resume. Discard them?');
    }, [dirty]);

    const handleClose = useCallback(() => {
        if (isUploadBusy) return;
        if (!confirmDiscardIfDirty()) return;
        onClose();
    }, [isUploadBusy, confirmDiscardIfDirty, onClose]);

    const handleSwitchTab = useCallback((next: Tab) => {
        if (next === tab) return;
        // Leaving Edit with unsaved changes → confirm.
        if (tab === 'edit' && next === 'upload' && !confirmDiscardIfDirty()) return;
        setTab(next);
    }, [tab, confirmDiscardIfDirty]);

    const handleSave = useCallback(async () => {
        if (!content.trim()) {
            toast.error('Master resume cannot be empty.');
            return;
        }
        if (!dirty || isSaving) return;
        setIsSaving(true);
        try {
            await saveMasterResume(content);
            setSavedContent(content);
            toast.success('Master resume saved');
        } catch (err: any) {
            toast.error(err?.message || 'Failed to save master resume');
        } finally {
            setIsSaving(false);
        }
    }, [content, dirty, isSaving]);

    const handleFileUpload = async (file?: File) => {
        if (!file) return;
        setError(null);
        setUploadedFileName(file.name);
        setStage('uploading');

        const parseTimer = setTimeout(() => {
            setStage((s) => (s === 'uploading' ? 'parsing' : s));
        }, 600);

        try {
            const newContent = await uploadMasterResume(file);
            clearTimeout(parseTimer);
            setStage('success');
            toast.success('Master resume saved');
            // Reload the editor with the converted result so it can be reviewed/fixed.
            setContent(newContent);
            setSavedContent(newContent);
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

    const stagedSteps = useMemo(() => STAGES, []);
    const currentStageIndex = stagedSteps.findIndex((s) => s.id === stage);

    return (
        <Modal
            onClose={handleClose}
            title={hasExisting ? 'Master resume' : 'Add your master resume'}
            subtitle={
                tab === 'edit'
                    ? 'Edit your resume below and save. Changes are stored exactly as written — no AI, no cost.'
                    : 'Upload a file to import. Non-YAML files are converted by the LLM and may be rephrased — review the result in the Edit tab afterward.'
            }
            maxWidth={tab === 'edit' ? 'max-w-4xl' : 'max-w-3xl'}
            closeOnBackdrop={!isUploadBusy && !dirty}
            headerAction={
                <div className="inline-flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-1 mr-1">
                    <TabButton active={tab === 'edit'} onClick={() => handleSwitchTab('edit')} icon={<Pencil size={13} />}>
                        Edit
                    </TabButton>
                    <TabButton active={tab === 'upload'} onClick={() => handleSwitchTab('upload')} icon={<UploadIcon size={13} />}>
                        Upload
                    </TabButton>
                </div>
            }
            footer={
                tab === 'edit' ? (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setRawMode((v) => !v)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 hover:text-white transition-colors"
                        >
                            <Code2 size={13} />
                            {rawMode ? 'Back to form' : 'Edit raw YAML'}
                        </button>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={handleClose}>
                                Close
                            </Button>
                            <Button
                                variant="primary"
                                size="md"
                                onClick={handleSave}
                                disabled={!dirty || isSaving || !content.trim()}
                                isLoading={isSaving}
                                icon={!isSaving ? <Save size={14} /> : undefined}
                            >
                                {dirty ? 'Save changes' : 'Saved'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-[11px] text-gray-500">
                            Accepted: .docx, .pdf, .txt, .md, .yaml — up to 10MB
                        </span>
                        <div className="flex items-center gap-2">
                            {stage === 'success' && (
                                <Button variant="secondary" size="sm" onClick={() => setStage('idle')} icon={<RefreshCw size={14} />}>
                                    Upload another
                                </Button>
                            )}
                            <Button
                                variant="primary"
                                size="md"
                                onClick={() => (stage === 'success' ? setTab('edit') : handleClose())}
                                disabled={isUploadBusy}
                                icon={stage === 'success' ? <Check size={14} /> : undefined}
                            >
                                {stage === 'success' ? 'Review in editor' : 'Close'}
                            </Button>
                        </div>
                    </div>
                )
            }
        >
            {tab === 'edit' ? (
                <div className="p-4 md:p-5">
                    {!parsedResult.ok && !rawMode && (
                        <div className="mb-3 px-3 py-2 rounded-lg bg-yellow-500/5 border border-yellow-500/15 text-yellow-300 text-xs flex items-start gap-2">
                            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                            <span>{parsedResult.error} — showing the raw YAML so you can fix it.</span>
                        </div>
                    )}
                    {rawMode || !parsedResult.ok ? (
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            spellCheck={false}
                            placeholder="Your master resume in YAML."
                            className="w-full h-[60vh] min-h-[320px] bg-black/30 border border-white/10 rounded-xl p-4 text-[13px] leading-relaxed text-gray-200 font-mono resize-none focus:outline-none focus:border-[#054F31] transition-colors whitespace-pre"
                            aria-label="Master resume YAML editor"
                        />
                    ) : (
                        <MasterResumeForm value={parsedResult.data} onChange={handleFormChange} />
                    )}
                </div>
            ) : (
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
                            isUploadBusy && 'pointer-events-none opacity-95',
                        )}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => !isUploadBusy && stage !== 'success' && fileInputRef.current?.click()}
                        style={{ cursor: isUploadBusy || stage === 'success' ? 'default' : 'pointer' }}
                        role="button"
                        tabIndex={isUploadBusy || stage === 'success' ? -1 : 0}
                        aria-label="Drop a resume file or click to choose"
                        onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && !isUploadBusy && stage !== 'success') {
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
                            {isUploadBusy ? (
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
                                    <h4 className="text-base font-bold text-white mb-1">Resume imported</h4>
                                    <p className="text-gray-400 text-sm max-w-sm">
                                        {uploadedFileName} is now your master resume. Open the Edit tab to review what
                                        the parser produced and fix anything it changed.
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
                                        <UploadIcon
                                            size={28}
                                            className={cn('text-gray-400 transition-colors', dragActive && 'text-[#FF4F00]')}
                                        />
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
            )}
        </Modal>
    );
};

interface TabButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    children: React.ReactNode;
}

const TabButton = ({ active, onClick, icon, children }: TabButtonProps) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
            active ? 'bg-gradient-tailr-soft text-white border border-[#FF4F00]/30' : 'text-gray-400 hover:text-white',
        )}
    >
        {icon}
        {children}
    </button>
);
