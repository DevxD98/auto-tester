"use client";

import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';

function Markdown({ md }: { md: string }) {
  const lines = md.split(/\r?\n/);
  const elements: JSX.Element[] = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-lg font-semibold text-gray-800 mt-6 mb-3 border-b border-gray-200 pb-2">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-xl font-bold text-gray-900 mt-6 mb-4">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="text-2xl font-bold text-gray-900 mt-8 mb-4">
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      // Collect consecutive bullet points
      const bullets: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        const bulletText = lines[i].trim().slice(2).trim();
        if (bulletText) bullets.push(bulletText);
        i++;
      }
      i--; // Back up one since we'll increment at the end of the loop
      
      if (bullets.length > 0) {
        elements.push(
          <ul key={i} className="list-disc list-inside space-y-2 ml-4 mb-4 text-gray-700">
            {bullets.map((bullet, idx) => (
              <li key={idx} className="leading-relaxed">{bullet}</li>
            ))}
          </ul>
        );
      }
    } else if (line.length > 0) {
      // Regular paragraph
      elements.push(
        <p key={i} className="text-gray-700 leading-relaxed mb-3">
          {line}
        </p>
      );
    }
    
    i++;
  }
  
  return (
    <div className="prose prose-sm max-w-none">
      {elements}
    </div>
  );
}

export default function ReportPage({ params }: { params: { runId: string } }) {
  const { runId } = params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/run/report?runId=${runId}`);
        if (!res.ok) throw new Error('Failed to fetch report');
        const data = await res.json();
        if (!cancelled) setReport(data);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load report');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [runId]);

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h1 className="card-title flex items-center gap-2">
            <FileText size={20} className="text-blue-500" />
            Test Report
          </h1>
          <p className="text-sm text-gray-500">If AI shows as not used, verify your keys at <a className="underline" href="/api/ai/check" target="_blank">/api/ai/check</a> (Groq, Gemini, or Hugging Face).</p>
        </div>
        <div className="card-body">
          {loading && <div className="status-badge status-running">Generating report…</div>}
          {error && <div className="status-badge status-failed">{error}</div>}
          {report && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 justify-end mb-2">
                {report.ai && (
                  <span className={`status-badge ${report.ai.used ? 'status-ready' : 'status-idle'}`} title={report.ai.used ? `AI: ${report.ai.provider} (${report.ai.model})` : 'AI disabled or unavailable'}>
                    {report.ai.used ? `AI: ${report.ai.provider || 'unknown'} (${report.ai.model || ''})` : 'AI: not used'}
                  </span>
                )}
                {report.aiGeneration && (
                  <span className={`status-badge ${report.aiGeneration.used ? 'status-ready' : 'status-idle'}`} title={report.aiGeneration.used ? `AI gen: ${report.aiGeneration.provider || 'unknown'} (${report.aiGeneration.model || ''})` : 'AI generation disabled or returned no tests'}>
                    {report.aiGeneration.used ? `AI gen: ${report.aiGeneration.provider || 'unknown'} (${report.aiGeneration.model || ''})` : 'AI gen: not used'}
                  </span>
                )}
                <a href={`/api/run/report/pdf?runId=${runId}`} className="btn btn-secondary">⬇️ Download PDF</a>
                <a href={`/api/run/report/csv?runId=${runId}`} className="btn btn-secondary">⬇️ Download CSV</a>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <Markdown md={report.markdown || 'No summary available.'} />
              </div>
              {!report.ai?.used && report.ai?.debug && (
                <div className="text-xs text-gray-500 mt-2 p-3 bg-gray-50 rounded border">
                  <strong>Debug:</strong> {report.ai.debug.groqStatus ? `Groq status ${report.ai.debug.groqStatus}` : 'Groq not tried'} {report.ai.debug.groqError ? `- ${report.ai.debug.groqError}` : ''}
                </div>
              )}
              {report.screenshots?.length ? (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">Evidence</h3>
                  <div className="screenshot-grid">
                    {report.screenshots.slice(0, 50).map((s: string, i: number) => (
                      <a key={i} href={s} target="_blank" rel="noreferrer" className="screenshot-card group">
                        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                          <img 
                            src={s} 
                            alt={`Screenshot ${i+1}`} 
                            className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="p-2 bg-gray-50 text-xs text-gray-600 text-center">
                            Step {i + 1}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
