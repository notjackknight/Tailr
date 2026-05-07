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
} from 'lucide-react';
import { cn, downloadResume } from '../lib/utils';
import { generateResume } from '../lib/api';
import { toast } from '../components/ui/Toast';
import type { GenerationResult, AppConfig } from '../../shared/types';

interface StudioProps {
  config: AppConfig | null;
  hasApiKey: boolean;
  onNavigate?: (view: 'dashboard' | 'studio' | 'settings') => void;
}

type StudioStage = 'input' | 'generating' | 'result';

export const Studio = ({ config, hasApiKey, onNavigate }: StudioProps) => {
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
    ? 'Upload your master resume from the Library before generating.'
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
          {canGenerate && (
            <div className="hidden md:flex items-center gap-1 text-[11px] text-gray-500">
              <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300 font-mono">⌘</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300 font-mono">↵</kbd>
              to generate
            </div>
          )}
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
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#FF4F00]/30 to-transparent h-1/2 w-full animate-[scan_1.6s_linear_infinite]" />
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
          <p className="mt-4 text-xs text-gray-500">
            Tailoring usually takes 8–20 seconds.
          </p>
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
              </div>

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

      {/* Footer hint — link back to library */}
      {onNavigate && (
        <div className="text-xs text-gray-500 text-center">
          Saved to your{' '}
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="text-[#FF4F00] hover:text-[#FF6B1F] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] rounded"
          >
            Library
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
