import { NextRequest, NextResponse } from 'next/server';
import { runStore } from '../../internal/orchestrator';
import { summarizeRun } from '@autotest/reporting';

// Ensure this route is always evaluated on request (no static caching)
export const dynamic = 'force-dynamic';

async function hfTextSummary(prompt: string): Promise<string | null> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  const model = process.env.HF_TEXT_MODEL || 'google/flan-t5-small';
  if (!apiKey) return null; // no free key configured; fall back to local summary
  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 400 } })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = Array.isArray(data) ? (data[0]?.generated_text || data[0]?.summary_text || '') : (data?.generated_text || data?.summary_text || '');
    return text || null;
  } catch {
    return null;
  }
}

async function groqTextSummary(prompt: string): Promise<{ text: string | null; model?: string; status?: number; error?: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  const envModel = process.env.GROQ_MODEL;
  const defaults = ['llama-3.3-8b-instant', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'];
  const candidates = Array.from(new Set([envModel, ...defaults].filter(Boolean))) as string[];
  if (!apiKey) return { text: null, status: 0, error: 'GROQ_API_KEY not set' };
  let lastErr: { status: number; body?: string } | null = null;
  for (const model of candidates) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, temperature: 0.2, messages: [
          { role: 'system', content: 'You are a concise QA lead who writes clear executive summaries in markdown without code fences.' },
          { role: 'user', content: prompt }
        ], max_tokens: 600 })
      });
      if (!res.ok) {
        const err = await res.text().catch(() => '');
        lastErr = { status: res.status, body: err.slice(0, 800) };
        const bodyLower = (err || '').toLowerCase();
        // Retry on model decommissioned/not found or generic 400/404
        if (res.status === 400 || res.status === 404 || bodyLower.includes('decommissioned') || bodyLower.includes('no longer supported') || bodyLower.includes('not found')) {
          continue;
        }
        return { text: null, status: res.status, error: err.slice(0, 500) };
      }
      const data = await res.json().catch(() => ({} as any));
      const text = data?.choices?.[0]?.message?.content || '';
      if (text) return { text, model };
    } catch (e: any) {
      lastErr = { status: 0, body: e?.message || String(e) };
      continue;
    }
  }
  return { text: null, status: lastErr?.status, error: lastErr?.body };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('runId');
  if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 });
  const record = runStore.get(runId);
  if (!record || record.status !== 'completed' || !record.results) {
    return NextResponse.json({ error: 'Run not completed or not found' }, { status: 404 });
  }

  const { tests = [], testResults = [], results } = record;
  const url = record.config.url;

  // Build a concise, structured context for AI or fallback summarizer
  const ctx = {
    totals: { generated: results.testsGenerated, passed: results.testsPassed, failed: results.testsFailed },
    screenshots: results.screenshots.slice(0, 40),
    failures: testResults
      .filter(r => r.status !== 'passed')
      .map(r => ({ testId: r.testId, failedSteps: r.stepResults.filter(s => s.status === 'failed').map(s => ({ i: s.stepIndex, err: s.error })) })),
    testNames: tests.map(t => ({ id: t.id, name: t.name }))
  };

  // Create a text-only prompt (free-tier friendly); we include screenshot URLs as text references
  const prompt = `You are a senior QA lead. Write a crisp, executive-ready summary in Markdown.
Use these exact sections with level-3 headings (###): Overview, Key Findings, Failures, Recommendations.
Guidelines:
- Keep it concise (≈150–220 words total).
- Quantify results (pass rate, totals), avoid fluff.
- Under Key Findings and Recommendations, use short bullet points (1–5 items).
- In Failures, list failed test names with step index and a brief error snippet when available.
- No code fences. No HTML. Plain Markdown only.

DATA:\n${JSON.stringify(ctx, null, 2)}`;

  let aiUsed = false; let aiProvider: string | null = null; let aiModel: string | null = null;
  let aiMd: string | null = null;
  // Prefer Groq if available
  const groq = await groqTextSummary(prompt);
  if (groq.text) {
    aiMd = groq.text; aiUsed = true; aiProvider = 'groq'; aiModel = groq.model || null;
  } else {
    aiMd = await hfTextSummary(prompt);
    if (aiMd) { aiUsed = true; aiProvider = 'huggingface'; aiModel = process.env.HF_TEXT_MODEL || 'google/flan-t5-base'; }
  }
  if (!aiMd) {
    // Fallback to deterministic local summarizer
    aiMd = summarizeRun(testResults, tests);
  }

  // Minimal metadata block to help rendering and export
  const report = {
    runId,
    createdAt: record.createdAt,
    finishedAt: results.finishedAt,
    coverage: results.coverage,
    url,
    ai: { used: aiUsed, provider: aiProvider, model: aiModel, debug: !aiUsed ? { groqStatus: groq.status, groqError: groq.error } : undefined },
    aiGeneration: record.aiGeneration || { used: false },
    markdown: aiMd,
    screenshots: results.screenshots
  };

  return NextResponse.json(report);
}
