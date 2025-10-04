import { crawl } from '@autotest/crawler';
import { generateTests } from '@autotest/generator';
import { runTest } from '@autotest/runner';
import { CrawlResult, TestSpec, RunResult } from '@autotest/core';
import path from 'path';
import { getAiProvider } from '@autotest/ai';

export interface OrchestratorConfig {
  url: string;
  depth: number;
  dynamic: boolean;
  aiGenerated: boolean;
  screenshotCapture?: boolean;
  credentials?: {
    username: string;
    password: string;
  };
  assets?: {
    id: string;
    name: string;
    mime: string;
    size: number;
    kind: 'image' | 'pdf' | 'video' | 'other';
    path: string; // repo-relative path to saved file
  }[];
}

export interface OrchestratorEventBase { type: string; runId: string; timestamp: number; }
export type OrchestratorEvent =
  | (OrchestratorEventBase & { type: 'phase'; phase: 'crawl' | 'generate' | 'execute'; message: string })
  | (OrchestratorEventBase & { type: 'crawl-progress'; pages: number })
  | (OrchestratorEventBase & { type: 'test-progress'; current: number; total: number; testName?: string })
  | (OrchestratorEventBase & { type: 'test-step'; testId: string; stepIndex: number; status: string; screenshot?: string })
  | (OrchestratorEventBase & { type: 'error'; error: string })
  | (OrchestratorEventBase & { type: 'completed'; summary: OrchestratorSummary });

export interface OrchestratorSummary {
  testsGenerated: number;
  testsPassed: number;
  testsFailed: number;
  coverage: any; // Step 2: structured coverage object
  screenshots: string[];
  finishedAt: number;
}

export interface RunStateRecord {
  runId: string;
  config: OrchestratorConfig;
  status: 'pending' | 'running' | 'completed' | 'error';
  createdAt: number;
  updatedAt: number;
  results?: OrchestratorSummary;
  events: OrchestratorEvent[];
  tests?: TestSpec[];
  testResults?: RunResult[];
  aiGeneration?: { used: boolean; provider?: string; model?: string };
}

// Simple in-memory store (process local)
// Ensure a single shared in-memory store across module reloads (dev) and route instances
const __g: any = globalThis as any;
export const runStore: Map<string, RunStateRecord> = __g.__AUTOTEST_RUN_STORE__ || (__g.__AUTOTEST_RUN_STORE__ = new Map());

