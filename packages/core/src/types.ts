// Core shared type definitions

export interface PageElement {
  id: string; // internal uuid
  tag: string;
  text?: string;
  role?: string;
  attributes: Record<string, string>;
  locatorCandidates: string[]; // CSS/XPath/text/role selectors attempted in order
  inferredType?: string; // e.g. 'email', 'password', 'search', 'button', 'link'
  validationRules?: string[]; // free-form description discovered later
  containerFormId?: string; // id of nearest form ancestor if any
  frameUrl?: string; // url of the frame where the element was found (or undefined for main)
}

export interface PageModel {
  id: string;
  url: string;
  title?: string;
  typeHints: string[]; // e.g. ['form', 'login']
  elements: PageElement[];
}

export interface RequirementEntity {
  id: string;
  raw: string;
  actor?: string;
  action?: string;
  object?: string;
  qualifiers?: string[];
  acceptanceCriteria?: string[];
}

export interface TestStep {
  description: string;
  action: string; // semantic action name
  targetElementId?: string;
  inputData?: any;
  expected?: string; // human readable expectation
}

export interface TestSpec {
  id: string;
  name: string;
  requirementRefs: string[];
  pageModelId: string;
  steps: TestStep[];
  negative?: boolean;
  priority: 'low' | 'medium' | 'high';
  tags?: string[];
  dataVariants?: Record<string, any[]>; // fieldName -> array of values
}

export interface StepResult {
  stepIndex: number;
  status: 'passed' | 'failed' | 'skipped';
  error?: string;
  evidence?: string; // path to screenshot or log snippet
  startTime: number;
  endTime: number;
}

export interface RunResult {
  testId: string;
  startedAt: number;
  finishedAt: number;
  status: 'passed' | 'failed' | 'partial';
  stepResults: StepResult[];
  artifacts: string[]; // general artifact file paths
  environment: Record<string, string>;
}

export type RunnerEvent =
  | { type: 'test-start'; testId: string; pageUrl: string; timestamp: number }
  | { type: 'step-start'; testId: string; stepIndex: number; description: string; timestamp: number }
  | { type: 'step-end'; testId: string; stepIndex: number; status: 'passed' | 'failed'; evidence?: string; error?: string; timestamp: number }
  | { type: 'test-end'; testId: string; status: 'passed' | 'failed' | 'partial'; timestamp: number }
  | { type: 'log'; testId: string; level: 'info' | 'warn' | 'error'; message: string; timestamp: number };

export interface CrawlResult {
  pages: PageModel[];
  startedAt: number;
  finishedAt: number;
  warnings: string[];
}

export interface AIProviderConfig {
  provider: 'stub' | 'openai' | 'anthropic' | 'local';
  model?: string;
  apiKeyEnvVar?: string; // name of env var that holds key
}

export interface RequirementParseResponse {
  entities: RequirementEntity[];
  raw: string;
  provider: string;
  model: string;
}

export interface TestGenerationContext {
  page: PageModel;
  requirements: RequirementEntity[];
}

export interface TestGenerationProviderResult {
  generated: TestSpec[];
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface EmbeddingVector {
  model: string;
  dim: number;
  values: number[];
}

export interface SemanticElementIndexItem {
  elementId: string;
  pageId: string;
  text: string;
  embedding?: EmbeddingVector;
}

export interface RequirementIndexItem {
  requirementId: string;
  text: string;
  embedding?: EmbeddingVector;
}
