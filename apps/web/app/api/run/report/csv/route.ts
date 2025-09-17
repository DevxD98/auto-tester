import { NextRequest } from 'next/server';
import { runStore } from '../../../internal/orchestrator';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('runId');
  if (!runId) return new Response('runId required', { status: 400 });
  const record = runStore.get(runId);
  if (!record || record.status !== 'completed' || !record.testResults) return new Response('Run not completed', { status: 404 });

  const rows: string[] = [];
  
  // Header section with run metadata
  rows.push(['TestFlowAI Test Run Report'].join(','));
  rows.push(['Run ID', runId].join(','));
  rows.push(['URL Tested', record.config.url].join(','));
  rows.push(['Execution Date', new Date(record.createdAt).toLocaleString()].join(','));
  rows.push(['Completion Date', new Date(record.results?.finishedAt || 0).toLocaleString()].join(','));
  rows.push(['Total Tests Generated', String(record.results?.testsGenerated || 0)].join(','));
  rows.push(['Tests Passed', String(record.results?.testsPassed || 0)].join(','));
  rows.push(['Tests Failed', String(record.results?.testsFailed || 0)].join(','));
  rows.push(['Pass Rate', `${record.results?.testsPassed && record.results?.testsGenerated ? Math.round((record.results.testsPassed / record.results.testsGenerated) * 100) : 0}%`].join(','));
  rows.push(['AI Generation Used', record.aiGeneration?.used ? `Yes (${record.aiGeneration.provider || 'unknown'})` : 'No'].join(','));
  rows.push([''].join(',')); // Empty row separator
  
  // Test results table header
  rows.push(['Test ID','Test Name','Test Status','Test Priority','Test Tags','Step Index','Step Description','Step Status','Start Time','End Time','Duration (ms)','Error Message','Evidence URL'].join(','));
  
  const nameMap = new Map(record.tests?.map(t => [t.id, t.name]) as any);
  const testMap = new Map(record.tests?.map(t => [t.id, t]) as any);
  
  for (const r of record.testResults) {
    const test = testMap.get(r.testId) as any;
    const tName = nameMap.get(r.testId) || r.testId;
    const priority = test?.priority || 'medium';
    const tags = test?.tags?.join('; ') || '';
    
    for (const s of r.stepResults) {
      const dur = s.endTime - s.startTime;
      const stepDesc = test?.steps?.[s.stepIndex]?.description || '';
      const startTime = new Date(s.startTime).toLocaleString();
      const endTime = new Date(s.endTime).toLocaleString();
      
      const cols = [
        csv(String(r.testId)), 
        csv(String(tName)), 
        csv(String(r.status).toUpperCase()), 
        csv(String(priority).toUpperCase()),
        csv(tags),
        String(s.stepIndex + 1), 
        csv(stepDesc),
        csv(String(s.status).toUpperCase()), 
        csv(startTime), 
        csv(endTime), 
        String(dur), 
        csv(s.error || ''), 
        csv(s.evidence ? `https://your-domain.com${s.evidence}` : '')
      ];
      rows.push(cols.join(','));
    }
  }
  
  const body = rows.join('\n');
  const filename = `TestFlowAI_Report_${runId}_${new Date().toISOString().split('T')[0]}.csv`;
  return new Response(body, { 
    headers: { 
      'Content-Type': 'text/csv; charset=utf-8', 
      'Content-Disposition': `attachment; filename="${filename}"` 
    } 
  });
}

function csv(v: string) {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
