import { PageModel, RequirementEntity, TestSpec, PageElement, TestStep } from '@autotest/core';
import { nanoid } from 'nanoid';

// Heuristic test generator (no AI yet)

export interface HeuristicGeneratorOptions {
  defaultPriority?: 'low' | 'medium' | 'high';
}

export function generateTests(page: PageModel, requirements: RequirementEntity[], opts: HeuristicGeneratorOptions = {}): TestSpec[] {
  const { defaultPriority = 'medium' } = opts;
  const tests: TestSpec[] = [];
  // 1) Navigation tests for links/buttons that navigate
  const navCandidates = page.elements.filter(e => (e.tag === 'a') || (e.tag === 'button' && /next|continue|login|submit|go|start|dashboard/i.test(e.text || '')));
  for (const link of navCandidates.slice(0, 5)) {
    const spec: TestSpec = {
      id: nanoid(),
      name: `Navigate via ${link.tag} (${link.text || link.attributes['href'] || link.id})`,
      requirementRefs: requirements.map(r => r.id),
      pageModelId: page.id,
      priority: defaultPriority,
      tags: ['heuristic','nav'],
      steps: [
        { description: `Click ${link.text || link.id}`, action: 'click', targetElementId: link.id },
        { description: 'URL should change', action: 'assert-url', expected: 'not:' + page.url }
      ]
    };
    tests.push(spec);
  }
  const controlElements = page.elements.filter((e: PageElement) => ['input', 'select', 'textarea'].includes(e.tag));
  if (controlElements.length) {
    // happy path: fill all text-like inputs with dummy values
    const submitBtn = page.elements.find((e: PageElement) =>
      e.tag === 'button' ||
      (e.tag === 'input' && (e.attributes['type'] || '').toLowerCase() === 'submit') ||
      ((e.attributes['type'] || '').toLowerCase() === 'submit') ||
      (e.text && /submit|login|sign in/i.test(e.text))
    );
    const submitBtnId = submitBtn?.id;
  const submitFormId = (page.elements.find(e => e.id === submitBtnId) as any)?.containerFormId as string | undefined;
  const controlsInForm = submitFormId ? controlElements.filter((c: any) => c.containerFormId === submitFormId) : controlElements;
  const relevant = pickRelevantControlsNearSubmit(page, submitBtnId, controlsInForm);
    const happySteps: TestStep[] = relevant.map((f: PageElement): TestStep => ({
      description: `Enter value for ${f.attributes['name'] || f.text || f.id}`,
      action: f.tag === 'select' ? 'select' : 'fill',
      targetElementId: f.id,
      inputData: dummyValueFor(f.inferredType)
    }));
    const submitStep: TestStep = {
      description: 'Submit form (heuristic: first button)',
      action: 'click',
      ...(submitBtnId ? { targetElementId: submitBtnId } : {})
    } as TestStep;
    tests.push({
      id: nanoid(),
      name: `Form submission happy path (${page.title || page.url})`,
      requirementRefs: requirements.map(r => r.id),
      pageModelId: page.id,
      steps: [...happySteps, submitStep],
      negative: false,
      priority: defaultPriority,
      tags: ['heuristic', 'form']
    });

    // negative: leave first required-looking element blank (heuristic: has required attribute)
    const required = relevant.find((f: PageElement) => f.attributes['required'] !== undefined) || relevant[0];
    if (required) {
      const negSteps: TestStep[] = relevant.map((f: PageElement): TestStep => ({
        description: `Enter value for ${f.attributes['name'] || f.id}`,
        action: f.tag === 'select' ? 'select' : 'fill',
        targetElementId: f.id,
        inputData: f.id === required.id ? '' : dummyValueFor(f.inferredType)
      }));
      const submitNeg = page.elements.find((e: PageElement) =>
        e.tag === 'button' ||
        (e.tag === 'input' && (e.attributes['type'] || '').toLowerCase() === 'submit') ||
        ((e.attributes['type'] || '').toLowerCase() === 'submit') ||
        (e.text && /submit|login|sign in/i.test(e.text))
      );
      const submitNegId = submitNeg?.id;
  const submitNegStep: TestStep = {
        description: 'Submit form',
        action: 'click',
        ...(submitNegId ? { targetElementId: submitNegId } : {}),
  expected: 'Validation error displayed'
      } as TestStep;
      tests.push({
        id: nanoid(),
        name: `Form missing required field (${required.attributes['name'] || required.id})`,
        requirementRefs: requirements.map(r => r.id),
        pageModelId: page.id,
        steps: [...negSteps, submitNegStep],
        negative: true,
        priority: defaultPriority,
        tags: ['heuristic', 'form', 'negative']
      });
    }
  }
  // 3) Checkbox toggles: simple visible assertion after click
  const checkboxes = page.elements.filter(e => e.tag === 'input' && (e.attributes['type'] || '').toLowerCase() === 'checkbox');
  for (const cb of checkboxes.slice(0, 3)) {
    tests.push({
      id: nanoid(),
      name: `Toggle checkbox (${cb.attributes['name'] || cb.id})`,
      requirementRefs: requirements.map(r => r.id),
      pageModelId: page.id,
      priority: 'low',
      tags: ['heuristic','checkbox'],
      steps: [
        { description: 'Click checkbox', action: 'click', targetElementId: cb.id },
        { description: 'Checkbox should be visible', action: 'assert-visible', targetElementId: cb.id }
      ]
    });
  }
  // 4) Modal open/close heuristic: look for buttons with text like 'open' and 'close'
  const modalOpener = page.elements.find(e => (e.tag === 'button' || e.tag === 'a') && /open|modal|dialog/i.test(e.text || ''));
  const modalCloser = page.elements.find(e => (e.tag === 'button' || e.tag === 'a') && /close|dismiss/i.test(e.text || ''));
  if (modalOpener && modalCloser) {
    tests.push({
      id: nanoid(),
      name: 'Open and close modal (heuristic)',
      requirementRefs: requirements.map(r => r.id),
      pageModelId: page.id,
      priority: 'low',
      tags: ['heuristic','modal'],
      steps: [
        { description: `Open modal via ${modalOpener.text || modalOpener.id}`, action: 'click', targetElementId: modalOpener.id },
        { description: 'Modal text should appear', action: 'assert-text', expected: 'close' },
        { description: 'Close modal', action: 'click', targetElementId: modalCloser.id }
      ]
    });
  }
  return tests;
}

