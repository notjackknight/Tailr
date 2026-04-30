# Prompting

All LLM-facing instructions live as Markdown files in `prompts/`. They are read once at first use and cached in memory until the server restarts.

All prompts run against the user's chosen provider — Gemini, Anthropic, or OpenAI — through `server/llm.ts`. Each call picks `task: 'fast'` or `task: 'smart'` and the adapter maps that to the right model per provider.

| File                          | Used by                 | Task    | Purpose                                       |
|-------------------------------|-------------------------|---------|-----------------------------------------------|
| `prompts/content-selector.md` | `selectContent()`       | `smart` | Main tailored-resume generator                |
| `prompts/project-scorer.md`   | `scoreProjects()`       | `fast`  | Phase 1: rank every project against the JD    |
| `prompts/resume-parser.md`    | `convertMasterResume()` | `fast`  | Convert raw text → structured YAML            |
| `prompts/outreach.md`         | `generateOutreach()`    | `fast`  | Hiring-manager personas + LinkedIn message    |
| `prompts/job-titles.md`       | `generateJobTitles()`   | `fast`  | Top-10 search keywords from the master resume |

Model mapping lives in `server/llm.ts:MODEL_MAP`:

| Provider   | Fast                       | Smart                |
|------------|----------------------------|----------------------|
| `gemini`   | `gemini-2.5-flash`         | `gemini-2.5-pro`     |
| `anthropic`| `claude-haiku-4-5-20251001`| `claude-sonnet-4-6`  |
| `openai`   | `gpt-4o-mini`              | `gpt-4o`             |

## How prompts receive variables

Prompts are Markdown — they're shipped to the model verbatim as the system message. Dynamic values (master resume, JD, preferences) are appended as separate trailing sections by the calling function in `server/llmCalls.ts`. There's no Mustache or templating engine on the prompt files themselves; the assembly happens in TypeScript.

For example, `selectContent()` builds the system prompt as:

```
<contents of content-selector.md>

---

## Candidate Master Resume (YAML)
```yaml
<filtered master_resume.yaml>
```

---

## Candidate Preferences
```yaml
<rendered preferences.json>
```

---

## Output Rules
- Output ONLY valid JSON ...
```

## Editing prompts

You can edit the `.md` files directly. Restart the server to pick up changes (the prompt cache is in-memory). No code changes required.

## Truthfulness guardrails

Both `content-selector.md` and `resume-parser.md` include explicit "do not invent" language:

> Never invent employers, job titles, dates, degrees, schools, GPAs, certifications, awards, metrics, technologies, or skills that are not present in the master resume.

If you fork this project, **keep these guardrails**. They are the difference between a useful tailoring tool and a hallucination machine that gets candidates blacklisted from companies.

## Adding a new prompt

1. Add `prompts/your-prompt.md`.
2. In `server/llmCalls.ts`, call `loadPrompt('your-prompt.md')` and pass it as the `systemPrompt` in either `generateJson()` (structured output) or `generateText()` (free-form output).
3. Use `temperature: 0.1–0.3` for parsing/scoring (deterministic), `0.3–0.5` for generation, `≥0.5` only for creative tasks.
4. Pick `task: 'fast'` for short/structured calls, `'smart'` for the main tailoring call.
5. The response is already fence-stripped by the adapter — call `JSON.parse()` directly on the result of `generateJson()`.

## Tone presets

`preferences.tone` is rendered into the prompt context and read by the content selector. The selector's tone instructions are documented in `prompts/content-selector.md` under "Tone".

If you want to add a new tone, edit:
1. `shared/types.ts` — extend the `tone` union.
2. `server/index.ts` — add it to `allowedTones` in the `/api/preferences` validator.
3. `src/views/Settings.tsx` — add a `TONES` entry.
4. `prompts/content-selector.md` — describe the tone under the **Tone** section.
