/**
 * src/lib/masterResume.ts — YAML ↔ typed model for the master resume editor.
 *
 * The master resume is stored as YAML and consumed by the LLM tailoring prompt.
 * The structured form editor edits a typed object; these helpers convert to/from
 * the on-disk YAML using js-yaml (already a project dependency). Save still goes
 * through PUT /api/master verbatim — no LLM, no cost.
 */

import yaml from 'js-yaml';
import type { ResumeData } from '../../shared/types';

/** A bullet as stored: text plus an optional bold lead-in. */
export interface EditableBullet {
    text: string;
    boldPrefix?: string;
}

const asString = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

function normalizeBullets(raw: unknown, withPrefix: boolean): EditableBullet[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((b: any) => {
        if (typeof b === 'string') return { text: b };
        const bullet: EditableBullet = { text: asString(b?.text) };
        if (withPrefix && b?.boldPrefix) bullet.boldPrefix = asString(b.boldPrefix);
        return bullet;
    });
}

/**
 * Parse stored YAML into a fully-populated ResumeData. Missing sections become
 * empty so the form never crashes on a partial file. Throws with a clear message
 * if the YAML itself is malformed.
 *
 * Returns the normalized data plus any unknown top-level keys so they can be
 * preserved on save.
 */
export function parseMasterResume(text: string): { data: ResumeData; extraKeys: Record<string, unknown> } {
    let parsed: any;
    try {
        parsed = yaml.load(text || '') ?? {};
    } catch (err: any) {
        throw new Error(`Could not read your resume (invalid YAML): ${err?.reason || err?.message || 'parse error'}`);
    }
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Could not read your resume — the file is not in the expected format.');
    }

    const data: ResumeData = {
        profile: asString(parsed.profile),
        skills: Array.isArray(parsed.skills)
            ? parsed.skills.map((s: any) => ({ category: asString(s?.category), items: asString(s?.items) }))
            : [],
        experience: Array.isArray(parsed.experience)
            ? parsed.experience.map((e: any) => ({
                  company: asString(e?.company),
                  location: asString(e?.location),
                  title: asString(e?.title),
                  dates: asString(e?.dates),
                  bullets: normalizeBullets(e?.bullets, true),
              }))
            : [],
        projects: Array.isArray(parsed.projects)
            ? parsed.projects.map((p: any) => ({
                  name: asString(p?.name),
                  tech: p?.tech ? asString(p.tech) : '',
                  bullets: normalizeBullets(p?.bullets, false),
              }))
            : [],
        education: Array.isArray(parsed.education)
            ? parsed.education.map((ed: any) => ({
                  institution: asString(ed?.institution),
                  location: asString(ed?.location),
                  degree: asString(ed?.degree),
                  gpa: ed?.gpa ? asString(ed.gpa) : undefined,
                  graduation: ed?.graduation ? asString(ed.graduation) : undefined,
                  coursework: ed?.coursework ? asString(ed.coursework) : undefined,
                  honors: Array.isArray(ed?.honors) ? ed.honors.map(asString) : [],
              }))
            : [],
        certifications: Array.isArray(parsed.certifications)
            ? parsed.certifications.map((c: any) => ({
                  name: asString(c?.name),
                  issuer: c?.issuer ? asString(c.issuer) : undefined,
                  date: c?.date ? asString(c.date) : undefined,
              }))
            : [],
        awards: Array.isArray(parsed.awards)
            ? parsed.awards.map((a: any) => ({
                  name: asString(a?.name),
                  issuer: a?.issuer ? asString(a.issuer) : undefined,
                  date: a?.date ? asString(a.date) : undefined,
                  description: a?.description ? asString(a.description) : undefined,
              }))
            : [],
        volunteer: Array.isArray(parsed.volunteer)
            ? parsed.volunteer.map((v: any) => ({
                  organization: asString(v?.organization),
                  role: v?.role ? asString(v.role) : undefined,
                  dates: v?.dates ? asString(v.dates) : undefined,
                  bullets: normalizeBullets(v?.bullets, false),
              }))
            : [],
    };

    // Preserve any top-level keys we don't model so save() never silently drops them.
    const known = new Set([
        'profile', 'skills', 'experience', 'projects', 'education', 'certifications', 'awards', 'volunteer',
    ]);
    const extraKeys: Record<string, unknown> = {};
    for (const k of Object.keys(parsed)) {
        if (!known.has(k)) extraKeys[k] = parsed[k];
    }

    return { data, extraKeys };
}

