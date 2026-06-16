import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { ScoreRing } from '../components/ui/ScoreRing';
import { Spinner } from '../components/ui/Spinner';
import {
  Sparkles,
  Download,
  RefreshCw,
  Target,
  AlertTriangle,
  Tag,
  Eye,
  ClipboardPaste,
  ChevronLeft,
  Settings as SettingsIcon,
  Send,
  ExternalLink,
  Layers,
  FileText,
  Plus,
  X,
  CheckCircle2,
} from 'lucide-react';
import { cn, downloadResume, formatTone } from '../lib/utils';
import { generateResume } from '../lib/api';
import { toast } from '../components/ui/Toast';
import { ColdDmBlock } from '../components/ColdDmBlock';
import {
  useBatchQueue,
  makeEmptyEntry,
  isEntryValid,
  MIN_JD_LENGTH,
  type BatchEntry,
  type BatchJob,
} from '../hooks/useBatchQueue';
import type { GenerationResult, AppConfig } from '../../shared/types';

interface StudioProps {
  config: AppConfig | null;
  hasApiKey: boolean;
  onNavigate?: (view: 'dashboard' | 'studio' | 'settings' | 'vault') => void;
}

type StudioMode = 'single' | 'batch';

/**
 * Studio — thin wrapper that switches between the original single-JD flow
 * (SingleStudio, behavior unchanged) and the concurrent batch flow (BatchStudio).
 */
export const Studio = (props: StudioProps) => {
  const [mode, setMode] = useState<StudioMode>('single');
  const canGenerate = props.hasApiKey && (props.config?.masterResumePresent ?? false);

  return (
    <div className="flex flex-col gap-4 md:gap-6 flex-1">
      {/* Mode toggle — only shown once setup is complete, to avoid clutter on first run. */}
      {canGenerate && (
        <div className="flex justify-center md:justify-start">
          <div className="inline-flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-1">
            <button
              type="button"
              onClick={() => setMode('single')}
              aria-pressed={mode === 'single'}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                mode === 'single'
                  ? 'bg-gradient-tailr-soft text-white border border-[#FF4F00]/30'
                  : 'text-gray-400 hover:text-white',
              )}
            >
              <FileText size={14} /> Single
            </button>
            <button
              type="button"
              onClick={() => setMode('batch')}
              aria-pressed={mode === 'batch'}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                mode === 'batch'
                  ? 'bg-gradient-tailr-soft text-white border border-[#FF4F00]/30'
                  : 'text-gray-400 hover:text-white',
              )}
            >
              <Layers size={14} /> Batch
            </button>
          </div>
        </div>
      )}

      {mode === 'single' ? <SingleStudio {...props} /> : <BatchStudio {...props} />}
    </div>
  );
};

type StudioStage = 'input' | 'generating' | 'result';

