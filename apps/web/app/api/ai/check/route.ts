import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function checkModel(apiKey: string, model: string) {
  const started = Date.now();
  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: 'hello world', parameters: { max_new_tokens: 5 }, options: { wait_for_model: true } })
    });
    const ms = Date.now() - started;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, ms, error: text?.slice(0, 500) || `HTTP ${res.status}` };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, status: 200, ms, preview: JSON.stringify(data).slice(0, 200) };
  } catch (e: any) {
    return { ok: false, status: 0, ms: Date.now() - started, error: e?.message || String(e) };
  }
}

async function modelExistsOnHub(model: string) {
  try {
    const meta = await fetch(`https://huggingface.co/api/models/${encodeURIComponent(model)}`);
    return meta.ok;
  } catch {
    return false;
  }
}

async function checkBase(apiKey: string) {
  try {
    const res = await fetch('https://api-inference.huggingface.co/', { headers: { Authorization: `Bearer ${apiKey}` } });
    return { ok: res.ok, status: res.status };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message || String(e) };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const modelText = searchParams.get('textModel') || process.env.HF_TEXT_MODEL || 'google/flan-t5-small';
  const modelGen = searchParams.get('genModel') || process.env.HF_MODEL || 'bigscience/bloom-560m';
  const apiKey = process.env.HUGGINGFACE_API_KEY || '';
  const groqKey = process.env.GROQ_API_KEY || '';
  // Use a modern default and support fallbacks when a model is deprecated
  const groqModel = process.env.GROQ_MODEL || 'llama-3.3-8b-instant';
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const geminiModel = process.env.GEMINI_VISION_MODEL || 'gemini-1.5-flash';

  const results: any = { ok: false };

  // HF checks only if key set
  if (apiKey) {
    // Try preferred models, then fall back to known public small models if 404
  const fallbacksText = ['google/flan-t5-small', 'google/flan-t5-base'];
  const fallbacksGen = ['bigscience/bloom-560m', 'bigscience/bloomz-560m'];
  const base = await checkBase(apiKey);
  let textRes = await checkModel(apiKey, modelText);
  if (!textRes.ok && textRes.status === 404) {
    for (const m of fallbacksText) { textRes = await checkModel(apiKey, m); if (textRes.ok) { (textRes as any).model = m; break; } }
  }
  let genRes = await checkModel(apiKey, modelGen);
  if (!genRes.ok && genRes.status === 404) {
    for (const m of fallbacksGen) { genRes = await checkModel(apiKey, m); if (genRes.ok) { (genRes as any).model = m; break; } }
  }
  const textExists = await modelExistsOnHub((textRes as any).model || modelText);
  const genExists = await modelExistsOnHub((genRes as any).model || modelGen);
    results.huggingface = {
      ok: textRes.ok || genRes.ok,
      apiKeyPresent: true,
      base,
      textModel: { model: (textRes as any).model || modelText, existsOnHub: textExists, ...textRes },
      genModel: { model: (genRes as any).model || modelGen, existsOnHub: genExists, ...genRes }
    };
    results.ok = results.ok || results.huggingface.ok;
  } else {
    results.huggingface = { ok: false, apiKeyPresent: false, reason: 'HUGGINGFACE_API_KEY not set' };
  }

  // Groq text check with model fallbacks
  if (groqKey) {
    const candidates = [groqModel, 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'];
    let chosen: string | null = null;
    let lastErr: { status: number; body?: string; ms?: number } | null = null;
    for (const m of candidates) {
      const started = Date.now();
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: m, temperature: 0.1, messages: [{ role: 'user', content: 'Say OK in one word.' }] })
        });
        const ms = Date.now() - started;
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          lastErr = { status: res.status, body: text.slice(0, 500), ms };
          // Try next model only if model issue (400/404) or decommissioned code
          const bodyLower = (text || '').toLowerCase();
          if (res.status === 400 || res.status === 404 || bodyLower.includes('model_decommissioned') || bodyLower.includes('no longer supported') || bodyLower.includes('not found')) {
            continue;
          } else {
            // Non-retryable
            results.groq = { ok: false, status: res.status, ms, error: text.slice(0, 300), model: m };
            chosen = null; // signal fail-hard
            break;
          }
        } else {
          const data = await res.json().catch(() => ({} as any));
          const content = data?.choices?.[0]?.message?.content || '';
          results.groq = { ok: true, status: 200, ms, model: m, preview: String(content).slice(0, 100) };
          results.ok = results.ok || true;
          chosen = m;
          break;
        }
      } catch (e: any) {
        lastErr = { status: 0, body: e?.message || String(e) };
        continue;
      }
    }
    if (!chosen && lastErr) {
      results.groq = { ok: false, status: lastErr.status, ms: lastErr.ms, error: (lastErr.body || '').slice(0, 300), model: groqModel };
    } else if (!chosen && !lastErr) {
      results.groq = { ok: false, status: 0, error: 'Unknown error', model: groqModel };
    }
  } else {
    results.groq = { ok: false, apiKeyPresent: false, reason: 'GROQ_API_KEY not set' };
  }

  // Gemini text check (no image)
  if (geminiKey) {
    const started = Date.now();
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${geminiKey}`;
      const body = { contents: [{ parts: [{ text: 'Reply with OK.' }] }] };
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const ms = Date.now() - started;
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        results.gemini = { ok: false, status: res.status, ms, error: text.slice(0, 300), model: geminiModel };
      } else {
        const data = await res.json().catch(() => ({} as any));
        const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        results.gemini = { ok: true, status: 200, ms, model: geminiModel, preview: String(txt).slice(0, 100) };
        results.ok = results.ok || true;
      }
    } catch (e: any) {
      results.gemini = { ok: false, status: 0, error: e?.message || String(e), model: geminiModel };
    }
  } else {
    results.gemini = { ok: false, apiKeyPresent: false, reason: 'GEMINI_API_KEY not set' };
  }

  return NextResponse.json(results);
}