export async function startRun(runId: string, config: OrchestratorConfig, emit: (e: OrchestratorEvent) => void) {
  const record: RunStateRecord = { runId, config, status: 'running', createdAt: Date.now(), updatedAt: Date.now(), events: [] };
  runStore.set(runId, record);
  const push = (e: OrchestratorEvent) => { record.events.push(e); record.updatedAt = Date.now(); emit(e); };
  try {
    push({ type: 'phase', phase: 'crawl', message: 'Starting crawl', runId, timestamp: Date.now() });
    const dynamicAllowed = process.env.DISABLE_DYNAMIC_CRAWL === 'true' ? false : config.dynamic;
    let crawlResult: CrawlResult | null = null;
    let dynamicAttempted = false;
    if (dynamicAllowed) {
      dynamicAttempted = true;
      try {
        crawlResult = await crawl(config.url, { depth: config.depth, dynamic: true, maxPages: 5 });
        push({ type: 'phase', phase: 'crawl', message: 'Dynamic crawl succeeded', runId, timestamp: Date.now() });
      } catch (err: any) {
        push({ type: 'phase', phase: 'crawl', message: `Dynamic crawl failed (${err?.message || 'error'}) falling back to static`, runId, timestamp: Date.now() });
      }
    }
    if (!crawlResult) {
      try {
        crawlResult = await crawl(config.url, { depth: config.depth, dynamic: false, maxPages: 5 });
        if (dynamicAttempted) {
          push({ type: 'phase', phase: 'crawl', message: 'Static crawl fallback succeeded', runId, timestamp: Date.now() });
        } else {
          push({ type: 'phase', phase: 'crawl', message: 'Static crawl succeeded', runId, timestamp: Date.now() });
        }
      } catch (err: any) {
        throw new Error(`Both dynamic and static crawl failed: ${err?.message || err}`);
      }
    }
  push({ type: 'phase', phase: 'generate', message: 'Generating tests', runId, timestamp: Date.now() });
    // Minimal requirement placeholder
    const requirements = [] as any[];
    let tests: TestSpec[] = crawlResult.pages.flatMap(p => generateTests(p, requirements));

    // Optional: AI-generated tests
    if (config.aiGenerated) {
      try {
        // Auto-select provider: prefer Groq if GROQ_API_KEY is set; otherwise HF if available; else none
        const providerName = process.env.GROQ_API_KEY ? 'groq' : (process.env.HUGGINGFACE_API_KEY ? 'huggingface' : 'none');
        const modelName = providerName === 'groq'
          ? (process.env.GROQ_MODEL || 'llama-3.3-8b-instant')
          : (providerName === 'huggingface' ? (process.env.HF_MODEL || 'bigscience/bloomz-560m') : undefined);
        const ai = await getAiProvider({});
        const aiTests = await ai.generateTests({ pageModels: crawlResult.pages, maxTests: 8 });
        if (aiTests.length) {
          tests.push(...aiTests);
          record.aiGeneration = { used: true, provider: providerName !== 'none' ? providerName : undefined, model: modelName };
          push({ type: 'phase', phase: 'generate', message: `AI (${record.aiGeneration.provider || 'unknown'}${record.aiGeneration.model ? ', ' + record.aiGeneration.model : ''}) generated ${aiTests.length} tests`, runId, timestamp: Date.now() });
        } else {
          record.aiGeneration = { used: false, provider: providerName !== 'none' ? providerName : undefined, model: modelName };
          push({ type: 'phase', phase: 'generate', message: 'AI provider returned no tests (using heuristics only)', runId, timestamp: Date.now() });
        }
      } catch (e: any) {
        record.aiGeneration = { used: false };
        push({ type: 'phase', phase: 'generate', message: `AI generation skipped: ${e?.message || 'provider unavailable'}`, runId, timestamp: Date.now() });
      }
    }
    // Deduplicate navigation tests across pages (same first step target)
    const before = tests.length;
    const seenNav = new Set<string>();
    const deduped: TestSpec[] = [];
    for (const t of tests) {
      if (t.tags?.includes('heuristic') && t.tags.includes('nav')) {
        const sig = t.steps?.[0]?.targetElementId || t.name;
        if (sig) {
          if (seenNav.has(sig)) continue;
          seenNav.add(sig);
        }
      }
      deduped.push(t);
    }
    if (deduped.length !== before) {
      push({ type: 'phase', phase: 'generate', message: `Deduplicated ${before - deduped.length} duplicate navigation tests`, runId, timestamp: Date.now() });
    }
    tests = deduped;
    // --- Step 2: coverage metrics (static from crawl/tests) -----------------
    const pagesFound = crawlResult.pages.length;
    const pageById = new Map(crawlResult.pages.map(p => [p.id, p] as const));
    const pagesTestedSet = new Set<string>();
    const clickTargets = new Set<string>();
    let formsFound = 0;
    let formsFilled = 0;
    // formsFound: prefer actual <form> count; fallback to pages with inputs
    for (const p of crawlResult.pages) {
      const formCount = p.elements.filter((e: any) => e.tag === 'form').length;
      if (formCount > 0) formsFound += formCount; else {
        const hasInputs = p.elements.some((e: any) => e.tag === 'input');
        if (hasInputs) formsFound += 1; // coarse fallback
      }
    }
    for (const t of tests) {
      if ((t as any).pageModelId) pagesTestedSet.add((t as any).pageModelId);
      const steps = (t as any).steps || [];
      for (const s of steps) {
        if (s.action === 'click' && s.targetElementId) clickTargets.add(s.targetElementId);
        if (s.action === 'upload') formsFilled += 1; // proxy for form interaction
      }
      // If tagged as form, also count as filled
      const tags = (t as any).tags || [];
      if (Array.isArray(tags) && (tags.includes('form') || tags.includes('upload'))) formsFilled += 1;
    }
    const pagesTested = pagesTestedSet.size;
    // routesHit: distinct page URLs referenced by tests
    const routesSet = new Set<string>();
    for (const id of pagesTestedSet) {
      const p = pageById.get(id);
      if (p?.url) routesSet.add(p.url);
    }
    const percentPages = pagesFound > 0 ? Math.round((pagesTested / pagesFound) * 100) : 0;
    const percentForms = formsFound > 0 ? Math.round((Math.min(formsFilled, formsFound) / formsFound) * 100) : 0;
    const coverageObj = {
      pagesFound,
      pagesTested,
      percentPages,
      formsFound,
      formsFilled: Math.min(formsFilled, formsFound),
      percentForms,
      routesHit: routesSet.size,
      clickableTouched: clickTargets.size
    };
    // If user uploaded assets, generate simple upload tests for pages with file inputs
    if (config.assets && config.assets.length) {
      for (const page of crawlResult.pages) {
        const fileInputs = page.elements.filter(e => e.tag === 'input' && (e.attributes['type'] || '').toLowerCase() === 'file');
        for (const input of fileInputs) {
          // pick matching asset based on accept attribute if present
          const accept = (input.attributes['accept'] || '').toLowerCase();
          const pick = selectAssetFor(accept, config.assets);
          if (!pick) continue;
          const spec: TestSpec = {
            id: `upload-${page.id}-${input.id}`,
            name: `File upload (${input.attributes['name'] || input.id})`,
            requirementRefs: [],
            pageModelId: page.id,
            priority: 'medium',
            tags: ['synthetic','upload','form'],
            steps: [
              { description: 'Attach file', action: 'upload', targetElementId: input.id, inputData: pick.path },
              // Try submit if a submit button exists nearby
              ...(nearestSubmit(page) ? [{ description: 'Submit form', action: 'click', targetElementId: nearestSubmit(page)! }] as any : []),
              { description: 'Verify page responded (URL may change)', action: 'assert-url', expected: '' }
            ]
          };
          tests.push(spec);
        }
      }
      push({ type: 'phase', phase: 'generate', message: 'Added upload tests for detected file inputs', runId, timestamp: Date.now() });
    }
    
    // Add synthetic login test if credentials are provided
    if (config.credentials) {
      const loginPage = crawlResult.pages.find(p => 
        /login|sign\s*in/i.test(p.title || '') ||
        /login|signin/i.test(p.url) ||
        p.elements.some(e => e.tag === 'input' && e.attributes['type'] === 'password')
      );
      
      if (loginPage) {
        const loginTest = createLoginTest(loginPage, config.credentials);
        if (loginTest) {
          tests.unshift(loginTest); // Add at beginning for priority
          push({ type: 'phase', phase: 'generate', message: 'Added synthetic login test with provided credentials', runId, timestamp: Date.now() });
        }
      }
    }
    
    if (tests.length === 0) {
      // Fallback: synthesize a simple smoke test so the user sees execution even if heuristics found nothing
      const firstPage = crawlResult.pages[0];
      if (firstPage) {
        tests.push({
          id: 'smoke-' + firstPage.id,
          name: 'Smoke: load main page',
          requirementRefs: [],
          pageModelId: firstPage.id,
          priority: 'low',
          tags: ['synthetic','smoke'],
          steps: [
            { description: 'Assert page URL', action: 'assert-url', expected: firstPage.url }
          ]
        });
        push({ type: 'phase', phase: 'generate', message: 'No heuristic tests found; added synthetic smoke test', runId, timestamp: Date.now() });
      }
    }
    record.tests = tests;
    const total = tests.length;
    let passed = 0; let failed = 0; const screenshots: string[] = [];
    const perTestResults: RunResult[] = [];
    push({ type: 'phase', phase: 'execute', message: `Executing ${total} tests`, runId, timestamp: Date.now() });
    for (let i = 0; i < tests.length; i++) {
      const t = tests[i];
      push({ type: 'test-progress', runId, timestamp: Date.now(), current: i + 1, total, testName: t.name });
      const pageModel = crawlResult.pages.find(p => p.id === t.pageModelId)!;
      const artifactsRoot = path.join(process.cwd(), 'apps/web/artifacts');
      try {
        const result: RunResult = await runTest(t, pageModel, { headless: true, outDir: 'apps/web/artifacts', onEvent: ev => {
          if (ev.type === 'step-end') {
            if (ev.evidence) {
              // Normalize evidence path: it may already be relative (e.g. apps/web/artifacts/...) or absolute.
              let rel = ev.evidence;
              if (rel.startsWith(artifactsRoot)) {
                rel = rel.substring(artifactsRoot.length + 1);
              }
              // If it still contains the artifacts segment prefix, strip any leading nested artifacts path parts
              // e.g. "apps/web/artifacts/foo/bar.png" -> "foo/bar.png"
              const artifactsIdx = rel.indexOf('apps/web/artifacts/');
              if (artifactsIdx === 0) {
                rel = rel.substring('apps/web/artifacts/'.length);
              }
              const url = `/api/artifacts/${rel.split(path.sep).filter(Boolean).map(encodeURIComponent).join('/')}`;
              push({ type: 'test-step', runId, timestamp: Date.now(), testId: t.id, stepIndex: ev.stepIndex, status: ev.status || 'unknown', screenshot: url });
              screenshots.push(url);
            } else {
              push({ type: 'test-step', runId, timestamp: Date.now(), testId: t.id, stepIndex: ev.stepIndex, status: ev.status || 'unknown' });
            }
          }
        }});
        perTestResults.push(result);
        if (result.status === 'passed') passed++; else failed++;
      } catch (err: any) {
        failed++;
        push({ type: 'phase', phase: 'execute', message: `Test ${t.name} failed: ${err?.message || err}`, runId, timestamp: Date.now() });
      }
    }
    if (total === 0) {
      throw new Error('No tests generated');
    }
  const summary: OrchestratorSummary = { testsGenerated: total, testsPassed: passed, testsFailed: failed, coverage: coverageObj, screenshots, finishedAt: Date.now() };
  record.status = 'completed';
    record.results = summary; record.updatedAt = Date.now();
  record.testResults = perTestResults;
    push({ type: 'completed', runId, timestamp: Date.now(), summary });
  } catch (e: any) {
    // Unrecoverable failure (e.g. both crawl modes failed)
    record.status = 'error'; record.updatedAt = Date.now();
    push({ type: 'error', runId, timestamp: Date.now(), error: e.message || String(e) });
  }
}

