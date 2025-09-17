import { TestSpec, RunResult, StepResult, PageModel, TestStep, RunnerEvent } from '@autotest/core';
// IMPORTANT: Do not import Playwright at top-level (causes bundlers like Next.js to attempt to resolve chromium-bidi during build)
// We lazy-load it when runTest actually executes in a Node runtime.
type PWPage = any; type PWFrame = any; type PWBrowser = any; // lightweight typing to avoid pulling in types
import fs from 'fs';
import path from 'path';

export interface RunnerOptions {
  baseUrl?: string; // optional override
  outDir?: string;
  environment?: Record<string, string>;
  headless?: boolean;
  onEvent?: (e: RunnerEvent) => void; // realtime updates
}

let cachedChromium: any | null = null;
async function getChromium() {
  if (cachedChromium) return cachedChromium;
  try {
    const pw = await import('playwright');
    cachedChromium = pw.chromium;
    return cachedChromium;
  } catch (e: any) {
    throw new Error('Playwright not available: ' + (e?.message || e));
  }
}

export async function runTest(test: TestSpec, pageModel: PageModel, opts: RunnerOptions = {}): Promise<RunResult> {
  const startedAt = Date.now();
  const outDir = opts.outDir || 'artifacts';
  fs.mkdirSync(outDir, { recursive: true });

  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
  const testSlug = sanitize(test.name || test.id);
  const testDir = path.join(outDir, `${testSlug}-${test.id}`);
  fs.mkdirSync(testDir, { recursive: true });

  const chromium = await getChromium();
  const browser: PWBrowser = await chromium.launch({ headless: opts.headless !== false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(opts.baseUrl || pageModel.url, { waitUntil: 'domcontentloaded' });
  opts.onEvent?.({ type: 'test-start', testId: test.id, pageUrl: pageModel.url, timestamp: Date.now() });

  const stepResults: StepResult[] = [];
  for (let i = 0; i < test.steps.length; i++) {
    const step = test.steps[i];
    const sStart = Date.now();
    try {
      opts.onEvent?.({ type: 'step-start', testId: test.id, stepIndex: i, description: step.description, timestamp: sStart });
  await performStep(page, step, pageModel);
  const shot = path.join(testDir, `step${i + 1}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      stepResults.push({ stepIndex: i, status: 'passed', startTime: sStart, endTime: Date.now(), evidence: shot });
      opts.onEvent?.({ type: 'step-end', testId: test.id, stepIndex: i, status: 'passed', evidence: shot, timestamp: Date.now() });
    } catch (e: any) {
  const shot = path.join(testDir, `step${i + 1}-error.png`);
  try { await page.screenshot({ path: shot, fullPage: true }); } catch (e) { /* ignore screenshot failure */ }
      stepResults.push({ stepIndex: i, status: 'failed', startTime: sStart, endTime: Date.now(), error: e.message, evidence: shot });
      opts.onEvent?.({ type: 'step-end', testId: test.id, stepIndex: i, status: 'failed', evidence: shot, error: e.message, timestamp: Date.now() });
      if (!test.negative) break; // stop on first failure for non-negative tests
    }
  }

  const status = stepResults.some(r => r.status === 'failed') ? (test.negative ? 'partial' : 'failed') : 'passed';
  await browser.close();
  const result: RunResult = {
    testId: test.id,
    startedAt,
    finishedAt: Date.now(),
    status,
    stepResults,
    artifacts: [testDir, ...stepResults.map(s => s.evidence!).filter(Boolean)],
    environment: opts.environment || {}
  };
  try {
    fs.writeFileSync(path.join(testDir, 'result.json'), JSON.stringify(result, null, 2));
  } catch {
    // ignore write errors for manifest
  }
  opts.onEvent?.({ type: 'test-end', testId: test.id, status, timestamp: Date.now() });
  return result;
}

async function performStep(page: PWPage, step: TestStep, model: PageModel) {
  const el = step.targetElementId ? model.elements.find(e => e.id === step.targetElementId) : undefined;
  const ctx = await frameFor(page, el?.attributes?.['data-frame-url'] || (el as any)?.frameUrl);
  switch (step.action) {
    case 'upload': {
      if (!el) throw new Error('No target element for upload');
      const locator = locatorFor(ctx, el);
      const filePath = String(step.inputData || '').trim();
      if (!filePath) throw new Error('No file path provided for upload');
      // Playwright will read the file from the server filesystem
      await (locator as any).setInputFiles?.(filePath);
      break;
    }
    case 'fill': {
      if (!el) throw new Error('No target element for fill');
      const locator = locatorFor(ctx, el);
      await locator.fill(String(step.inputData ?? ''));
      break;
    }
    case 'click': {
      if (!el) throw new Error('No target element for click');
      const locator = locatorFor(ctx, el);
      await locator.click();
      break;
    }
    case 'select': {
      if (!el) throw new Error('No target element for select');
      const locator = locatorFor(ctx, el);
      // If inputData provided, try to select by value/text; else pick first enabled non-empty option
      const value = step.inputData ? String(step.inputData) : await locator.evaluate((sel: any) => {
        const s = sel as HTMLSelectElement;
        const opt = Array.from(s.options).find(o => !o.disabled && o.value && o.value !== s.value);
        return opt?.value || '';
      });
      if (value) await locator.selectOption({ value }).catch(async () => {
        // fallback to label match
        await locator.selectOption({ label: value }).catch(() => {/* ignore */});
      });
      break;
    }
    case 'assert-text': {
      const expected = String(step.expected ?? '').trim();
      if (!expected) return;
      await ctx.waitForTimeout(200); // brief wait for DOM update
      const found = await ctx.getByText(expected).first();
      await found.waitFor({ state: 'visible', timeout: 3000 });
      break;
    }
    case 'assert-url': {
      const expected = String(step.expected ?? '').trim();
  const url = ctx.url ? ctx.url() : (ctx as any).url();
      if (expected.startsWith('contains:')) {
        const needle = expected.slice('contains:'.length);
        if (!url.includes(needle)) throw new Error(`URL does not contain '${needle}': ${url}`);
      } else if (expected.startsWith('not:')) {
        const not = expected.slice('not:'.length);
        if (url === not) throw new Error(`URL should have changed from ${not}`);
      } else if (expected) {
        if (url !== expected) throw new Error(`URL mismatch. Expected ${expected}, got ${url}`);
      }
      break;
    }
    case 'assert-visible': {
      if (!el) throw new Error('No target element for assert-visible');
      const locator = locatorFor(ctx, el);
      await locator.waitFor({ state: 'visible', timeout: 3000 });
      break;
    }
    case 'assert-hidden': {
      if (!el) throw new Error('No target element for assert-hidden');
      const locator = locatorFor(ctx, el);
      await locator.waitFor({ state: 'hidden', timeout: 3000 });
      break;
    }
    case 'assert-checked': {
      if (!el) throw new Error('No target element for assert-checked');
      const locator = locatorFor(ctx, el);
      const ok = await (locator as any).isChecked?.();
      if (ok !== true) throw new Error('Element is not checked');
      break;
    }
    default:
      // no-op for unknown actions in MVP
      break;
  }
}

function locatorFor(page: PWPage | PWFrame, el: PageModel['elements'][number]) {
  for (const candidate of el.locatorCandidates) {
    if (candidate.startsWith('text=')) {
      const txt = candidate.substring(5);
    const loc = (page as any).getByText(txt, { exact: true });
      return loc;
    }
    if (candidate.startsWith('#') || candidate.startsWith('[')) {
    return (page as any).locator(candidate);
    }
  }
  // fallback by role/text
  if (el.attributes['aria-label']) return (page as any).getByLabel(el.attributes['aria-label']);
  if (el.role) return (page as any).getByRole(el.role as any);
  if (el.text) return (page as any).getByText(el.text);
  throw new Error('No valid locator');
}

async function frameFor(page: PWPage, frameUrl?: string | undefined): Promise<PWPage | PWFrame> {
  if (!frameUrl) return page;
  const frame = page.frames().find((f: any) => f.url() === frameUrl);
  return frame || page;
}
