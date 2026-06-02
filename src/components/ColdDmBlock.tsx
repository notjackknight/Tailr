/**
 * ColdDmBlock — displays the generated LinkedIn cold DM with a copy button.
 *
 * Shared across the single Studio result, batch result cards, and the Vault
 * analysis view so the message looks and copies the same everywhere.
 */

import React, { useCallback, useState } from 'react';
import { MessageSquare, Copy, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from './ui/Toast';

interface ColdDmBlockProps {
  dm: string;
  /** 'panel' = full bordered block (single result / vault); 'compact' = inline on a card. */
  variant?: 'panel' | 'compact';
  className?: string;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts / older browsers.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export const ColdDmBlock = ({ dm, variant = 'panel', className }: ColdDmBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const ok = await copyText(dm);
    if (ok) {
      setCopied(true);
      toast.success('DM copied');
      setTimeout(() => setCopied(false), 1800);
    } else {
      toast.error('Could not copy. Select and copy manually.');
    }
  }, [dm]);

  if (!dm?.trim()) return null;

  const CopyButton = (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF4F00] hover:text-[#FF6B1F] transition-colors focus-visible:outline-none"
      aria-label="Copy cold DM to clipboard"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );

  if (variant === 'compact') {
    return (
      <div className={cn('rounded-xl bg-white/[0.03] border border-white/10 p-3', className)}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-gray-400 flex items-center gap-1">
            <MessageSquare size={11} /> Cold DM
          </span>
          {CopyButton}
        </div>
        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{dm}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <h4 className="text-[11px] uppercase tracking-wider text-gray-400 mb-2 flex items-center justify-between gap-1.5">
        <span className="flex items-center gap-1.5">
          <MessageSquare size={12} /> Cold DM to send
        </span>
        {CopyButton}
      </h4>
      <div className="rounded-xl bg-[#FF4F00]/[0.04] border border-[#FF4F00]/15 p-3.5">
        <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{dm}</p>
      </div>
    </div>
  );
};
