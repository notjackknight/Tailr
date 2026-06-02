/**
 * MasterResumeForm — structured editor for the master resume.
 *
 * Controlled component: receives a ResumeData `value` and emits changes via
 * `onChange`. No YAML is shown here — the modal handles YAML ↔ model conversion
 * (see src/lib/masterResume.ts). Sections mirror the resume schema, with
 * add/remove on every list and collapsed "add" affordances for the optional
 * sections (certifications, awards, volunteer).
 */

import React from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { cn } from '../lib/utils';
import type { ResumeData } from '../../shared/types';

interface MasterResumeFormProps {
    value: ResumeData;
    onChange: (next: ResumeData) => void;
}

// ── Small field primitives ──────────────────────────────────────────

const Field = ({
    label, value, onChange, placeholder, className,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) => (
    <label className={cn('block', className)}>
        <span className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">{label}</span>
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#054F31] transition-colors"
        />
    </label>
);

const Area = ({
    label, value, onChange, placeholder, rows = 2,
}: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) => (
    <label className="block">
        {label && <span className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">{label}</span>}
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            spellCheck
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#054F31] transition-colors resize-y leading-relaxed"
        />
    </label>
);

const SectionHeader = ({ title, count, onAdd, addLabel }: { title: string; count?: number; onAdd?: () => void; addLabel?: string }) => (
    <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">
            {title}
            {typeof count === 'number' && count > 0 && <span className="text-gray-500 font-normal"> · {count}</span>}
        </h3>
        {onAdd && (
            <button
                type="button"
                onClick={onAdd}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF4F00] hover:text-[#FF6B1F] transition-colors"
            >
                <Plus size={13} /> {addLabel || 'Add'}
            </button>
        )}
    </div>
);

const RemoveBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <button
        type="button"
        onClick={onClick}
        className="shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        aria-label={label}
    >
        <Trash2 size={14} />
    </button>
);

const MoveBtns = ({ onUp, onDown, canUp, canDown }: { onUp: () => void; onDown: () => void; canUp: boolean; canDown: boolean }) => (
    <div className="flex flex-col">
        <button type="button" onClick={onUp} disabled={!canUp} aria-label="Move up"
            className="p-0.5 text-gray-600 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
            <ChevronUp size={14} />
        </button>
        <button type="button" onClick={onDown} disabled={!canDown} aria-label="Move down"
            className="p-0.5 text-gray-600 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
            <ChevronDown size={14} />
        </button>
    </div>
);

// Immutable list helpers
function replaceAt<T>(arr: T[], i: number, v: T): T[] { const c = arr.slice(); c[i] = v; return c; }
function removeAt<T>(arr: T[], i: number): T[] { const c = arr.slice(); c.splice(i, 1); return c; }
function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return arr;
    const c = arr.slice(); [c[i], c[j]] = [c[j], c[i]]; return c;
}

// ── Form ─────────────────────────────────────────────────────────────

