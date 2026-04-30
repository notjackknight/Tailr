/**
 * server/llm.ts — Provider-agnostic LLM layer.
 *
 * Tailr supports three providers (Gemini, Anthropic, OpenAI) via a tiny
 * normalized interface. Each provider implements two operations:
 *   - generateJson(): structured response (with JSON-mode where supported)
 *   - generateText(): free-form text (used by the resume-parser path)
 *
 * Models are mapped per task — "fast" for scoring/parsing/auxiliary calls
 * and "smart" for the main resume-tailoring call.
 */

import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { LlmCredentials, LlmProvider } from '../shared/types.js';

export type LlmTask = 'fast' | 'smart';

interface GenerateOptions {
    systemPrompt: string;
    userPrompt: string;
    task: LlmTask;
    /** Lower = more deterministic. Range 0-1. */
    temperature?: number;
}

const MODEL_MAP: Record<LlmProvider, Record<LlmTask, string>> = {
    gemini: {
        fast: 'gemini-2.5-flash',
        smart: 'gemini-2.5-pro',
    },
    anthropic: {
        // Claude 4.5 family — fast variant for scoring/parsing, smart for tailoring.
        fast: 'claude-haiku-4-5-20251001',
        smart: 'claude-sonnet-4-6',
    },
    openai: {
        fast: 'gpt-4o-mini',
        smart: 'gpt-4o',
    },
};

const MAX_TOKENS = 4096;

function validateCreds(creds: LlmCredentials): void {
    if (!creds || !creds.provider || !creds.apiKey?.trim()) {
        throw new Error('Missing LLM credentials. Add your API key in Settings → API Key.');
    }
}

function stripJsonFences(text: string): string {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return cleaned;
}

function stripCodeFences(text: string): string {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:[a-zA-Z]+)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return cleaned;
}

// ── Per-provider implementations ────────────────────────────

async function geminiGenerate(creds: LlmCredentials, opts: GenerateOptions, jsonMode: boolean): Promise<string> {
    const client = new GoogleGenAI({ apiKey: creds.apiKey });
    const response = await client.models.generateContent({
        model: MODEL_MAP.gemini[opts.task],
        contents: opts.userPrompt,
        config: {
            systemInstruction: opts.systemPrompt,
            temperature: opts.temperature ?? 0.3,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
    });
    const text = response.text;
    if (!text) throw new Error('Empty response from Gemini');
    return text;
}

async function anthropicGenerate(creds: LlmCredentials, opts: GenerateOptions, _jsonMode: boolean): Promise<string> {
    // Anthropic doesn't have a strict JSON-mode flag — we lean on prompt instructions
    // (already present in every prompt) and strip fences afterwards.
    const client = new Anthropic({ apiKey: creds.apiKey });
    const response = await client.messages.create({
        model: MODEL_MAP.anthropic[opts.task],
        max_tokens: MAX_TOKENS,
        temperature: opts.temperature ?? 0.3,
        system: opts.systemPrompt,
        messages: [{ role: 'user', content: opts.userPrompt }],
    });

    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') throw new Error('Empty response from Anthropic');
    return block.text;
}

async function openaiGenerate(creds: LlmCredentials, opts: GenerateOptions, jsonMode: boolean): Promise<string> {
    const client = new OpenAI({ apiKey: creds.apiKey });
    const response = await client.chat.completions.create({
        model: MODEL_MAP.openai[opts.task],
        temperature: opts.temperature ?? 0.3,
        max_tokens: MAX_TOKENS,
        ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
        messages: [
            { role: 'system', content: opts.systemPrompt },
            { role: 'user', content: opts.userPrompt },
        ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error('Empty response from OpenAI');
    return text;
}

// ── Public entry points ─────────────────────────────────────

export async function generateJson(creds: LlmCredentials, opts: GenerateOptions): Promise<string> {
    validateCreds(creds);
    let raw: string;
    try {
        switch (creds.provider) {
            case 'gemini':    raw = await geminiGenerate(creds, opts, true); break;
            case 'anthropic': raw = await anthropicGenerate(creds, opts, true); break;
            case 'openai':    raw = await openaiGenerate(creds, opts, true); break;
            default:          throw new Error(`Unknown provider: ${creds.provider}`);
        }
    } catch (err: any) {
        // Surface the most useful upstream message rather than burying it.
        const reason = err?.message || err?.toString() || 'Unknown LLM error';
        throw new Error(`${creds.provider} request failed: ${reason}`);
    }
    return stripJsonFences(raw);
}

export async function generateText(creds: LlmCredentials, opts: GenerateOptions): Promise<string> {
    validateCreds(creds);
    let raw: string;
    try {
        switch (creds.provider) {
            case 'gemini':    raw = await geminiGenerate(creds, opts, false); break;
            case 'anthropic': raw = await anthropicGenerate(creds, opts, false); break;
            case 'openai':    raw = await openaiGenerate(creds, opts, false); break;
            default:          throw new Error(`Unknown provider: ${creds.provider}`);
        }
    } catch (err: any) {
        const reason = err?.message || err?.toString() || 'Unknown LLM error';
        throw new Error(`${creds.provider} request failed: ${reason}`);
    }
    return stripCodeFences(raw);
}

export function isValidProvider(p: unknown): p is LlmProvider {
    return p === 'gemini' || p === 'anthropic' || p === 'openai';
}
