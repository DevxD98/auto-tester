#!/usr/bin/env node
// Load environment variables from .env if present (for API keys like HUGGINGFACE_API_KEY, GROQ_API_KEY)
import fs from 'fs';
import path from 'path';
const dotEnvPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(dotEnvPath)) {
  try {
    const lines = fs.readFileSync(dotEnvPath, 'utf-8').split(/\r?\n/);
    for (const l of lines) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const [, k, v] = m;
      if (process.env[k] === undefined) process.env[k] = v.replace(/^"|"$/g, '');
    }
  } catch {
    // ignore .env parsing errors
  }
}
import { crawl } from '@autotest/crawler';
import { parseRequirements } from '@autotest/ai';
import { generateTests } from '@autotest/generator';
import { runTest } from '@autotest/runner';
import { summarizeRun } from '@autotest/reporting';
import { PageModel, TestSpec } from '@autotest/core';
// fs/path already imported above
import yargs, { Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';

interface CLIArgs {
  url: string;
  requirements?: string;
  outDir?: string;
  depth?: number;
}

async function main() {
  const raw = hideBin(process.argv);
  if (raw[0] === '--') raw.shift();
  const argv = await yargs(raw)
    .command('generate', 'Crawl site and generate tests', (y: Argv) => y
      .option('url', { type: 'string', demandOption: true })
      .option('requirements', { type: 'string', describe: 'Path to text file of requirements' })
      .option('depth', { type: 'number', default: 1 })
      .option('dynamic', { type: 'boolean', default: true, describe: 'Use Playwright for dynamic crawling' })
      .option('headless', { type: 'boolean', default: true, describe: 'Headless browser for runner' })
      .option('outDir', { type: 'string', default: 'generated-tests' })
    )
    .help()
    .parseAsync() as unknown as CLIArgs & { _: string[] };

  const command = argv._[0];
  if (command === 'generate') {
  const crawlResult = await crawl(argv.url, { depth: argv.depth, dynamic: (argv as any).dynamic } as any);
    const reqText = argv.requirements ? fs.readFileSync(argv.requirements, 'utf-8') : 'General usability';
    const parsed = parseRequirements(reqText);
    const allTests: TestSpec[] = [];
    crawlResult.pages.forEach((p: PageModel) => {
      const tests = generateTests(p, parsed.entities, {});
      allTests.push(...tests);
    });
    const outDir = argv.outDir || 'generated-tests';
    fs.mkdirSync(outDir, { recursive: true });
    const specPath = path.join(outDir, 'tests.json');
    fs.writeFileSync(specPath, JSON.stringify(allTests, null, 2));
    console.log(`Generated ${allTests.length} tests at ${specPath}`);

    // Run immediately
    const runResults = [] as any[];
    for (const t of allTests) {
      const pm = crawlResult.pages.find(p => p.id === t.pageModelId)!;
      // use real Playwright runner
      // eslint-disable-next-line no-await-in-loop
      const r = await runTest(t as any, pm as any, {
        headless: (argv as any).headless,
        outDir: 'artifacts',
        onEvent: (e: any) => {
          const time = new Date(e.timestamp || Date.now()).toISOString();
          switch (e.type) {
            case 'test-start':
              console.log(`[${time}] ▶ Test ${e.testId} start: ${pm.title || pm.url}`);
              break;
            case 'step-start':
              console.log(`[${time}] • Step ${e.stepIndex + 1} start: ${e.description}`);
              break;
            case 'step-end':
              console.log(`[${time}] ${e.status === 'passed' ? '✓' : '✗'} Step ${e.stepIndex + 1} ${e.status}${e.error ? `: ${e.error}` : ''}`);
              break;
            case 'test-end':
              console.log(`[${time}] ▶ Test ${e.testId} end: ${e.status}`);
              break;
          }
        }
      } as any);
      runResults.push(r);
    }
    const summary = summarizeRun(runResults, allTests);
    const summaryPath = path.join(outDir, 'summary.md');
    fs.writeFileSync(summaryPath, summary);
    console.log(summary);
    console.log(`Summary written to ${summaryPath}`);
  } else {
    console.error('Unknown command');
    process.exit(1);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