export const MasterResumeForm = ({ value, onChange }: MasterResumeFormProps) => {
    const patch = (p: Partial<ResumeData>) => onChange({ ...value, ...p });

    return (
        <div className="space-y-5">
            {/* Profile */}
            <GlassCard radius="lg" padding="md">
                <SectionHeader title="Professional summary" />
                <Area
                    value={value.profile}
                    onChange={(v) => patch({ profile: v })}
                    placeholder="2–4 sentence summary that tops your resume."
                    rows={4}
                />
            </GlassCard>

            {/* Skills */}
            <GlassCard radius="lg" padding="md">
                <SectionHeader
                    title="Skills"
                    count={value.skills.length}
                    addLabel="Add category"
                    onAdd={() => patch({ skills: [...value.skills, { category: '', items: '' }] })}
                />
                <div className="space-y-3">
                    {value.skills.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 rounded-xl bg-white/[0.02] border border-white/5 p-3">
                            <div className="flex-1 space-y-2">
                                <Field label="Category" value={s.category}
                                    onChange={(v) => patch({ skills: replaceAt(value.skills, i, { ...s, category: v }) })}
                                    placeholder="e.g. Languages & Frameworks" />
                                <Area label="Items (comma-separated)" value={s.items}
                                    onChange={(v) => patch({ skills: replaceAt(value.skills, i, { ...s, items: v }) })}
                                    placeholder="Python, TypeScript, React, …" />
                            </div>
                            <RemoveBtn onClick={() => patch({ skills: removeAt(value.skills, i) })} label="Remove skill category" />
                        </div>
                    ))}
                    {value.skills.length === 0 && <Empty>No skills yet.</Empty>}
                </div>
            </GlassCard>

            {/* Experience */}
            <GlassCard radius="lg" padding="md">
                <SectionHeader
                    title="Experience"
                    count={value.experience.length}
                    addLabel="Add job"
                    onAdd={() => patch({ experience: [...value.experience, { company: '', location: '', title: '', dates: '', bullets: [] }] })}
                />
                <div className="space-y-3">
                    {value.experience.map((e, i) => (
                        <div key={i} className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
                            <div className="flex items-start gap-2">
                                <MoveBtns
                                    onUp={() => patch({ experience: move(value.experience, i, -1) })}
                                    onDown={() => patch({ experience: move(value.experience, i, 1) })}
                                    canUp={i > 0} canDown={i < value.experience.length - 1} />
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <Field label="Company" value={e.company} onChange={(v) => patch({ experience: replaceAt(value.experience, i, { ...e, company: v }) })} />
                                    <Field label="Title" value={e.title} onChange={(v) => patch({ experience: replaceAt(value.experience, i, { ...e, title: v }) })} />
                                    <Field label="Location" value={e.location} onChange={(v) => patch({ experience: replaceAt(value.experience, i, { ...e, location: v }) })} />
                                    <Field label="Dates" value={e.dates} onChange={(v) => patch({ experience: replaceAt(value.experience, i, { ...e, dates: v }) })} placeholder="Jan 2020 – Present" />
                                </div>
                                <RemoveBtn onClick={() => patch({ experience: removeAt(value.experience, i) })} label="Remove job" />
                            </div>
                            <BulletList
                                bullets={e.bullets}
                                allowPrefix
                                onChange={(bullets) => patch({ experience: replaceAt(value.experience, i, { ...e, bullets }) })}
                            />
                        </div>
                    ))}
                    {value.experience.length === 0 && <Empty>No experience yet.</Empty>}
                </div>
            </GlassCard>

            {/* Projects */}
            <GlassCard radius="lg" padding="md">
                <SectionHeader
                    title="Projects"
                    count={value.projects.length}
                    addLabel="Add project"
                    onAdd={() => patch({ projects: [...value.projects, { name: '', tech: '', bullets: [] }] })}
                />
                <div className="space-y-3">
                    {value.projects.map((p, i) => (
                        <div key={i} className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
                            <div className="flex items-start gap-2">
                                <MoveBtns
                                    onUp={() => patch({ projects: move(value.projects, i, -1) })}
                                    onDown={() => patch({ projects: move(value.projects, i, 1) })}
                                    canUp={i > 0} canDown={i < value.projects.length - 1} />
                                <div className="flex-1 space-y-2">
                                    <Field label="Name" value={p.name} onChange={(v) => patch({ projects: replaceAt(value.projects, i, { ...p, name: v }) })} />
                                    <Field label="Tech" value={p.tech || ''} onChange={(v) => patch({ projects: replaceAt(value.projects, i, { ...p, tech: v }) })} placeholder="React, Node.js, PostgreSQL" />
                                </div>
                                <RemoveBtn onClick={() => patch({ projects: removeAt(value.projects, i) })} label="Remove project" />
                            </div>
                            <BulletList
                                bullets={p.bullets}
                                onChange={(bullets) => patch({ projects: replaceAt(value.projects, i, { ...p, bullets }) })}
                            />
                        </div>
                    ))}
                    {value.projects.length === 0 && <Empty>No projects yet.</Empty>}
                </div>
            </GlassCard>

            {/* Education */}
            <GlassCard radius="lg" padding="md">
                <SectionHeader
                    title="Education"
                    count={value.education.length}
                    addLabel="Add school"
                    onAdd={() => patch({ education: [...value.education, { institution: '', location: '', degree: '', honors: [] }] })}
                />
                <div className="space-y-3">
                    {value.education.map((ed, i) => (
                        <div key={i} className="flex items-start gap-2 rounded-xl bg-white/[0.02] border border-white/5 p-3">
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Field label="Institution" value={ed.institution} onChange={(v) => patch({ education: replaceAt(value.education, i, { ...ed, institution: v }) })} />
                                <Field label="Location" value={ed.location} onChange={(v) => patch({ education: replaceAt(value.education, i, { ...ed, location: v }) })} />
                                <Field label="Degree" value={ed.degree} onChange={(v) => patch({ education: replaceAt(value.education, i, { ...ed, degree: v }) })} className="sm:col-span-2" />
                                <Field label="GPA" value={ed.gpa || ''} onChange={(v) => patch({ education: replaceAt(value.education, i, { ...ed, gpa: v }) })} />
                                <Field label="Graduation" value={ed.graduation || ''} onChange={(v) => patch({ education: replaceAt(value.education, i, { ...ed, graduation: v }) })} placeholder="May 2024" />
                                <Field label="Honors (comma-separated)" value={(ed.honors || []).join(', ')}
                                    onChange={(v) => patch({ education: replaceAt(value.education, i, { ...ed, honors: v.split(',').map((h) => h.trim()).filter(Boolean) }) })}
                                    className="sm:col-span-2" />
                                <Field label="Relevant coursework" value={ed.coursework || ''} onChange={(v) => patch({ education: replaceAt(value.education, i, { ...ed, coursework: v }) })} className="sm:col-span-2" />
                            </div>
                            <RemoveBtn onClick={() => patch({ education: removeAt(value.education, i) })} label="Remove school" />
                        </div>
                    ))}
                    {value.education.length === 0 && <Empty>No education yet.</Empty>}
                </div>
            </GlassCard>

            {/* Optional: Certifications */}
            <OptionalSection
                title="Certifications"
                items={value.certifications || []}
                addLabel="Add certification"
                onAddFirst={() => patch({ certifications: [{ name: '' }] })}
                onAdd={() => patch({ certifications: [...(value.certifications || []), { name: '' }] })}
                render={(c, i, list) => (
                    <div key={i} className="flex items-start gap-2 rounded-xl bg-white/[0.02] border border-white/5 p-3">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Field label="Name" value={c.name} onChange={(v) => patch({ certifications: replaceAt(list, i, { ...c, name: v }) })} className="sm:col-span-1" />
                            <Field label="Issuer" value={c.issuer || ''} onChange={(v) => patch({ certifications: replaceAt(list, i, { ...c, issuer: v }) })} />
                            <Field label="Date" value={c.date || ''} onChange={(v) => patch({ certifications: replaceAt(list, i, { ...c, date: v }) })} />
                        </div>
                        <RemoveBtn onClick={() => patch({ certifications: removeAt(list, i) })} label="Remove certification" />
                    </div>
                )}
            />

            {/* Optional: Awards */}
            <OptionalSection
                title="Awards"
                items={value.awards || []}
                addLabel="Add award"
                onAddFirst={() => patch({ awards: [{ name: '' }] })}
                onAdd={() => patch({ awards: [...(value.awards || []), { name: '' }] })}
                render={(a, i, list) => (
                    <div key={i} className="flex items-start gap-2 rounded-xl bg-white/[0.02] border border-white/5 p-3">
                        <div className="flex-1 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <Field label="Name" value={a.name} onChange={(v) => patch({ awards: replaceAt(list, i, { ...a, name: v }) })} />
                                <Field label="Issuer" value={a.issuer || ''} onChange={(v) => patch({ awards: replaceAt(list, i, { ...a, issuer: v }) })} />
                                <Field label="Date" value={a.date || ''} onChange={(v) => patch({ awards: replaceAt(list, i, { ...a, date: v }) })} />
                            </div>
                            <Field label="Description" value={a.description || ''} onChange={(v) => patch({ awards: replaceAt(list, i, { ...a, description: v }) })} />
                        </div>
                        <RemoveBtn onClick={() => patch({ awards: removeAt(list, i) })} label="Remove award" />
                    </div>
                )}
            />

            {/* Optional: Volunteer */}
            <OptionalSection
                title="Volunteer"
                items={value.volunteer || []}
                addLabel="Add volunteer role"
                onAddFirst={() => patch({ volunteer: [{ organization: '', bullets: [] }] })}
                onAdd={() => patch({ volunteer: [...(value.volunteer || []), { organization: '', bullets: [] }] })}
                render={(v, i, list) => (
                    <div key={i} className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
                        <div className="flex items-start gap-2">
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <Field label="Organization" value={v.organization} onChange={(val) => patch({ volunteer: replaceAt(list, i, { ...v, organization: val }) })} />
                                <Field label="Role" value={v.role || ''} onChange={(val) => patch({ volunteer: replaceAt(list, i, { ...v, role: val }) })} />
                                <Field label="Dates" value={v.dates || ''} onChange={(val) => patch({ volunteer: replaceAt(list, i, { ...v, dates: val }) })} />
                            </div>
                            <RemoveBtn onClick={() => patch({ volunteer: removeAt(list, i) })} label="Remove volunteer role" />
                        </div>
                        <BulletList
                            bullets={(v.bullets || []).map((b) => ({ text: b.text }))}
                            onChange={(bullets) => patch({ volunteer: replaceAt(list, i, { ...v, bullets }) })}
                        />
                    </div>
                )}
            />
        </div>
    );
};

