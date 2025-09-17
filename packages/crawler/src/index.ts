import { PageModel, PageElement, CrawlResult } from '@autotest/core';
// IMPORTANT: Do not import Playwright at top-level to avoid bundling issues in environments (e.g. Next.js build)
// We will lazy import it only if dynamic crawling is explicitly requested at runtime.
// type-only imports are avoided to prevent the bundler from following them; we will use 'any' internally.
import { nanoid } from 'nanoid';
import * as cheerio from 'cheerio';

type DomEl = { tagName?: string; attribs?: Record<string, any> };

export interface CrawlOptions {
  maxPages?: number;
  depth?: number;
  sameOrigin?: boolean;
  dynamic?: boolean; // use Playwright
}

interface QueueItem { url: string; depth: number; }

export async function crawl(startUrl: string, opts: CrawlOptions = {}): Promise<CrawlResult> {
  const { maxPages = 10, depth = 1, sameOrigin = true } = opts;
  const dynamicRequested = Boolean(opts.dynamic);
  const dynamicDisabled = process.env.DISABLE_DYNAMIC_CRAWL === 'true';
  if (dynamicRequested && !dynamicDisabled) {
    try {
      return await crawlDynamic(startUrl, { maxPages, depth, sameOrigin });
    } catch (e) {
      // Fallback to static if dynamic fails (e.g. Playwright missing) but include warning in result.
      const fallback = await crawlStatic(startUrl, { maxPages, depth, sameOrigin });
      fallback.warnings.push(`Dynamic crawl failed (${(e as any)?.message || e}); fell back to static.`);
      return fallback;
    }
  }
  return crawlStatic(startUrl, { maxPages, depth, sameOrigin });
}

async function crawlStatic(startUrl: string, opts: Required<Pick<CrawlOptions, 'maxPages' | 'depth' | 'sameOrigin'>>): Promise<CrawlResult> {
  const { maxPages, depth, sameOrigin } = opts;
  const origin = new URL(startUrl).origin;
  const visited = new Set<string>();
  const queue: QueueItem[] = [{ url: startUrl, depth: 0 }];
  const pages: PageModel[] = [];
  const warnings: string[] = [];
  const startedAt = Date.now();

  while (queue.length && pages.length < maxPages) {
    const { url, depth: d } = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    try {
      const res = await fetch(url, { redirect: 'follow' as any });
      const html = await res.text();
      const $ = cheerio.load(html);
      const title = $('title').first().text().trim();

      const elements: PageElement[] = [];
      $('a, button, input, select, textarea').each((_, el: any) => {
        const tag = (el as DomEl).tagName?.toLowerCase?.() || 'unknown';
        const attribs: Record<string, string> = {};
        Object.entries((el as DomEl).attribs || {}).forEach(([k, v]) => (attribs[k] = String(v)));
        if ((attribs['type'] || '').toLowerCase() === 'hidden') return;
        if (attribs['aria-hidden'] === 'true') return;
        const text = $(el).text().trim() || attribs['value'];
        const id = nanoid();
        const locatorCandidates: string[] = [];
        if (attribs['id']) locatorCandidates.push(`#${attribs['id']}`);
        if (attribs['name']) locatorCandidates.push(`[name="${attribs['name']}"]`);
        if (attribs['placeholder']) locatorCandidates.push(`[placeholder="${cssEscape(attribs['placeholder'])}"]`);
        if (attribs['aria-label']) locatorCandidates.push(`[aria-label="${cssEscape(attribs['aria-label'])}"]`);
        if (text && text.length < 60) locatorCandidates.push(`text=${cssEscape(text)}`);
        const formAncestor = $(el).closest('form')[0] as any;
        const formId = formAncestor?.attribs?.id ? String(formAncestor.attribs.id) : undefined;
        const elem: any = {
          id,
          tag,
          text,
          role: attribs['role'],
          attributes: attribs,
          locatorCandidates,
          inferredType: inferElementType(tag, attribs, text),
          containerFormId: formId,
          frameUrl: undefined
        };
        elements.push(elem as PageElement);
      });

      const typeHints = inferPageTypeHints(elements, title);
      pages.push({ id: nanoid(), url, title, typeHints, elements });

      if (d < depth) {
        const hrefs = $('a[href]').map((_, a) => $(a).attr('href') || '').get();
        for (const href of hrefs) {
          if (!href) continue;
          const nextUrl = normalizeUrl(href, url);
          if (!nextUrl) continue;
          if (sameOrigin && new URL(nextUrl).origin !== origin) continue;
          if (!visited.has(nextUrl) && !queue.find(q => q.url === nextUrl)) queue.push({ url: nextUrl, depth: d + 1 });
        }
      }
    } catch (e: any) {
      warnings.push(`Failed to fetch ${url}: ${e.message}`);
    }
  }

  return { pages, startedAt, finishedAt: Date.now(), warnings };
}

