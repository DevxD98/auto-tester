import { RunResult, TestSpec } from '@autotest/core';

export function summarizeRun(results: RunResult[], tests: TestSpec[]): string {
  const total = results.length;
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const lines: string[] = [];
  lines.push(`# Test Run Summary`);
  lines.push(`Total: ${total}, Passed: ${passed}, Failed: ${failed}`);
  if (failed) {
    lines.push(`\n## Failed Tests`);
    for (const r of results.filter(r => r.status === 'failed')) {
      const t = tests.find(t => t.id === r.testId);
      lines.push(`- ${t?.name || r.testId}`);
    }
  }
  return lines.join('\n');
}