// ── Sub-components ───────────────────────────────────────────────────

const Empty = ({ children }: { children: React.ReactNode }) => (
    <p className="text-xs text-gray-600 italic py-1">{children}</p>
);

interface BulletListProps {
    bullets: Array<{ text: string; boldPrefix?: string }>;
    allowPrefix?: boolean;
    onChange: (bullets: Array<{ text: string; boldPrefix?: string }>) => void;
}

const BulletList = ({ bullets, allowPrefix, onChange }: BulletListProps) => (
    <div className="mt-2 pl-2 border-l-2 border-white/5 space-y-2">
        {bullets.map((b, i) => (
            <div key={i} className="flex items-start gap-2">
                <div className="flex-1 space-y-1.5">
                    {allowPrefix && (
                        <input
                            type="text"
                            value={b.boldPrefix || ''}
                            onChange={(e) => onChange(replaceAt(bullets, i, { ...b, boldPrefix: e.target.value }))}
                            placeholder="Bold lead-in (optional, e.g. “Impact:”)"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-[#054F31] transition-colors"
                        />
                    )}
                    <textarea
                        value={b.text}
                        onChange={(e) => onChange(replaceAt(bullets, i, { ...b, text: e.target.value }))}
                        placeholder="Bullet text"
                        rows={2}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#054F31] transition-colors resize-y leading-relaxed"
                    />
                </div>
                <RemoveBtn onClick={() => onChange(removeAt(bullets, i))} label="Remove bullet" />
            </div>
        ))}
        <button
            type="button"
            onClick={() => onChange([...bullets, { text: '' }])}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-white transition-colors"
        >
            <Plus size={12} /> Add bullet
        </button>
    </div>
);

interface OptionalSectionProps<T> {
    title: string;
    items: T[];
    addLabel: string;
    onAddFirst: () => void;
    onAdd: () => void;
    render: (item: T, index: number, list: T[]) => React.ReactNode;
}

function OptionalSection<T>({ title, items, addLabel, onAddFirst, onAdd, render }: OptionalSectionProps<T>) {
    if (items.length === 0) {
        return (
            <button
                type="button"
                onClick={onAddFirst}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-3 text-xs font-semibold text-gray-500 hover:text-white hover:border-white/30 transition-colors"
            >
                <Plus size={14} /> Add {title.toLowerCase()}
            </button>
        );
    }
    return (
        <GlassCard radius="lg" padding="md">
            <SectionHeader title={title} count={items.length} addLabel={addLabel} onAdd={onAdd} />
            <div className="space-y-3">{items.map((item, i) => render(item, i, items))}</div>
        </GlassCard>
    );
}