async function crawlDynamic(startUrl: string, opts: Required<Pick<CrawlOptions, 'maxPages' | 'depth' | 'sameOrigin'>>): Promise<CrawlResult> {
  const { maxPages, depth, sameOrigin } = opts;
  const origin = new URL(startUrl).origin;
  // Lazy import playwright only here
  let chromium: any;
  try {
    ({ chromium } = await import('playwright'));
  } catch (e) {
    throw new Error('Playwright not available: ' + (e as any)?.message);
  }
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const visited = new Set<string>();
  const queue: QueueItem[] = [{ url: startUrl, depth: 0 }];
  const startedAt = Date.now();
  const warnings: string[] = [];
  const pages: PageModel[] = [];

  while (queue.length && pages.length < maxPages) {
    const { url, depth: d } = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const title = await page.title();

  const collectFrom = async (ctx: any) => ctx.evaluate(() => {
        const results: Array<{ tag: string; text: string; role: string | null; attributes: Record<string,string>; containerFormId?: string } > = [];
        const stopper = 8000; // safety cap
        let count = 0;
        const toStr = (v: any) => (v == null ? '' : String(v));
        function isVisible(el: Element): boolean {
          const style = window.getComputedStyle(el as any);
          const rect = (el as HTMLElement).getBoundingClientRect();
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) return false;
          if (rect.width === 0 || rect.height === 0) return false;
          return true;
        }
        function include(el: Element): boolean {
          const tag = el.tagName.toLowerCase();
          if (!['a','button','input','select','textarea'].includes(tag)) return false;
          if (tag === 'input') {
            const type = (el as HTMLInputElement).type?.toLowerCase?.() || 'text';
            if (type === 'hidden') return false;
            if ((el as HTMLInputElement).disabled) return false;
          }
          if ((el as any).closest && (el as HTMLElement).closest('[aria-hidden="true"]')) return false;
          return isVisible(el);
        }
        function attrs(el: Element): Record<string,string> {
          const names = (el as any).getAttributeNames?.() || [];
          const obj: Record<string,string> = {};
          for (const n of names) obj[n] = toStr((el as any).getAttribute(n));
          return obj;
        }
        function walk(root: Node) {
          if (count > stopper) return;
          const el = root as Element;
          if ((el as any).nodeType === Node.ELEMENT_NODE) {
            if (include(el)) {
              const a = attrs(el);
              const role = el.getAttribute('role');
              let text = '';
              const tag = el.tagName.toLowerCase();
              if (tag === 'input' || tag === 'textarea') {
                text = (a['value'] || a['placeholder'] || '').trim();
              } else {
                text = (el.textContent || '').trim();
              }
              const form = (el as HTMLElement).closest('form');
              results.push({ tag: el.tagName.toLowerCase(), text, role, attributes: a, containerFormId: form?.id || undefined });
              count++;
            }
            const sr = (el as any).shadowRoot as ShadowRoot | null;
            if (sr) Array.from(sr.childNodes).forEach(walk);
          }
          Array.from(root.childNodes || []).forEach(walk);
        }
        walk(document.documentElement);
        return results;
      });

      const elements: PageElement[] = [];
      const mainEls = await collectFrom(page);
      for (const el of mainEls) {
        const attribs = el.attributes;
        const tag = el.tag;
        const text = el.text || attribs['value'];
        const id = nanoid();
        const locatorCandidates: string[] = [];
        if (attribs['id']) locatorCandidates.push(`#${attribs['id']}`);
        if (attribs['name']) locatorCandidates.push(`[name="${attribs['name']}"]`);
        if (attribs['placeholder']) locatorCandidates.push(`[placeholder="${cssEscape(attribs['placeholder'])}"]`);
        if (attribs['aria-label']) locatorCandidates.push(`[aria-label="${cssEscape(attribs['aria-label'])}"]`);
        if (text && text.length < 60) locatorCandidates.push(`text=${cssEscape(text)}`);
        const elem: any = { id, tag, text, role: el.role || undefined, attributes: attribs, locatorCandidates, inferredType: inferElementType(tag, attribs, text), containerFormId: el.containerFormId, frameUrl: undefined };
        elements.push(elem as PageElement);
      }
  const frames = page.frames().filter((f: any) => f !== page.mainFrame());
      for (const f of frames) {
        try {
          const furl = f.url();
          const fels = await collectFrom(f);
          for (const el of fels) {
            const attribs = el.attributes;
            const tag = el.tag;
            const text = el.text || attribs['value'];
            const id = nanoid();
            const locatorCandidates: string[] = [];
            if (attribs['id']) locatorCandidates.push(`#${attribs['id']}`);
            if (attribs['name']) locatorCandidates.push(`[name="${attribs['name']}"]`);
            if (attribs['placeholder']) locatorCandidates.push(`[placeholder="${cssEscape(attribs['placeholder'])}"]`);
            if (attribs['aria-label']) locatorCandidates.push(`[aria-label="${cssEscape(attribs['aria-label'])}"]`);
            if (text && text.length < 60) locatorCandidates.push(`text=${cssEscape(text)}`);
            const elem: any = { id, tag, text, role: el.role || undefined, attributes: attribs, locatorCandidates, inferredType: inferElementType(tag, attribs, text), containerFormId: el.containerFormId, frameUrl: furl };
            elements.push(elem as PageElement);
          }
        } catch {
          // ignore frame parse errors
        }
      }

      const typeHints = inferPageTypeHints(elements, title);
      pages.push({ id: nanoid(), url, title, typeHints, elements });

      if (d < depth) {
        const hrefs = await page.$$eval('a[href]', (as: Element[]) => as.map((a: Element) => (a as HTMLAnchorElement).getAttribute('href')));
        for (const href of hrefs) {
          if (!href) continue;
          const nextUrl = normalizeUrl(href, url);
          if (!nextUrl) continue;
          if (sameOrigin && new URL(nextUrl).origin !== origin) continue;
          if (!visited.has(nextUrl) && !queue.find(q => q.url === nextUrl)) queue.push({ url: nextUrl, depth: d + 1 });
        }
      }
    } catch (e: any) {
      warnings.push(`Failed to navigate ${url}: ${e.message}`);
    }
  }

  await browser.close();
  return { pages, startedAt, finishedAt: Date.now(), warnings };
}

