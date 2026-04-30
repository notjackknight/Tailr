# Tailr — Resume Optimizer

Tailr takes your master resume and any job description, then generates a tailored, ATS-friendly, single-page PDF and DOCX. Built around a deterministic page-fitting loop and an LLM-driven content selector that tries hard not to fabricate experience.

> ⚠ **Disclaimer:** Tailr re-orders, re-phrases, and trims content from your master resume to match a job description. It does **not** invent experience, employers, dates, metrics, or skills. Always proofread before submitting.

## Why this exists

Resume tailoring is repetitive and high-stakes — most candidates either skip it or spend an hour per role. Tailr automates the mechanical parts (selecting relevant bullets, mirroring JD vocabulary, fitting one page) while leaving the truthfulness guardrails strict.

## Features

- **Upload** your resume (`.docx`, `.pdf`, `.txt`, `.md`, `.yaml`) — Tailr parses it into a structured master.
- **Paste** any job description.
- **Tailored output** — profile, skills, experience bullets, projects, education, certifications, awards, and volunteer sections — selected and rewritten for the JD.
- **One-page guarantee** — Puppeteer renders, measures, and a deterministic loop trims overflow until the PDF is exactly one page.
- **Twin formats** — same content, parallel `.pdf` and `.docx` outputs.
- **Fit analysis** — score 1–10, reasoning, ATS keywords matched, stretch areas to address in a cover letter.
- **Job-title recommendations** — top 10 search keywords derived from your master resume.
- **Outreach helper** — generates likely hiring-manager personas + a personalized LinkedIn message for any company/role.
- **Settings UI** — choose tone (`professional`, `concise`, `impact-driven`, `technical`, `leadership`), pin must-include experiences, and add free-text guidance.
- **Bring-your-own-key + multi-provider** — pick Gemini, Anthropic Claude, or OpenAI ChatGPT, paste your key, done. Keys live in browser localStorage and travel as per-request headers. Never persisted server-side.
- **Local-only** — your resume never leaves your machine except as text in LLM API calls. SQLite history lives at `data/tailr.db`.

## Tech stack

- **Frontend** — React 19, Vite, Tailwind 4, Framer Motion, Chart.js
- **Backend** — Node.js + Express, TypeScript, Mustache, Puppeteer, `docx`
- **AI** — Pluggable providers via the `server/llm.ts` adapter:
  - Google Gemini (`gemini-2.5-pro` / `gemini-2.5-flash`)
  - Anthropic Claude (`claude-sonnet-4-6` / `claude-haiku-4-5`)
  - OpenAI ChatGPT (`gpt-4o` / `gpt-4o-mini`)
- **Storage** — better-sqlite3 (history), JSON files (profile/preferences), YAML (master resume)

## Architecture

```
┌────────────┐  paste JD   ┌────────────┐  SSE   ┌────────────────────────┐
│  React UI  │ ──────────▶ │  Express   │ ─────▶ │ runPipeline()          │
└────────────┘             │   /api/    │        │ ┌────────────────────┐ │
        ▲                  └────────────┘        │ │ 1. scoreProjects   │ │
        │ progress events                        │ │ 2. selectContent   │ │
        │                                        │ │ 3. renderPdf       │ │
        │                                        │ │ 4. truncate→fit    │ │
        │                                        │ │ 5. generateDocx    │ │
        │                                        │ │ 6. saveToDB        │ │
        └────────────────────────────────────────┘ └────────────────────┘
```

Detailed walkthrough: [docs/architecture.md](docs/architecture.md). Prompt templates: [docs/prompting.md](docs/prompting.md). Sample workflow: [docs/examples.md](docs/examples.md).

## Local setup