function selectAssetFor(accept: string, assets: { kind: 'image' | 'pdf' | 'video' | 'other'; mime: string; path: string }[]) {
  if (!accept) return assets[0];
  const parts = accept.split(',').map(s => s.trim());
  for (const p of parts) {
    if (p === 'image/*') return assets.find(a => a.kind === 'image') || assets[0];
    if (p === 'video/*') return assets.find(a => a.kind === 'video') || assets[0];
    if (p === 'application/pdf') return assets.find(a => a.kind === 'pdf') || assets[0];
    if (p.includes('/')) {
      const [type] = p.split('/');
      if (type === 'image') return assets.find(a => a.kind === 'image') || assets[0];
      if (type === 'video') return assets.find(a => a.kind === 'video') || assets[0];
    }
    // extension-based (e.g., .png, .pdf)
    if (p.startsWith('.')) {
      const ext = p.slice(1).toLowerCase();
      if (['png','jpg','jpeg','gif','webp'].includes(ext)) return assets.find(a => a.kind === 'image') || assets[0];
      if (ext === 'pdf') return assets.find(a => a.kind === 'pdf') || assets[0];
      if (['mp4','webm','mov'].includes(ext)) return assets.find(a => a.kind === 'video') || assets[0];
    }
  }
  return assets[0];
}

