import { RequirementParseResponse, RequirementEntity, PageModel, TestSpec } from '@autotest/core';
import { HuggingFaceProvider } from './providers/huggingface';
import { OllamaProvider } from './providers/ollama';
// Groq provider is loaded lazily to keep optional dependency flexible
import { nanoid } from 'nanoid';

// Stub AI provider: deterministic requirement parser splitting by line.

export function parseRequirements(raw: string): RequirementParseResponse {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const entities: RequirementEntity[] = lines.map(line => ({
    id: nanoid(),
    raw: line,
    // naive actor/action extraction (placeholder)
    actor: undefined,
    action: undefined,
    object: undefined,
    qualifiers: [],
    acceptanceCriteria: []
  }));
  return {
    entities,
    raw,
    provider: 'stub',
    model: 'heuristic-v1'
  };
}

// ---- Test generation AI provider interfaces ----
export interface AiConfig {
  provider?: 'none' | 'huggingface' | 'openai' | 'groq' | 'ollama';
  model?: string;
  endpoint?: string; // for ollama/local http
  apiKey?: string; // for hosted providers
  temperature?: number;
}

export interface AiProvider {
  name(): string;
  generateTests(input: { pageModels: PageModel[]; requirementsText?: string; maxTests?: number }): Promise<TestSpec[]>;
}

export class NoAiProvider implements AiProvider {
  name() { return 'none'; }
  async generateTests(): Promise<TestSpec[]> { return []; }
}

export async function getAiProvider(cfg: AiConfig = {}): Promise<AiProvider> {
  const provider = cfg.provider || (process.env.AI_PROVIDER as any) || 'none';
  // Prefer Groq automatically if key present and provider not explicitly set
  if ((provider === 'none' || provider === 'groq') && (cfg.apiKey || process.env.GROQ_API_KEY)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GroqProvider } = require('./providers/groq') as { GroqProvider: any };
    return new GroqProvider({
      model: cfg.model || process.env.GROQ_MODEL || 'llama-3.3-8b-instant',
      apiKey: cfg.apiKey || process.env.GROQ_API_KEY,
      temperature: cfg.temperature ?? 0.2
    });
  }
  if (provider === 'huggingface') {
    return new HuggingFaceProvider({
      model: cfg.model || process.env.HF_MODEL || 'bigscience/bloom-560m',
      apiKey: cfg.apiKey || process.env.HUGGINGFACE_API_KEY,
      temperature: cfg.temperature ?? 0.2
    });
  }
  if (provider === 'ollama') {
    const host = cfg.endpoint || process.env.OLLAMA_HOST || 'http://localhost:11434';
    const model = cfg.model || process.env.OLLAMA_MODEL || 'llama3.1:8b-instruct';
    return new OllamaProvider({ host, model, temperature: cfg.temperature });
  }
  return new NoAiProvider();
}
