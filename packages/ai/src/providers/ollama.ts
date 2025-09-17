import type { AiProvider } from '..';
import type { PageModel, TestSpec } from '@autotest/core';
import { nanoid } from 'nanoid';

type Cfg = { host: string; model: string; temperature?: number };

export class OllamaProvider implements AiProvider {
  constructor(private cfg: Cfg) {}
  name() { return 'ollama'; }

  async generateTests(input: { pageModels: PageModel[]; requirementsText?: string; maxTests?: number }): Promise<TestSpec[]> {
    const { host, model } = this.cfg;
    const prompt = this.buildPrompt(input.pageModels, input.requirementsText, input.maxTests ?? 6);
    try {
      const res = await fetch(`${host.replace(/\/$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false, options: { temperature: this.cfg.temperature ?? 0.2 } })
      });
      if (!res.ok) return [];
      const data: any = await res.json();
      const text: string = data?.response || '';
      const json = this.extractJson(text);
      if (!json) return [];
      let parsed: any; try { parsed = JSON.parse(json); } catch { return []; }
      const arr = Array.isArray(parsed) ? parsed : parsed.tests;
      if (!Array.isArray(arr)) return [];
      return arr.slice(0, input.maxTests ?? 6).map((t: any) => ({
        id: String(t.id || nanoid()),
        name: String(t.name || 'AI Generated Test'),
        negative: Boolean(t.negative),
        requirementRefs: Array.isArray(t.requirementRefs) ? t.requirementRefs.map(String) : [],
        pageModelId: String(t.pageModelId || input.pageModels[0]?.id || 'unknown'),
        priority: (t.priority === 'low' || t.priority === 'high') ? t.priority : 'medium',
        tags: Array.isArray(t.tags) ? t.tags.map(String) : ['ai'],
        steps: Array.isArray(t.steps) ? t.steps.map((s: any) => ({
          action: String(s.action),
          description: String(s.description || ''),
          targetElementId: s.targetElementId ? String(s.targetElementId) : undefined,
          inputData: s.inputData,
          expected: s.expected ? String(s.expected) : undefined
        })) : []
      }));
    } catch {
      return [];
    }
  }

  private buildPrompt(models: PageModel[], requirementsText: string | undefined, maxTests: number) {
    const compact = models.slice(0, 2).map(pm => ({
      id: pm.id, url: pm.url, title: pm.title, typeHints: pm.typeHints,
      elements: pm.elements.slice(0, 120).map(e => ({ id: e.id, tag: e.tag, role: e.role, text: (e.text || '').slice(0, 50), attrs: { name: e.attributes?.name, placeholder: e.attributes?.placeholder, type: e.attributes?.type, ariaLabel: e.attributes?.['aria-label'] }, form: e.containerFormId || null }))
    }));
    const system = `You generate end-to-end web UI tests from a page model. Return ONLY valid JSON. No prose. Allowed actions: fill | click | select | assert-text | assert-url | assert-visible | assert-hidden.`;
    const schema = `JSON schema (informal): { "tests": [ { "id": "string", "name": "string", "negative": false, "priority": "low|medium|high", "tags": ["ai"], "pageModelId": "${compact[0]?.id || ''}", "steps": [ { "action": "fill", "targetElementId": "...", "inputData": "...", "description": "..." } ] } ] }`;
    const user = { instructions: { maxTests, focus: ['forms','auth','navigation','edge cases'] }, requirementsText: requirementsText || null, pageModels: compact };
    return `${system}\n${schema}\nINPUT:\n${JSON.stringify(user)}`;
  }

  private extractJson(text: string): string | null {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    return text.slice(start, end + 1);
  }
}
