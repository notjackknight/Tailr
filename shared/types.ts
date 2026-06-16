/**
 * shared/types.ts — Canonical type definitions shared between server and client.
 *
 * Single source of truth for all data shapes that cross the API boundary.
 */

// ── User Profile (contact info shown on the resume) ─────────
export interface UserProfileLink {
    label: string;  // "GitHub", "LinkedIn", "Portfolio", etc.
    value: string;  // "github.com/username" or full URL
}

export interface UserProfile {
    name: string;
    location: string;
    phone: string;
    email: string;
    links: UserProfileLink[];
}

// ── User Preferences (tailoring config) ─────────────────────
export interface PinnedExperience {
    /** Match against `experience[].company` in the master resume. */
    company: string;
    /** Why this role must always appear (helps the LLM weight it). */
    note?: string;
}

export interface UserPreferences {
    /**
     * Writing tone for the tailored resume. `auto` lets the model infer the
     * best-fitting tone from the job description during content selection.
     */
    tone: 'auto' | 'professional' | 'concise' | 'impact-driven' | 'technical' | 'leadership';
    /** Target page count (currently only 1 is supported end-to-end). */
    targetPageLength: 1;
    /**
     * Companies whose roles should always appear on the tailored resume,
     * regardless of JD fit. Useful for current employer or flagship role.
     */
    pinnedExperience: PinnedExperience[];
    /** Free-text guidance sent to the tailoring prompt verbatim. */
    additionalGuidance: string;
}

// ── LLM Provider ────────────────────────────────────────────
export type LlmProvider = 'gemini' | 'anthropic' | 'openai';

export interface LlmCredentials {
    provider: LlmProvider;
    apiKey: string;
}

// ── Resume Data (what the HTML template + DOCX consume) ─────
export interface ResumeBullet {
    boldPrefix?: string;
    text: string;
}

export interface ResumeExperience {
    company: string;
    location: string;
    title: string;
    dates: string;
    bullets: ResumeBullet[];
}

export interface ResumeProject {
    name: string;
    tech?: string | null;
    bullets: Array<{ text: string }>;
}

export interface ResumeEducation {
    institution: string;
    location: string;
    degree: string;
    minor?: string;
    gpa?: string;
    graduation?: string;
    honors?: string[];
    coursework?: string;
}

export interface ResumeCertification {
    name: string;
    issuer?: string;
    date?: string;
}

export interface ResumeAward {
    name: string;
    issuer?: string;
    date?: string;
    description?: string;
}

export interface ResumeVolunteer {
    organization: string;
    role?: string;
    dates?: string;
    bullets?: Array<{ text: string }>;
}

export interface ResumeData {
    profile: string;
    skills: Array<{ category: string; items: string }>;
    experience: ResumeExperience[];
    projects: ResumeProject[];
    education: ResumeEducation[];
    /** Optional sections — included on the rendered resume only when populated. */
    certifications?: ResumeCertification[];
    awards?: ResumeAward[];
    volunteer?: ResumeVolunteer[];
}

// ── Gemini API Response ─────────────────────────────────────
export interface FitAssessment {
    score: number;
    reasoning: string;
    stretchAreas: string[];
    atsKeywords: string[];
    company: string;
    role: string;
    /**
     * The writing tone applied to this resume. When the user's tone preference
     * is `auto`, this is the tone the model chose for the JD; otherwise it
     * echoes the explicit preference. Optional — absent on records generated
     * before this field existed.
     */
    chosenTone?: string;
}

/** Raw shape returned by Gemini (snake_case) — mapped to FitAssessment at the server boundary. */
export interface RawFitAssessment {
    score: number;
    reasoning: string;
    stretch_areas: string[];
    keyword_overlap: string[];
    company: string;
    role: string;
    /** Resolved writing tone (see FitAssessment.chosenTone). Optional. */
    chosen_tone?: string;
}

export interface ContentSelectionResult {
    fit_assessment: RawFitAssessment;
    resume_data: ResumeData;
}

// ── Pipeline Events (SSE) ───────────────────────────────────
export interface ProgressEvent {
    step: string;
    message: string;
    iteration?: number;
    remainingLines?: number;
}

export interface GenerationResult {
    id: number;
    fitAssessment: FitAssessment;
    pdfFilename: string;
    fillStatus: string;
    iterations: number;
    kind: GenerationKind;
    /** Short, human LinkedIn cold DM to send with the resume. '' if none. */
    outreachDm: string;
}

// ── Database Record ─────────────────────────────────────────
/**
 * Discriminator for what kind of resume a generation represents.
 * 'tailored'         — written against a specific job description (default)
 * 'linkedin-default' — broad, recruiter-facing default resume; no JD
 */
export type GenerationKind = 'tailored' | 'linkedin-default';

export interface GenerationRecord {
    id: number;
    company: string;
    role: string;
    score: number;
    reasoning: string;
    stretch_areas: string;   // JSON string in DB
    ats_keywords: string;    // JSON string in DB
    job_description: string;
    resume_data_json: string; // JSON string in DB
    pdf_filename: string;
    fill_status: string;
    iterations: number;
    kind: GenerationKind;
    outreach_dm: string;
    /** Resolved writing tone for this generation. '' on pre-existing records. */
    chosen_tone: string;
    created_at: string;
}

// ── Render Result ───────────────────────────────────────────
export interface RenderResult {
    success: boolean;
    pages: number;
    pdfPath: string;
    docxPath: string;
    pdfBuffer: Buffer;
    fileSizeKB: number;
    contentHeightIn: number;
    availableHeightIn: number;
    remainingSpaceIn: number;
    remainingLines: number;
    fillStatus: 'perfect' | 'has_space' | 'overflow';
}

// ── Client-Side History Entry (what the API returns) ────────
export interface HistoryEntry {
    id: number;
    company: string;
    role: string;
    score: number;
    reasoning: string;
    stretch_areas: string;
    ats_keywords: string;
    pdf_filename: string;
    fill_status: string;
    iterations: number;
    kind: GenerationKind;
    outreach_dm: string;
    /** Resolved writing tone for this generation. '' on pre-existing records. */
    chosen_tone: string;
    created_at: string;
}

// ── Dashboard ───────────────────────────────────────────────
export interface DashboardStats {
    totalGenerations: number;
    averageScore: number;
    topCompany: string;
    scoreTrend: Array<{ date: string; score: number }>;
    roleDistribution: Array<{ role: string; count: number }>;
}

// ── Job Title Recommendations ───────────────────────────────
/**
 * Tier reflects how attainable a title is *right now* for this candidate.
 * Used by the prompt to stop over-ranking impressive-sounding titles and
 * by the UI to group/badge recommendations.
 */
export type JobTitleTier = 'realistic' | 'low_hanging_fruit' | 'reach' | 'long_term_fit';

export interface JobTitleRecommendation {
    title: string;
    tier: JobTitleTier;
    reasoning: string;
}

export interface JobTitleResult {
    titles: JobTitleRecommendation[];
    generatedAt: string;
}

// ── Client config payload (GET /api/config) ─────────────────
export interface AppConfig {
    profile: UserProfile;
    preferences: UserPreferences;
    profileConfigured: boolean;
    masterResumePresent: boolean;
    apiKeyConfigured: boolean;
}
