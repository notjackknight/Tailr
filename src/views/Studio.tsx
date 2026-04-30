import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { ScoreRing } from '../components/ui/ScoreRing';
import { Sparkles, Download, ArrowRight, RefreshCw, Target, AlertTriangle, Tag, Eye } from 'lucide-react';
import { cn, downloadResume } from '../lib/utils';
import { generateResume } from '../lib/api';
import type { GenerationResult, AppConfig } from '../../shared/types';

interface StudioProps {
  config: AppConfig | null;
  hasApiKey: boolean;
}

export const Studio = ({ config, hasApiKey }: StudioProps) => {
  const [jobDescription, setJobDescription] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [activeTab, setActiveTab] = useState<'preview' | 'metrics'>('preview');
  const contactName = config?.profile?.name || 'Resume';
  const canGenerate = hasApiKey && (config?.masterResumePresent ?? false);

  const handleGenerate = useCallback(async () => {
    if (!jobDescription.trim() || isGenerating || !canGenerate) return;

    setIsGenerating(true);
    setResult(null);
    setError(null);
    setStatusMessage('Connecting...');
    setActiveTab('preview');

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
          },
          onError: (message) => {
            setError(message);
            setStatusMessage('');
            setIsGenerating(false);
          },
        },
        abortRef.current.signal,
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Generation failed');
        setStatusMessage('');
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
    setCompanyName('');
  }, []);

  const blockReason = !hasApiKey
    ? 'Add an LLM API key in Settings before generating.'
    : !config?.masterResumePresent
    ? 'Upload your master resume from the Dashboard before generating.'
    : null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:h-full">
      {/* LEFT */}
      <div className="flex-1 flex flex-col min-h-[500px] lg:h-full">
        <GlassCard className="flex-1 flex flex-col p-0 overflow-hidden border-white/10">
          <div className="p-6 border-b border-white/5 bg-white/[0.02]">
            <h2 className="text-2xl font-bold text-white">Job Description</h2>
            <p className="text-gray-400 text-sm mt-1">Paste the JD here. We'll handle the rest.</p>
          </div>

          <div className="flex-1 relative group">
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here (minimum ~50 characters)."
              className="w-full h-full bg-transparent p-6 text-base leading-relaxed text-white placeholder:text-gray-600 resize-none focus:outline-none focus:ring-0 font-sans"
              spellCheck={false}
              disabled={isGenerating}
              aria-label="Job description"
            />
            <div className="absolute inset-0 pointer-events-none border border-transparent group-focus-within:border-[#FF4F00]/20 transition-colors duration-500" />
          </div>

          <AnimatePresence>
            {(statusMessage || error || blockReason) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-white/5"
              >
                <div className={cn(
                  'px-6 py-3 text-sm font-mono',
                  error ? 'text-red-400 bg-red-500/5'
                    : blockReason ? 'text-yellow-300 bg-yellow-500/5'
                    : 'text-gray-400 bg-white/[0.02]',
                )}>
                  {error ? `⚠ ${error}` : blockReason ? `⚠ ${blockReason}` : `⟫ ${statusMessage}`}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="p-6 border-t border-white/5 bg-white/[0.02] space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-400 uppercase tracking-wider whitespace-nowrap" htmlFor="company-name">Company</label>
              <input
                id="company-name"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Optional — overrides the company extracted from the JD"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FF4F00]/30 transition-colors"
                disabled={isGenerating}
              />
            </div>
            <Button
              variant="primary"
              size="xl"
              onClick={handleGenerate}
              disabled={!jobDescription.trim() || isGenerating || !canGenerate}
              isLoading={isGenerating}
              icon={!isGenerating && <Sparkles size={20} />}
              className="w-full shadow-2xl shadow-[#FF4F00]/20"
            >
              {isGenerating ? 'Tailoring...' : 'Tailr My Resume'}
            </Button>
          </div>
        </GlassCard>
      </div>

      {/* RIGHT */}
      <div className="flex-1 min-h-[400px] lg:h-full lg:min-h-0">
        <GlassCard className="h-full p-0 relative overflow-hidden flex flex-col border-white/10 bg-[#0A0A0A]">
          <div className="flex-1 relative flex flex-col overflow-hidden">
            {!isGenerating && !result && (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-sm">
                  <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/10">
                    <ArrowRight className="text-gray-500" size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Ready to Tailr</h3>
                  <p className="text-gray-500">
                    Paste a job description on the left to generate your optimized resume.
                  </p>
                </div>
              </div>
            )}

            {isGenerating && (
              <div className="flex-1 flex flex-col items-center justify-center bg-transparent z-30">
                <div className="w-64 h-80 bg-white/5 rounded-lg border border-white/10 relative overflow-hidden mb-8">
                  <div className="p-6 space-y-4">
                    <div className="h-4 bg-white/10 rounded w-3/4" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                    <div className="space-y-2 mt-8">
                      <div className="h-2 bg-white/5 rounded w-full" />
                      <div className="h-2 bg-white/5 rounded w-full" />
                      <div className="h-2 bg-white/5 rounded w-5/6" />
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#FF4F00]/20 to-transparent h-1/2 w-full animate-[scan_1.5s_linear_infinite]" />
                </div>
                <div className="h-8 overflow-hidden relative">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={statusMessage}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -20, opacity: 0 }}
                      className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF4F00] to-cyan-500 font-mono text-sm tracking-widest uppercase font-bold whitespace-nowrap"
                    >
                      {statusMessage || 'Initializing...'}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            )}

            {result && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="flex-1 flex flex-col h-full bg-[#111]"
              >
                <div className="flex justify-between items-center p-4 border-b border-white/10 bg-black/60 relative z-10 shadow-lg">
                  <div className="flex items-center gap-3">
                    <ScoreRing score={result.fitAssessment.score} size={40} strokeWidth={3} />
                    <div className="hidden sm:block">
                      <span className="text-sm font-medium text-white block leading-tight truncate max-w-[200px]">
                        {result.fitAssessment.company}
                      </span>
                      <span className="text-xs text-gray-400 block truncate max-w-[200px]">
                        {result.fitAssessment.role}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant={activeTab === 'preview' ? 'primary' : 'secondary'}
                      size="sm"
                      icon={<Eye size={14} />}
                      onClick={() => setActiveTab(activeTab === 'preview' ? 'metrics' : 'preview')}
                    >
                      {activeTab === 'preview' ? 'Analysis' : 'Preview'}
                    </Button>
                    <Button variant="secondary" size="sm" icon={<Download size={14} />}
                      onClick={() => downloadResume(result.pdfFilename, result.fitAssessment.company, 'pdf', contactName)}>
                      PDF
                    </Button>
                    <Button variant="secondary" size="sm" icon={<Download size={14} />}
                      onClick={() => downloadResume(result.pdfFilename, result.fitAssessment.company, 'docx', contactName)}>
                      DOCX
                    </Button>
                    <Button variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={handleReset}>
                      New
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden relative">
                  {activeTab === 'metrics' && (
                    <div className="h-full overflow-y-auto">
                      <div className="max-w-2xl mx-auto p-8 space-y-8">
                        <div className="flex flex-col items-center gap-4 pb-8 border-b border-white/5">
                          <ScoreRing score={result.fitAssessment.score} size={100} strokeWidth={6} />
                          <div className="text-center">
                            <span className="text-2xl font-bold text-white block">Fit Score</span>
                            <span className="text-sm text-gray-500">{result.fitAssessment.score}/10 match</span>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                            <Target size={14} /> Analysis
                          </h4>
                          <p className="text-base text-gray-300 leading-relaxed">{result.fitAssessment.reasoning}</p>
                        </div>

                        {result.fitAssessment.atsKeywords.length > 0 && (
                          <div>
                            <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                              <Tag size={14} /> ATS Keywords Matched
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {result.fitAssessment.atsKeywords.map((kw, i) => (
                                <span key={i} className="px-3 py-1.5 text-sm font-medium rounded-full bg-neon-green/10 text-neon-green border border-neon-green/20">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {result.fitAssessment.stretchAreas.length > 0 && (
                          <div>
                            <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                              <AlertTriangle size={14} /> Stretch Areas
                            </h4>
                            <div className="space-y-3">
                              {result.fitAssessment.stretchAreas.map((area, i) => (
                                <div key={i} className="flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-xl">
                                  <span className="text-yellow-400 text-sm mt-0.5">⚠</span>
                                  <span className="text-sm text-yellow-200/80 leading-relaxed">{area}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'preview' && (
                    <div className="h-full bg-white">
                      <iframe
                        src={`/api/resume/${result.pdfFilename}#toolbar=0&view=FitH`}
                        className="w-full h-full border-0"
                        title="Tailored Resume Preview"
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