function nearestSubmit(page: any): string | undefined {
  const submit = page.elements.find((e: any) =>
    e.tag === 'button' ||
    (e.tag === 'input' && (e.attributes['type'] || '').toLowerCase() === 'submit') ||
    (e.text && /submit|upload|save|send/i.test(e.text))
  );
  return submit?.id;
}

// Helper function to create a synthetic login test
function createLoginTest(page: any, credentials: { username: string; password: string }): TestSpec | null {
  // Find username and password elements
  const usernameElement = page.elements.find((e: any) => 
    e.tag === 'input' && (
      ['text', 'email'].includes(e.attributes['type']) ||
      /user|email|login/i.test(e.attributes['name'] || '') ||
      /user|email|login/i.test(e.attributes['id'] || '')
    )
  );
  
  const passwordElement = page.elements.find((e: any) => 
    e.tag === 'input' && e.attributes['type'] === 'password'
  );
  
  const submitElement = page.elements.find((e: any) => 
    (e.tag === 'button' && (/submit|login|sign\s*in/i.test(e.text || ''))) ||
    (e.tag === 'input' && e.attributes['type'] === 'submit')
  );

  if (!usernameElement || !passwordElement) {
    return null; // Cannot create login test without both fields
  }

  return {
    id: 'login-synthetic-' + page.id,
    name: 'Login (successful authentication)',
    requirementRefs: [],
    pageModelId: page.id,
    priority: 'high',
    tags: ['synthetic', 'login', 'auth'],
    steps: [
      {
        description: 'Enter username',
        action: 'fill',
        targetElementId: usernameElement.id,
        inputData: credentials.username
      },
      {
        description: 'Enter password',
        action: 'fill',
        targetElementId: passwordElement.id,
        inputData: credentials.password
      },
      ...(submitElement ? [{
        description: 'Submit login form',
        action: 'click',
        targetElementId: submitElement.id
      }] : []),
      {
        description: 'Verify successful login (URL change expected)',
        action: 'assert-url',
        expected: 'not:' + page.url
      }
    ]
  };
}
