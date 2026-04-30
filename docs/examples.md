# Examples

A walk-through of a typical session.

## 1. Pick a provider and add your API key

Open Settings → **LLM Provider & API Key**. Choose one:

- **Google Gemini** — has a generous free tier; default if you're unsure.
- **Anthropic Claude** — best Sonnet-tier reasoning; pay-as-you-go only.
- **OpenAI ChatGPT** — most familiar; pay-as-you-go.

Paste the key, hit Save. The key lives in your browser's localStorage and is sent to the local server only as a per-request header — never persisted server-side. You can switch providers later without losing previously-entered keys.

## 2. Set up your profile

Open Settings and fill out:

- **Name**: shown at the top of every generated resume.
- **Location**: e.g., `Brooklyn, NY` or `Remote — US`.
- **Email**: clickable mailto link in the PDF.
- **Phone**: optional.
- **Links**: add any of LinkedIn, GitHub, portfolio, Bluesky, etc. Each link has a label and a value:

```
GitHub:    github.com/your-username
LinkedIn:  linkedin.com/in/your-name
Portfolio: your-name.dev
```

## 3. Upload your master resume

The master resume is the source-of-truth that Tailr selects from. Upload any of:

- `.docx` or `.pdf` — the LLM-backed parser converts it to structured YAML.
- `.txt` or `.md` — same parser path.
- `.yaml` or `.yml` — bypasses the parser; written through verbatim.

The parsed YAML is saved at `data/master_resume.yaml` and looks like:

```yaml
profile: >
  Concise 2–4 sentence summary of who you are and what you do.

skills:
  - category: "Languages"
    items: "Python, TypeScript, SQL, Go"
  - category: "Frameworks"
    items: "React, FastAPI, Postgres"

experience:
  - company: "Acme Corp"
    location: "Remote"
    title: "Senior Software Engineer"
    dates: "2022 – Present"
    bullets:
      - text: "Led migration of the billing service from REST to gRPC, reducing p99 latency from 320ms to 95ms."
      - boldPrefix: "Mentorship:"
        text: "Mentored 4 junior engineers; two have since been promoted."

projects:
  - name: "Open-source caching proxy"
    tech: "Go, Redis, Kubernetes"
    bullets:
      - text: "Wrote a sidecar caching proxy used by 3 internal services; ~40% origin traffic reduction."

education:
  - institution: "University of X"
    location: "City, ST"
    degree: "B.S. Computer Science"
    gpa: "3.7"
    graduation: "May 2020"
    honors: ["Dean's List"]

certifications:
  - name: "AWS Solutions Architect — Associate"
    issuer: "Amazon"
    date: "2023"
```

You can edit this YAML by hand later (Dashboard → "Edit Master") if the parser missed something.

## 4. Tweak preferences (optional)

Settings → Tailoring Preferences:

- **Tone**: pick whichever matches the kinds of roles you target most.
- **Pinned experience**: list any company whose role MUST appear regardless of JD fit. Useful for current employer or a flagship role.
- **Additional guidance**: free-text instructions sent verbatim to the tailoring prompt. Examples:
  - `"Emphasize remote/distributed-team experience whenever possible."`
  - `"Don't include the New Balance retail role unless the JD specifically calls for customer service."`
  - `"For startup roles, lead with founder experience; for enterprise roles, lead with the consulting work."`

## 5. Generate a tailored resume

Studio → paste a job description → click **Tailr My Resume**.

The pipeline streams progress events:

```
⟫ Analyzing job description and scoring projects...
⟫ Fit score: 8/10 — Strong match on backend systems experience...
⟫ Tailoring layout for a perfect 1-page fit...
⟫ Layout optimized to fill one page.
⟫ Saving to your vault...
```

When complete, you see:

- **Preview** — embedded PDF, exactly what you'd email.
- **Analysis** — fit score (1–10), reasoning, ATS keywords matched, stretch areas to address in a cover letter.
- **PDF / DOCX downloads** — filenames are auto-generated as `<YourName>_Resume_<Company>.<ext>`.

## 6. Iterate

If the result looks off:

- **Fit score too low** — the JD is genuinely a stretch. Use the listed `stretchAreas` to write a cover letter rather than over-tailoring.
- **Wrong projects selected** — edit your master resume to update tech-stack tags so the project scorer matches better.
- **Too generic** — tighten the **Additional guidance** field with specific framing instructions.
- **Wrong tone** — switch the tone preset and regenerate.
- **A bullet is wrong** — Tailr will rephrase but won't invent. If a bullet is misleading, edit it in the master.

## Sample workflow output (anonymized)

After running 5 tailored generations, the Dashboard shows:

- Total resumes: `5`
- Avg fit score: `7.6`
- Top company: company name with the most generations
- Score-trend chart (last 20 generations)
- Role-distribution doughnut grouped into broad categories

Each entry in The Vault is a tile with company, role, score ring, and quick-action icons (analysis, preview, download PDF, download DOCX, delete).