function dummyValueFor(t?: string) {
  switch (t) {
    case 'email': return 'user@example.com';
    case 'password': return 'P@ssw0rd!';
    case 'search': return 'test';
    case 'select': return '1';
    default: return 'value';
  }
}

function pickRelevantControlsNearSubmit(page: PageModel, submitId: string | undefined, controls: PageElement[]): PageElement[] {
  const allowedTypes = new Set(['text','email','password','search','tel','url','number','']);
  const filtered = controls.filter(c => {
    const t = (c.inferredType || '').toLowerCase();
    if (c.tag === 'select' || c.tag === 'textarea') return true;
    if (c.tag === 'input' && allowedTypes.has(t)) return true;
    return false;
  });
  if (!submitId) return filtered.slice(0, Math.min(3, filtered.length));
  const idxMap = new Map<string, number>();
  page.elements.forEach((e, i) => idxMap.set(e.id, i));
  const submitIdx = idxMap.get(submitId) ?? 0;
  const scored = filtered.map(f => {
    const i = idxMap.get(f.id) ?? 0;
    const name = (f.attributes['name'] || '').toLowerCase();
    const text = (f.text || '').toLowerCase();
    const semantic = /user|email|mail/.test(name + ' ' + text) ? 0 : /pass|pwd/.test(name + ' ' + text) ? 1 : 2;
    const distance = Math.abs(i - submitIdx);
    return { f, score: distance + semantic * 0.1 };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, Math.min(3, scored.length)).map(s => s.f);
}
