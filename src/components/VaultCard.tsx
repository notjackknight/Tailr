import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3,
  Eye,
  Download,
  Trash2,
  Clock,
  MoreVertical,
  Sparkles,
} from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { ScoreRing } from './ui/ScoreRing';
import { downloadResume, formatRelativeDate } from '../lib/utils';
import type { HistoryEntry } from '../../shared/types';

interface VaultCardProps {
  entry: HistoryEntry;
  contactName: string;
  onAnalysis: (entry: HistoryEntry) => void;
  onPreview: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
  key?: React.Key | null;
}

export const VaultCard = ({
  entry,
  contactName,
  onAnalysis,
  onPreview,
  onDelete,
}: VaultCardProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <GlassCard
      hoverEffect
      radius="lg"
      padding="md"
      className="group relative"
    >
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-base font-bold border border-white/10">
          {entry.company[0]?.toUpperCase()}
        </div>
        <ScoreRing score={entry.score} size={44} strokeWidth={3.5} animate={false} />
      </div>

      {entry.kind === 'linkedin-default' && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 mb-1.5 rounded-md bg-[#FF4F00]/10 text-[#FF8A4F] border border-[#FF4F00]/30 text-[10px] font-semibold uppercase tracking-wider"
          title="Broad summary resume — works well as a LinkedIn default"
        >
          <Sparkles size={10} />
          Summary
        </span>
      )}
      <h3 className="font-semibold text-base text-white leading-tight truncate" title={entry.role}>
        {entry.role}
      </h3>
      <p className="text-gray-400 text-sm mb-3 truncate" title={entry.company}>
        {entry.company}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-white/5 gap-2">
        <span className="text-xs text-gray-500 flex items-center gap-1 min-w-0">
          <Clock size={12} className="shrink-0" />
          <span className="truncate">{formatRelativeDate(entry.created_at)}</span>
        </span>

        {/* Inline actions: visible on mobile, hover-revealed on desktop */}
        <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
          <IconAction
            label="View analysis"
            onClick={() => onAnalysis(entry)}
            icon={<BarChart3 size={14} />}
          />
          <IconAction
            label="Preview PDF"
            onClick={() => onPreview(entry)}
            icon={<Eye size={14} />}
          />
          <IconAction
            label="Download PDF"
            onClick={() =>
              downloadResume(entry.pdf_filename, entry.company, 'pdf', contactName)
            }
            icon={
              <span className="flex items-center gap-1 text-[10px] font-bold tracking-wide">
                PDF
                <Download size={12} />
              </span>
            }
          />
          <IconAction
            label="Download DOCX"
            onClick={() =>
              downloadResume(entry.pdf_filename, entry.company, 'docx', contactName)
            }
            icon={
              <span className="flex items-center gap-1 text-[10px] font-bold tracking-wide">
                DOCX
                <Download size={12} />
              </span>
            }
          />
          <IconAction
            label="Delete generation"
            danger
            onClick={() => onDelete(entry)}
            icon={<Trash2 size={14} />}
          />
        </div>

        {/* Compact kebab fallback for very narrow widths (<400px-ish cards) */}
        <div ref={menuRef} className="relative md:hidden -mr-1">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="More actions"
            aria-expanded={menuOpen}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00]"
          >
            <MoreVertical size={14} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 bottom-full mb-1 w-44 rounded-xl border border-white/10 bg-[#0A0A0A] shadow-2xl p-1 z-20"
                role="menu"
              >
                <MenuItem onClick={() => { onAnalysis(entry); setMenuOpen(false); }}>
                  <BarChart3 size={14} /> View analysis
                </MenuItem>
                <MenuItem onClick={() => { onPreview(entry); setMenuOpen(false); }}>
                  <Eye size={14} /> Preview PDF
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    downloadResume(entry.pdf_filename, entry.company, 'pdf', contactName);
                    setMenuOpen(false);
                  }}
                >
                  <Download size={14} /> Download PDF
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    downloadResume(entry.pdf_filename, entry.company, 'docx', contactName);
                    setMenuOpen(false);
                  }}
                >
                  <Download size={14} /> Download DOCX
                </MenuItem>
                <div className="my-1 h-px bg-white/5" />
                <MenuItem
                  danger
                  onClick={() => {
                    onDelete(entry);
                    setMenuOpen(false);
                  }}
                >
                  <Trash2 size={14} /> Delete
                </MenuItem>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </GlassCard>
  );
};

interface IconActionProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

const IconAction = ({ label, icon, onClick, danger }: IconActionProps) => (
  // Hide on mobile (kebab menu handles those), show on md+
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className={
      'hidden md:inline-flex items-center justify-center min-h-[32px] min-w-[32px] p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] ' +
      (danger
        ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
        : 'text-gray-400 hover:text-white hover:bg-white/10')
    }
  >
    {icon}
  </button>
);

interface MenuItemProps {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

const MenuItem = ({ children, onClick, danger }: MenuItemProps) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className={
      'w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-lg transition-colors text-left ' +
      (danger
        ? 'text-red-400 hover:bg-red-500/10'
        : 'text-gray-200 hover:bg-white/5')
    }
  >
    {children}
  </button>
);
