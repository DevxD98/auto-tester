# Autotest AI (MVP Skeleton)

Monorepo for autonomous test generation prototype.

## Current Capabilities
- Crawl static HTML pages heuristically (no JS execution yet)
- Parse requirements file (stub line splitter)
- Generate heuristic form tests (happy + negative)
- Simulated runner executes tests
- Markdown summary report

## Planned Next
- Integrate Playwright for dynamic crawling & real execution
- Add LLM-based requirement parsing & test expansion
- Add embeddings & similarity mapping

## Quick Start
Install dependencies:
```bash
pnpm install
```
Build all packages:
```bash
pnpm build
```
Generate tests (example):
```bash
pnpm --filter @autotest/cli run dev -- generate --url https://example.com --depth 0
```
Output in `generated-tests/`.

## Packages
- `@autotest/core` – shared types
- `@autotest/crawler` – heuristic static crawler
- `@autotest/ai` – stub requirement parser
- `@autotest/generator` – heuristic test generator
- `@autotest/runner` – simulated runner
- `@autotest/reporting` – summary generation
- `@autotest/cli` – command-line orchestrator

## License
Proprietary (adjust as needed).
