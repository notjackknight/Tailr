# Architecture

## High-level flow

```
User pastes JD → Express /api/generate (SSE) → runPipeline()
  ├─ scoreProjects()       (Gemini Flash, JSON mode)
  ├─ selectContent()       (Gemini Pro,   JSON mode)
  ├─ populateTemplate()    (Mustache → HTML)
  ├─ renderPdf()           (Puppeteer  → PDF + content-height measurement)
  ├─ generateDocx()        (docx       → DOCX with adaptive spacing)
  ├─ performDeterministic
  │  Truncation()          (loop until pages === 1)
  └─ insertGeneration()    (better-sqlite3)
```

## Pipeline stages

### 1. Input collection
- `src/views/Studio.tsx` — JD textarea, optional company override.
- Validation: minimum ~50 characters before submit; setup banner if API key, profile, or master resume is missing.

### 2. Project scoring (`server/llmCalls.ts:scoreProjects`)
- Pulls the `projects:` block out of the master YAML with a line-by-line walker (works regardless of which section follows).
- Sends to the user's chosen "fast" model (Gemini Flash / Claude Haiku / GPT-4o-mini) with `prompts/project-scorer.md`. JSON-mode response when supported.
- Returns `[{ name, score, reasoning }]` for every project.

### 3. Project selection (`selectTopProjects`)
- Sorts by score, picks up to 3.
- Generic diversity heuristic: skips a project if its `tech` string overlaps >70% of tokens with an already-selected project. Replaces the prior hardcoded conflict-pair list.

### 4. Content selection (`selectContent`)
- Master resume YAML is passed through `filterMasterResumeProjects` so only the selected projects make it into the prompt.
- Loads `prompts/content-selector.md`, appends the filtered YAML and the `preferences.json` block.
- The user's chosen "smart" model (Gemini Pro / Claude Sonnet / GPT-4o) returns `{ fit_assessment, resume_data }` — see `shared/types.ts:ContentSelectionResult`.

### 5. Render
- `populateTemplate(resumeData)` — Mustache renders `templates/resume.html` with section-visibility flags (`hasSkills`, `hasCertifications`, etc.) so empty sections vanish.
- `renderPdf(html, filename, resumeData)` — opens a Puppeteer page, measures the natural content height of `.resume-container`, then prints a fixed-height PDF.
- `generateDocx(resumeData, contentHeightPx)` — builds a DOCX with the same content; uses the Puppeteer-measured height to set adaptive between-section spacing so the Word document matches the PDF.

### 6. Truncation loop (`performDeterministicTruncation`)
Runs entirely client-side in the server (no LLM calls). Each call removes one item, in this priority order:

1. Last bullet of the last project (keep ≥1)
2. Last bullet of the last experience (keep ≥1)
3. Last volunteer entry
4. Last award
5. Last certification
6. Last project entirely
7. Last skill category
8. Oldest experience entry (keep ≥1)

Loop terminates when `pages === 1`, when truncation can't make further cuts (idempotency check), or after 30 iterations as a hard ceiling.

### 7. Persistence
- Generated PDF + DOCX written to `output/`.
- Row inserted into `generations` table in `data/tailr.db` via better-sqlite3.

## Key files

| File                          | Responsibility                                    |
|-------------------------------|---------------------------------------------------|
| `server/index.ts`             | Express routes                                    |
| `server/pipeline.ts`          | Orchestrator; yields SSE events                   |
| `server/llm.ts`               | Provider-agnostic adapter (Gemini/Claude/OpenAI)  |
| `server/llmCalls.ts`          | Domain-specific LLM call wrappers (4 entry points)|
| `server/renderer.ts`          | HTML population + Puppeteer PDF + truncation       |
| `server/docx.ts`              | DOCX generator with adaptive spacing              |
| `server/userConfig.ts`        | Loads/saves profile.json + preferences.json       |
| `server/db.ts`                | better-sqlite3 schema + CRUD + dashboard stats    |
| `server/browser.ts`           | Puppeteer browser singleton                       |
| `prompts/*.md`                | All LLM prompt templates                          |
| `templates/resume.html`       | Mustache template for the rendered resume         |
| `shared/types.ts`             | Single source of truth for every data shape       |
| `src/App.tsx`                 | Top-level routing + setup state                   |
| `src/views/{Dashboard,Studio,Settings}.tsx` | Three primary views                  |
| `src/components/SetupBanner.tsx` | Onboarding nag bar                             |

## Data files (all gitignored)

| File                        | Created when                  | Purpose                                |
|-----------------------------|-------------------------------|----------------------------------------|
| `data/profile.json`         | First Settings save           | Contact info on every resume           |
| `data/preferences.json`     | First Settings save           | Tone, pinned experiences, guidance     |
| `data/master_resume.yaml`   | First master resume upload    | Structured YAML resume                 |
| `data/job_titles.json`      | First job-title generation    | Cached top-10 titles                   |
| `data/tailr.db`             | First successful generation   | History + dashboard stats              |

## Boundary contract: what crosses the wire

- **Frontend ↔ Backend** — JSON over `fetch` for normal calls; Server-Sent Events for the streaming `/api/generate`. All shapes live in `shared/types.ts` and are imported by both sides.
- **Backend ↔ Gemini** — JSON-mode where supported. All prompts are Markdown files in `prompts/` cached at first read.
- **Backend ↔ Filesystem** — `data/` for inputs, `output/` for artifacts, `uploads/` for transient multer files (deleted after parse).