/** Strip empty optional fields/sections so the saved YAML stays clean. */
function compact(data: ResumeData): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (data.profile.trim()) out.profile = data.profile.trim();

    const skills = data.skills.filter((s) => s.category.trim() || s.items.trim());
    if (skills.length) out.skills = skills;

    const experience = data.experience
        .filter((e) => e.company.trim() || e.title.trim())
        .map((e) => ({
            company: e.company,
            location: e.location,
            title: e.title,
            dates: e.dates,
            bullets: e.bullets
                .filter((b) => b.text.trim())
                .map((b) => (b.boldPrefix?.trim() ? { boldPrefix: b.boldPrefix, text: b.text } : { text: b.text })),
        }));
    if (experience.length) out.experience = experience;

    const projects = data.projects
        .filter((p) => p.name.trim())
        .map((p) => {
            const proj: Record<string, unknown> = { name: p.name };
            if (p.tech && String(p.tech).trim()) proj.tech = p.tech;
            proj.bullets = p.bullets.filter((b) => b.text.trim()).map((b) => ({ text: b.text }));
            return proj;
        });
    if (projects.length) out.projects = projects;

    const education = data.education
        .filter((e) => e.institution.trim() || e.degree.trim())
        .map((e) => {
            const ed: Record<string, unknown> = {
                institution: e.institution,
                location: e.location,
                degree: e.degree,
            };
            if (e.gpa?.trim()) ed.gpa = e.gpa;
            if (e.graduation?.trim()) ed.graduation = e.graduation;
            if (e.coursework?.trim()) ed.coursework = e.coursework;
            const honors = (e.honors || []).filter((h) => h.trim());
            if (honors.length) ed.honors = honors;
            return ed;
        });
    if (education.length) out.education = education;

    const certifications = (data.certifications || []).filter((c) => c.name.trim()).map((c) => {
        const cert: Record<string, unknown> = { name: c.name };
        if (c.issuer?.trim()) cert.issuer = c.issuer;
        if (c.date?.trim()) cert.date = c.date;
        return cert;
    });
    if (certifications.length) out.certifications = certifications;

    const awards = (data.awards || []).filter((a) => a.name.trim()).map((a) => {
        const award: Record<string, unknown> = { name: a.name };
        if (a.issuer?.trim()) award.issuer = a.issuer;
        if (a.date?.trim()) award.date = a.date;
        if (a.description?.trim()) award.description = a.description;
        return award;
    });
    if (awards.length) out.awards = awards;

    const volunteer = (data.volunteer || []).filter((v) => v.organization.trim()).map((v) => {
        const vol: Record<string, unknown> = { organization: v.organization };
        if (v.role?.trim()) vol.role = v.role;
        if (v.dates?.trim()) vol.dates = v.dates;
        const bullets = (v.bullets || []).filter((b) => b.text.trim()).map((b) => ({ text: b.text }));
        if (bullets.length) vol.bullets = bullets;
        return vol;
    });
    if (volunteer.length) out.volunteer = volunteer;

    return out;
}

/** Serialize the typed model back to YAML for verbatim save. */
export function serializeMasterResume(data: ResumeData, extraKeys: Record<string, unknown> = {}): string {
    const obj = { ...compact(data), ...extraKeys };
    return yaml.dump(obj, {
        lineWidth: -1, // never hard-wrap long bullet strings
        quotingType: '"',
        forceQuotes: false,
        noRefs: true,
        sortKeys: false,
    });
}