### Prerequisites
- Node.js 20+
- An API key from one of:
  - [Google Gemini](https://aistudio.google.com/apikey) (has a free tier)
  - [Anthropic Claude](https://console.anthropic.com/settings/keys)
  - [OpenAI](https://platform.openai.com/api-keys)

### Install
```bash
git clone <your-fork-url>
cd "Resume Optimizer"
npm install
```

### Run
```bash
npm start              # starts Express API (3001) + Vite dev server (5173) concurrently
```

Open http://localhost:5173. If 5173 is taken, Vite picks the next free port — check the terminal output for the actual URL.

### First-time flow
1. Open **Settings** → **LLM Provider & API Key**. Pick Gemini, Anthropic Claude, or OpenAI ChatGPT, paste your key, save. Keys are stored only in your browser's localStorage and sent to the local server as per-request headers — never persisted server-side. Switching providers preserves all keys you've entered.
2. Fill in your name, email, location, and any links (GitHub, LinkedIn, portfolio). Save.
3. **Dashboard** → **Upload Master Resume** → choose your existing resume file.
4. Tailr parses it into structured YAML at `data/master_resume.yaml`. Edit later via **Update Master**.
5. **Studio** → paste a job description → **Tailr My Resume**.
6. Review the fit score, ATS keywords, and download the PDF or DOCX.

## Environment variables

Tailr is **bring-your-own-key**: the LLM API key lives in the in-app Settings panel (browser localStorage), not in `.env`. The only env var the server reads is the optional `PORT`.

| Variable | Required | Description                            |
|----------|----------|----------------------------------------|
| `PORT`   | No       | API server port. Defaults to `3001`.   |

The frontend Vite dev server proxies `/api/*` to `localhost:3001` — see [vite.config.ts](vite.config.ts).

## Customizing tailoring behavior

Tailr keeps user-specific behavior in three local files (all gitignored):

- `data/profile.json` — name, email, location, links shown on the resume.
- `data/preferences.json` — tone, pinned experiences, free-text guidance.
- `data/master_resume.yaml` — your structured resume content.

Edit these from the **Settings** view, or directly. Server reads them on demand — no restart needed.

Prompt templates live at `prompts/*.md` — edit them directly to change the LLM's instructions. See [docs/prompting.md](docs/prompting.md) for variables.

## Known limitations

- **Single page only** — multi-page output isn't supported end-to-end yet. The deterministic truncation loop is built around a fixed US Letter page.
- **Single user** — no auth, no multi-tenancy. The SQLite DB is shared with whoever can run the local server.
- **No undo for master resume edits** — saving overwrites `data/master_resume.yaml`. If you edit by hand, keep a backup.
- **Layout is opinionated** — Times New Roman 11pt, 0.5"/0.3" margins, fixed section order. Section visibility is dynamic, but typography is not.
- **Spelling/grammar** — Tailr trusts your master resume. It will not fix typos.

## Future improvements

- Multi-page mode for more senior candidates.
- Resume diff view: which bullets changed vs. the master, side-by-side.
- Cover-letter generator from the same master + JD inputs.
- Theme picker (font / spacing / accent color).
- Optional desktop packaging (Tauri / Electron) for a true offline-friendly install.

## Notes for recruiters & interviewers

If you're reviewing this as a portfolio project, the most interesting bits are:

- **Multi-provider LLM adapter** — [server/llm.ts](server/llm.ts) — one `generateJson()` / `generateText()` interface over Gemini, Claude, and OpenAI; picks the right SDK and model per request. The domain wrappers in [server/llmCalls.ts](server/llmCalls.ts) never know which provider is in play.
- **The two-phase tailoring pipeline** — [server/llmCalls.ts](server/llmCalls.ts) — projects are scored in a focused first pass before the resume-generation prompt sees them, so the model can't shortcut by picking the most "impressive-sounding" project regardless of fit.
- **The deterministic page-fitting loop** — [server/renderer.ts](server/renderer.ts) and [server/pipeline.ts](server/pipeline.ts) — Puppeteer renders, measures content height, and `performDeterministicTruncation` walks an explicit priority order to trim until the PDF is one page. No LLM calls in the inner loop.
- **HTML-to-DOCX parity** — [server/docx.ts](server/docx.ts) — the Word document is built from the same `ResumeData` and uses the Puppeteer-measured content height to keep section spacing in lockstep with the PDF.
- **Truthfulness guardrails** — see [prompts/content-selector.md](prompts/content-selector.md) and [prompts/resume-parser.md](prompts/resume-parser.md). Both explicitly forbid fabricating experience, dates, metrics, employers, or credentials.
- **Streaming UI** — Server-Sent Events stream pipeline progress to the browser in real time; see `runPipeline` in [server/pipeline.ts](server/pipeline.ts) and `generateResume` in [src/lib/api.ts](src/lib/api.ts).

## License

MIT — see [LICENSE](LICENSE) if added. Use it however you like; this is a portfolio project, not a hosted product.