function normalizeUrl(href: string, baseUrl: string): string | null {
  try {
    const u = new URL(href, baseUrl);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      u.hash = '';
      return u.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function inferElementType(tag: string, attribs: Record<string, string>, text?: string): string | undefined {
  if (tag === 'input') {
    const type = (attribs['type'] || 'text').toLowerCase();
    return type;
  }
  if (tag === 'button') return 'button';
  if (tag === 'a') return 'link';
  if (tag === 'select') return 'select';
  if (tag === 'textarea') return 'textarea';
  if (text && /login|sign in/i.test(text)) return 'login-action';
  return undefined;
}

function inferPageTypeHints(elements: PageElement[], title?: string): string[] {
  const hints: string[] = [];
  const inputCount = elements.filter(e => e.tag === 'input').length;
  const buttonCount = elements.filter(e => e.tag === 'button').length;
  if (inputCount >= 2 && buttonCount >= 1) hints.push('form');
  if (title && /login|sign in/i.test(title)) hints.push('login');
  const hasPassword = elements.some(e => e.inferredType === 'password');
  if (hasPassword) hints.push('auth');
  return [...new Set(hints)];
}

// Minimal CSS.escape fallback (not full spec) for selector safety
function cssEscape(text: string): string {
  return text.replace(/[^a-zA-Z0-9_\- ]/g, '\\$&');
}