const SingleStudio = ({ config, hasApiKey, onNavigate }: StudioProps) => {
  const [jobDescription, setJobDescription] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [previousJD, setPreviousJD] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [mobileResultView, setMobileResultView] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [activeTab, setActiveTab] = useState<'preview' | 'metrics'>('preview');
  const contactName = config?.profile?.name || 'Resume';
  const canGenerate = hasApiKey && (config?.masterResumePresent ?? false);

  // Autofocus textarea on desktop only — would invoke the keyboard on mobile.
  useEffect(() => {
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop && !result) textareaRef.current?.focus();
  }, [result]);

  const stage: StudioStage = result ? 'result' : isGenerating ? 'generating' : 'input';

  const handleGenerate = useCallback(async () => {
    if (!jobDescription.trim() || isGenerating || !canGenerate) return;

    setIsGenerating(true);
    setResult(null);
    setError(null);
    setStatusMessage('Connecting...');
    setActiveTab('preview');
    setMobileResultView(true);
    setPreviousJD(jobDescription);

    abortRef.current = new AbortController();

    try {
      await generateResume(
        jobDescription.trim(),
        companyName.trim() || undefined,
        {
          onProgress: (message) => setStatusMessage(message),
          onComplete: (genResult) => {
            setResult(genResult);
            setStatusMessage('');
            toast.success(`Tailored resume ready — fit score ${genResult.fitAssessment.score}/10`);
          },
          onError: (message) => {
            setError(message);
            setStatusMessage('');
            setIsGenerating(false);
            toast.error(message);
          },
        },
        abortRef.current.signal,
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const msg = err.message || 'Generation failed';
        setError(msg);
        setStatusMessage('');
        toast.error(msg);
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [jobDescription, isGenerating, canGenerate, companyName]);

  const handleReset = useCallback(() => {
    setResult(null);
    setError(null);
    setStatusMessage('');
    // Keep the previous JD as a draft so the user can iterate.
    setJobDescription(previousJD || jobDescription);
    setMobileResultView(true);
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [previousJD, jobDescription]);

  const handleRegenerate = useCallback(() => {
    if (!previousJD) return;
    setJobDescription(previousJD);
    setResult(null);
    handleGenerate();
  }, [previousJD, handleGenerate]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setJobDescription((prev) => (prev ? `${prev}\n${text}` : text));
        toast.success('Pasted from clipboard');
      }
    } catch {
      toast.error('Could not access clipboard. Paste manually.');
    }
  };

  // Cmd/Ctrl + Enter shortcut.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleGenerate();
    }
  };

  const blockReason = !hasApiKey
    ? 'Add an LLM API key in Settings before generating.'
    : !config?.masterResumePresent
    ? 'Upload your master resume from the Dashboard before generating.'
    : null;

  // ── INPUT STAGE ───────────────────────────────────────────────────
  if (stage === 'input') {
    return (
      <div className="flex flex-col gap-4 md:gap-6 flex-1">
        <header className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-1.5">
              Tailor a resume
            </h1>
            <p className="text-sm md:text-base text-gray-400">
              Paste a job description below. We'll match it to your master resume.
            </p>
          </div>
        </header>

        <GlassCard variant="featured" radius="xl" padding="none" className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 relative flex flex-col">
            <textarea
              ref={textareaRef}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Paste the full job description here. Include responsibilities, requirements, and tech stack — the more context, the better the match."
              className="flex-1 min-h-[280px] md:min-h-[400px] w-full bg-transparent p-5 md:p-7 text-base leading-relaxed text-white placeholder:text-gray-600 resize-none focus:outline-none font-sans"
              spellCheck={false}
              aria-label="Job description"
            />

            <AnimatePresence>
              {(error || blockReason) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-white/5"
                >
                  <div
                    className={cn(
                      'px-5 md:px-7 py-3 text-sm flex items-start gap-2',
                      error
                        ? 'text-red-300 bg-red-500/5'
                        : 'text-yellow-300 bg-yellow-500/5',
                    )}
                  >
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span className="flex-1">{error || blockReason}</span>
                    {error && (
                      <button
                        onClick={() => {
                          setError(null);
                          handleGenerate();
                        }}
                        className="text-xs font-semibold underline hover:no-underline"
                      >
                        Retry
                      </button>
                    )}
                    {!error && blockReason && onNavigate && (
                      <button
                        onClick={() =>
                          onNavigate(hasApiKey ? 'dashboard' : 'settings')
                        }
                        className="text-xs font-semibold underline hover:no-underline"
                      >
                        Fix it
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Toolbar / options + generate */}
          <div className="border-t border-white/5 bg-white/[0.02] px-4 md:px-5 py-3 md:py-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ClipboardPaste size={14} />}
                  onClick={handlePaste}
                  type="button"
                >
                  Paste
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<SettingsIcon size={14} />}
                  onClick={() => setShowOptions((v) => !v)}
                  aria-expanded={showOptions}
                  type="button"
                >
                  {showOptions ? 'Hide options' : 'Options'}
                </Button>
                {jobDescription && (
                  <span className="hidden sm:inline text-[11px] text-gray-600 ml-2">
                    {jobDescription.length.toLocaleString()} chars
                  </span>
                )}
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={handleGenerate}
                disabled={!jobDescription.trim() || isGenerating || !canGenerate}
                isLoading={isGenerating}
                icon={!isGenerating ? <Sparkles size={16} /> : undefined}
              >
                Tailor resume
              </Button>
            </div>

            <AnimatePresence initial={false}>
              {showOptions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 mt-3 border-t border-white/5">
                    <label
                      htmlFor="company-name"
                      className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 block"
                    >
                      Company name
                    </label>
                    <input
                      id="company-name"
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Optional — overrides the company extracted from the JD"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#054F31] transition-colors"
                      disabled={isGenerating}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ── GENERATING STAGE ─────────────────────────────────────────────
  if (stage === 'generating') {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center max-w-md text-center px-4">
          <div className="w-72 h-96 bg-white/[0.04] rounded-2xl border border-white/10 relative overflow-hidden mb-8">
            <div className="p-6 space-y-3">
              <div className="h-4 bg-white/10 rounded w-3/4" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
              <div className="space-y-2 mt-6">
                <div className="h-2 bg-white/5 rounded w-full" />
                <div className="h-2 bg-white/5 rounded w-full" />
                <div className="h-2 bg-white/5 rounded w-5/6" />
                <div className="h-2 bg-white/5 rounded w-4/6 mt-4" />
                <div className="h-2 bg-white/5 rounded w-full" />
                <div className="h-2 bg-white/5 rounded w-3/4" />
              </div>
            </div>

            {/* Scanning beam sweeping down the sheet while tailoring. */}
            <motion.div
              aria-hidden
              className="absolute left-0 right-0 pointer-events-none"
              initial={{ top: '-20%' }}
              animate={{ top: ['-20%', '100%'] }}
              transition={{ duration: 1.6, ease: 'linear', repeat: Infinity }}
            >
              {/* soft glow band */}
              <div className="h-24 -mt-12 bg-gradient-to-b from-transparent via-[#054F31]/25 to-transparent" />
              {/* crisp scan line */}
              <div className="h-px w-full bg-[#054F31] shadow-[0_0_12px_2px_rgba(5,79,49,0.7)]" />
            </motion.div>
          </div>

          <div className="h-7 overflow-hidden relative">
            <AnimatePresence mode="wait">
              <motion.p
                key={statusMessage}
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -14, opacity: 0 }}
                className="text-sm font-mono uppercase tracking-widest font-bold whitespace-nowrap"
                style={{ color: '#054F31' }}
              >
                {statusMessage || 'Initializing…'}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULT STAGE ─────────────────────────────────────────────────
  if (!result) return null;

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Result header — score + meta + actions */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <ScoreRing score={result.fitAssessment.score} size={56} strokeWidth={4} />
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-bold text-white truncate leading-tight">
              {result.fitAssessment.role}
            </h1>
            <p className="text-xs md:text-sm text-gray-400 truncate">
              {result.fitAssessment.company}
              <span className="hidden sm:inline">
                {' '}
                · Fit score {result.fitAssessment.score}/10
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={() =>
              downloadResume(result.pdfFilename, result.fitAssessment.company, 'pdf', contactName)
            }
          >
            PDF
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={() =>
              downloadResume(result.pdfFilename, result.fitAssessment.company, 'docx', contactName)
            }
          >
            DOCX
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={handleRegenerate}
            disabled={!previousJD || isGenerating}
            title="Generate again with the same JD"
          >
            <span className="hidden sm:inline">Regenerate</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Send size={14} />}
            onClick={handleReset}
          >
            New
          </Button>
        </div>
      </header>

      {/* Mobile pane switcher */}
      <div className="md:hidden">
        <div className="inline-flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-1 w-full">
          <button
            type="button"
            onClick={() => setMobileResultView(true)}
            className={cn(
              'flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
              mobileResultView ? 'bg-gradient-tailr-soft text-white border border-[#FF4F00]/30' : 'text-gray-400',
            )}
          >
            Resume preview
          </button>
          <button
            type="button"
            onClick={() => setMobileResultView(false)}
            className={cn(
              'flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
              !mobileResultView ? 'bg-gradient-tailr-soft text-white border border-[#FF4F00]/30' : 'text-gray-400',
            )}
          >
            Analysis
          </button>
        </div>
      </div>

      {/* Main result body */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        {/* Analysis panel */}
        <div className={cn('flex flex-col lg:w-[360px] xl:w-[400px] shrink-0', !mobileResultView ? '' : 'hidden md:flex')}>
          <GlassCard padding="none" radius="lg" className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <Target size={14} className="text-[#FF4F00]" />
              <span className="text-sm font-semibold text-white">Analysis</span>
            </div>
            <div className="overflow-y-auto p-4 md:p-5 space-y-5">
              <div>
                <h4 className="text-[11px] uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                  <Target size={12} /> Why this fits
                </h4>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {result.fitAssessment.reasoning}
                </p>
                {result.fitAssessment.chosenTone && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FF4F00]/10 text-[#FF4F00] border border-[#FF4F00]/20 text-xs font-medium">
                    <Sparkles size={12} />
                    Tone: {formatTone(result.fitAssessment.chosenTone)}
                  </div>
                )}
              </div>

              {result.outreachDm?.trim() && <ColdDmBlock dm={result.outreachDm} />}

              {result.fitAssessment.atsKeywords.length > 0 && (
                <div>
                  <h4 className="text-[11px] uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                    <Tag size={12} /> ATS keywords matched ({result.fitAssessment.atsKeywords.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {result.fitAssessment.atsKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 text-xs font-medium rounded-full bg-neon-green/10 text-neon-green border border-neon-green/20"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.fitAssessment.stretchAreas.length > 0 && (
                <div>
                  <h4 className="text-[11px] uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={12} /> Stretch areas ({result.fitAssessment.stretchAreas.length})
                  </h4>
                  <div className="space-y-2">
                    {result.fitAssessment.stretchAreas.map((area, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-xl"
                      >
                        <AlertTriangle size={12} className="mt-0.5 shrink-0 text-yellow-400" />
                        <span className="text-xs text-yellow-200/90 leading-relaxed">{area}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* PDF preview */}
        <div className={cn('flex-1 flex flex-col min-h-0', mobileResultView ? '' : 'hidden md:flex')}>
          <GlassCard padding="none" radius="lg" className="flex-1 flex flex-col overflow-hidden bg-white/[0.02]">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-gray-400" />
                <span className="text-sm font-semibold text-white">PDF preview</span>
              </div>
              {/* Mobile-friendly: open in new tab if iframe is hard to read */}
              <a
                href={`/api/resume/${result.pdfFilename}`}
                target="_blank"
                rel="noreferrer"
                className="md:hidden text-[11px] text-gray-400 hover:text-white inline-flex items-center gap-1 underline-offset-2 hover:underline"
              >
                Open in new tab <ExternalLink size={11} />
              </a>
            </div>
            <div className="flex-1 bg-white">
              <iframe
                src={`/api/resume/${result.pdfFilename}#toolbar=0&view=FitH`}
                className="w-full h-full border-0 min-h-[420px] md:min-h-[600px]"
                title="Tailored resume preview"
              />
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Footer hint — link back to dashboard */}
      {onNavigate && (
        <div className="text-xs text-gray-500 text-center">
          Saved to your{' '}
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="text-[#FF4F00] hover:text-[#FF6B1F] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] rounded"
          >
            Dashboard
            <ChevronLeft size={11} className="inline rotate-180 ml-0.5" />
          </button>
          .
        </div>
      )}

      {isGenerating && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-2 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-2xl text-xs">
          <Spinner size={14} className="text-[#FF4F00]" />
          <span className="text-gray-200">{statusMessage || 'Regenerating…'}</span>
        </div>
      )}
    </div>
  );
};

// ── BATCH STUDIO ───────────────────────────────────────────────────
//
// Tailor several JDs at once. Each entry runs through the SAME generation
// pipeline as Single mode (via useBatchQueue), capped at a small number of
// concurrent jobs. Completed resumes save to the Vault automatically.

const BatchStudio = ({ config, hasApiKey, onNavigate }: StudioProps) => {
  const [entries, setEntries] = useState<BatchEntry[]>(() => [makeEmptyEntry(), makeEmptyEntry()]);
  const { jobs, isRunning, runAll, cancelJob, cancelAll, clearJobs } = useBatchQueue();
  const contactName = config?.profile?.name || 'Resume';
  const canGenerate = hasApiKey && (config?.masterResumePresent ?? false);

  const validCount = entries.filter(isEntryValid).length;
  const hasResults = jobs.length > 0;

  const updateEntry = useCallback((id: string, patch: Partial<BatchEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const addEntry = useCallback(() => {
    setEntries((prev) => [...prev, makeEmptyEntry()]);
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => (prev.length > 1 ? prev.filter((e) => e.id !== id) : prev));
  }, []);

  const handleRunAll = useCallback(() => {
    if (validCount === 0 || isRunning || !canGenerate) return;
    void runAll(entries);
  }, [entries, validCount, isRunning, canGenerate, runAll]);

  const blockReason = !hasApiKey
    ? 'Add an LLM API key in Settings before generating.'
    : !config?.masterResumePresent
    ? 'Upload your master resume from the Dashboard before generating.'
    : null;

  const doneCount = jobs.filter((j) => j.status === 'done').length;
  const errorCount = jobs.filter((j) => j.status === 'error').length;
  const activeCount = jobs.filter((j) => j.status === 'queued' || j.status === 'running').length;

  return (
    <div className="flex flex-col gap-4 md:gap-6 flex-1">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-1.5">
            Tailor a batch
          </h1>
          <p className="text-sm md:text-base text-gray-400">
            Paste several job descriptions. We'll tailor them in parallel and save each to your Vault.
          </p>
        </div>
      </header>

      {blockReason && (
        <div className="px-4 py-3 text-sm flex items-start gap-2 rounded-xl text-yellow-300 bg-yellow-500/5 border border-yellow-500/10">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1">{blockReason}</span>
          {onNavigate && (
            <button
              onClick={() => onNavigate(hasApiKey ? 'dashboard' : 'settings')}
              className="text-xs font-semibold underline hover:no-underline"
            >
              Fix it
            </button>
          )}
        </div>
      )}

      {/* ── EDITING: JD entry form (hidden once a batch has started) ── */}
      {!hasResults && (
        <>
          <div className="flex flex-col gap-3">
            {entries.map((entry, i) => {
              const valid = isEntryValid(entry);
              const len = entry.jobDescription.trim().length;
              return (
                <GlassCard key={entry.id} radius="lg" padding="none" className="overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
                    <span className="text-xs font-semibold text-gray-300">
                      Job {i + 1}
                      {entry.companyName.trim() && (
                        <span className="text-gray-500 font-normal"> · {entry.companyName.trim()}</span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {len > 0 && (
                        <span className={cn('text-[11px]', valid ? 'text-gray-600' : 'text-yellow-500/80')}>
                          {valid ? `${len.toLocaleString()} chars` : `${len}/${MIN_JD_LENGTH} min`}
                        </span>
                      )}
                      {entries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEntry(entry.id)}
                          className="text-gray-500 hover:text-red-400 transition-colors"
                          aria-label={`Remove job ${i + 1}`}
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    value={entry.jobDescription}
                    onChange={(e) => updateEntry(entry.id, { jobDescription: e.target.value })}
                    placeholder="Paste the full job description here…"
                    className="w-full min-h-[120px] bg-transparent p-4 text-sm leading-relaxed text-white placeholder:text-gray-600 resize-y focus:outline-none"
                    spellCheck={false}
                    aria-label={`Job description ${i + 1}`}
                  />
                  <div className="px-4 pb-3">
                    <input
                      type="text"
                      value={entry.companyName}
                      onChange={(e) => updateEntry(entry.id, { companyName: e.target.value })}
                      placeholder="Company name (optional — overrides the company extracted from the JD)"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-[#054F31] transition-colors"
                    />
                  </div>
                </GlassCard>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={addEntry} type="button">
              Add another
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleRunAll}
              disabled={validCount === 0 || !canGenerate}
              icon={<Sparkles size={16} />}
            >
              Tailor all ({validCount})
            </Button>
          </div>
        </>
      )}

      {/* ── RUNNING / DONE: compact status bar + results grid ── */}
      {hasResults && (
        <div className="flex flex-col gap-4">
          <GlassCard radius="lg" padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
              <div className="flex items-center gap-3 text-sm">
                {isRunning ? (
                  <Spinner size={16} className="text-[#FF4F00]" />
                ) : (
                  <CheckCircle2 size={18} className="text-green-400" />
                )}
                <span className="font-semibold text-white">
                  {isRunning ? `Tailoring ${jobs.length} resume${jobs.length > 1 ? 's' : ''}…` : 'Batch complete'}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-2.5">
                  {activeCount > 0 && <span>{activeCount} in progress</span>}
                  {doneCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-green-400">
                      <CheckCircle2 size={12} /> {doneCount}
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-red-400">
                      <AlertTriangle size={12} /> {errorCount}
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isRunning ? (
                  <Button variant="secondary" size="sm" icon={<X size={14} />} onClick={cancelAll}>
                    Cancel all
                  </Button>
                ) : (
                  <>
                    {onNavigate && doneCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => onNavigate('dashboard')}>
                        View in Vault
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Plus size={14} />}
                      onClick={() => {
                        clearJobs();
                        setEntries([makeEmptyEntry(), makeEmptyEntry()]);
                      }}
                    >
                      New batch
                    </Button>
                  </>
                )}
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {jobs.map((job, i) => (
              <BatchResultCard
                key={job.id}
                job={job}
                index={i}
                contactName={contactName}
                onCancel={() => cancelJob(job.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface BatchResultCardProps {
  job: BatchJob;
  index: number;
  contactName: string;
  onCancel: () => void;
}

const BatchResultCard: React.FC<BatchResultCardProps> = ({ job, index, contactName, onCancel }) => {
  const result = job.result;
  const label = job.companyName || result?.fitAssessment.company || `Job ${index + 1}`;

  return (
    <GlassCard radius="lg" padding="none" className="overflow-hidden flex flex-col">
      <div className="flex items-center gap-3 p-4">
        {/* Status indicator / score */}
        <div className="shrink-0">
          {job.status === 'done' && result ? (
            <ScoreRing score={result.fitAssessment.score} size={48} strokeWidth={4} />
          ) : job.status === 'error' ? (
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Spinner size={18} className="text-[#FF4F00]" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-white truncate">
            {job.status === 'done' && result ? result.fitAssessment.role : label}
          </h4>
          <p className="text-xs text-gray-400 truncate">
            {job.status === 'done' && result ? (
              <>
                {result.fitAssessment.company} · Fit {result.fitAssessment.score}/10
              </>
            ) : job.status === 'error' ? (
              <span className="text-red-400">{job.error || 'Failed'}</span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                {job.statusMessage || 'Working…'}
              </span>
            )}
          </p>
        </div>

        {/* Cancel button while in flight */}
        {(job.status === 'queued' || job.status === 'running') && (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
            aria-label="Cancel this job"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Download actions on completion */}
      {job.status === 'done' && result && (
        <div className="flex items-center gap-1.5 px-4 pb-4 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={() => downloadResume(result.pdfFilename, result.fitAssessment.company, 'pdf', contactName)}
          >
            PDF
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={() => downloadResume(result.pdfFilename, result.fitAssessment.company, 'docx', contactName)}
          >
            DOCX
          </Button>
          <a
            href={`/api/resume/${result.pdfFilename}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-[11px] text-gray-400 hover:text-white inline-flex items-center gap-1 underline-offset-2 hover:underline"
          >
            Preview <ExternalLink size={11} />
          </a>
        </div>
      )}

      {job.status === 'done' && result?.outreachDm?.trim() && (
        <div className="px-4 pb-4">
          <ColdDmBlock dm={result.outreachDm} variant="compact" />
        </div>
      )}
    </GlassCard>
  );
};
