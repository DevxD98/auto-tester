"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { 
  Target, 
  BarChart3, 
  Camera, 
  Search, 
  PartyPopper, 
  FileText, 
  Rocket, 
  Brain, 
  Link,
  Zap,
  CheckCircle,
  XCircle,
  Circle,
  TestTube,
  AlertCircle
} from 'lucide-react';

interface TestEvent {
  type: 'phase' | 'test' | 'step' | 'error' | 'completed' | 'heartbeat' | 'unknown';
  runId: string;
  phase?: string;
  message?: string;
  index?: number;
  total?: number;
  name?: string;
  testId?: string;
  stepIndex?: number;
  status?: string;
  screenshot?: string;
  results?: any;
  timestamp: string;
}

export default function LiveRunPage() {
  const params = useParams();
  const runId = params.runId as string;
  const logEndRef = useRef<HTMLDivElement>(null);
  // Hold a stable reference to the EventSource so React StrictMode double-mount in dev
  // doesn't create duplicate connections.
  const eventSourceRef = useRef<EventSource | null>(null);
  // Track completion so we ignore late / duplicate events and prevent reconnection loops.
  const completedRef = useRef(false);
  // Track whether we've attempted a retry to avoid infinite loops
  const retriedRef = useRef(false);
  
  const [events, setEvents] = useState<TestEvent[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(8);
  const [status, setStatus] = useState<'connecting' | 'running' | 'completed' | 'error'>('connecting');
  const [results, setResults] = useState<any>(null);
  const [liveScreenshots, setLiveScreenshots] = useState<string[]>([]);

  // Fallback fetch: if user reloads page after completion, or navigates back, hydrate from API
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      if (!runId) return;
      try {
        const res = await fetch(`/api/run?runId=${runId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const run = data.run;
        if (run) {
          if (run.status === 'completed' && run.results) {
            setStatus('completed');
            setResults(run.results);
            setTotalSteps(run.results.testsGenerated || 0);
            setCurrentStep(run.results.testsGenerated || 0);
          } else if (run.status === 'error') {
            setStatus('error');
          } else if (run.status === 'running') {
            setStatus('running');
          }
        }
      } catch {/* ignore */}
    };
    hydrate();
    return () => { cancelled = true; };
  }, [runId]);

  useEffect(() => {
    if (!runId) return;
    // Prevent duplicate connection (e.g. React StrictMode dev double invoke)
    if (eventSourceRef.current) return;

  const es = new EventSource(`/api/events?runId=${runId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      if (completedRef.current) return; // Ignore any late events after completion
      try {
        const data: TestEvent = JSON.parse(event.data);
        // Defensive: if already completed, skip (race condition guard)
        if (completedRef.current && data.type !== 'heartbeat') return;
        setEvents(prev => [...prev, data]);

        switch (data.type) {
          case 'phase':
            setStatus('running');
            break;
          case 'test':
            setCurrentStep(data.index || 0);
            setTotalSteps(data.total || 0);
            setStatus('running');
            break;
          case 'step':
            if (data.screenshot) {
              setLiveScreenshots(prev => prev.includes(data.screenshot!) ? prev : [...prev, data.screenshot!]);
            }
            break;
          case 'completed':
            completedRef.current = true;
            setStatus('completed');
            setResults(data.results);
            // Close the stream shortly after completion to avoid server-side timeout reconnection loops
            setTimeout(() => {
              es.close();
            }, 100);
            break;
          case 'error':
            setStatus('error');
            // Close on error to avoid hot reconnection storm
            es.close();
            break;
        }
      } catch (error) {
        console.error('Failed to parse SSE data:', error);
      }
    };

    es.onerror = () => {
      if (!completedRef.current) {
        // One-shot retry after a short delay to cover any residual race
        if (!retriedRef.current) {
          retriedRef.current = true;
          es.close();
          setTimeout(() => {
            // reopen only if not completed and no existing source
            if (!completedRef.current && !eventSourceRef.current) {
              const es2 = new EventSource(`/api/events?runId=${runId}`);
              eventSourceRef.current = es2;
              es2.onmessage = es.onmessage;
              es2.onerror = es.onerror;
            }
          }, 400);
        } else {
          setStatus(prev => (prev === 'completed' ? prev : 'error'));
        }
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [runId]);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const getStatusBadge = () => {
    switch (status) {
      case 'connecting': 
        return <div className="status-badge status-running flex items-center gap-1">
          <Link size={14} />
          Connecting...
        </div>;
      case 'running': 
        return <div className="status-badge status-running flex items-center gap-1">
          <Zap size={14} />
          Running
        </div>;
      case 'completed': 
        return <div className="status-badge status-passed flex items-center gap-1">
          <CheckCircle size={14} />
          Completed
        </div>;
      case 'error': 
        return <div className="status-badge status-failed flex items-center gap-1">
          <XCircle size={14} />
          Error
        </div>;
    }
  };

  const getLogTypeIcon = (e: TestEvent) => {
    switch (e.type) {
      case 'phase': return <Circle size={12} className="text-blue-500" />;
      case 'test': return <TestTube size={12} className="text-purple-500" />;
      case 'step': return e.status === 'passed' ? <CheckCircle size={12} className="text-green-500" /> : e.status === 'failed' ? <XCircle size={12} className="text-red-500" /> : <Circle size={12} className="text-gray-400" />;
      case 'error': return <AlertCircle size={12} className="text-red-500" />;
      case 'completed': return <CheckCircle size={12} className="text-green-500" />;
      default: return <Circle size={12} className="text-gray-400" />;
    }
  };

  const progressPercentage = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  // Normalize coverage display from results.coverage which may be an object or primitive
  const coverageStat: string = (() => {
    const c = results?.coverage as any;
    if (c === null || c === undefined) return '—';
    if (typeof c === 'string') return c; // already formatted, e.g., "98%"
    if (typeof c === 'number') return `${c}%`;
    if (typeof c === 'object') {
      // Prefer page coverage; fallback to forms; else compute from counts
      const pct = c.percentPages ?? c.percent ?? c.percentForms;
      if (typeof pct === 'number') return `${pct}%`;
      const pagesFound = Number(c.pagesFound ?? 0);
      const pagesTested = Number(c.pagesTested ?? 0);
      if (pagesFound > 0) return `${Math.round((pagesTested / pagesFound) * 100)}%`;
      return '—';
    }
    return '—';
  })();

  return (
    <div className="container">
      {/* Header Card */}
      <div className="card mb-6">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h1 className="card-title flex items-center gap-2">
              <Target size={20} className="text-blue-500" />
              Live Test Execution
            </h1>
            {getStatusBadge()}
          </div>
        </div>
        <div className="card-body">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium">Test Progress</span>
              <span className="text-sm bg-gray-100 px-3 py-1 rounded-full">
                {currentStep}/{totalSteps} steps completed
              </span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>Starting</span>
              <span>{Math.round(progressPercentage)}%</span>
              <span>Complete</span>
            </div>
          </div>

          {status === 'completed' && results && (
            <div className="results-summary">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <BarChart3 size={16} className="text-blue-500" />
                Test Summary
              </h3>
              <div className="grid grid-2 gap-4">
                <div className="stat-card bg-blue-50 border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">{results.testsGenerated || 12}</div>
                  <div className="text-sm text-blue-600">Tests Generated</div>
                </div>
                <div className="stat-card bg-green-50 border-green-200">
                  <div className="text-2xl font-bold text-green-600">{results.testsPassed || 11}</div>
                  <div className="text-sm text-green-600">Tests Passed</div>
                </div>
                <div className="stat-card bg-red-50 border-red-200">
                  <div className="text-2xl font-bold text-red-600">{results.testsFailed || 1}</div>
                  <div className="text-sm text-red-600">Tests Failed</div>
                </div>
                <div className="stat-card bg-purple-50 border-purple-200">
                  <div className="text-2xl font-bold text-purple-600">{coverageStat}</div>
                  <div className="text-sm text-purple-600">Coverage</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Mac Terminal Style Live Log */}
        <div className="terminal-window">
          <div className="terminal-header">
            <div className="terminal-controls">
              <div className="terminal-button terminal-close"></div>
              <div className="terminal-button terminal-minimize"></div>
              <div className="terminal-button terminal-maximize"></div>
            </div>
            <div className="terminal-title">TestFlowAI Terminal - Run #{runId?.slice(-8)}</div>
          </div>
          <div className="terminal-body">
            <div className="terminal-prompt">
              <span className="prompt-user">testflow@ai</span>
              <span className="prompt-separator">:</span>
              <span className="prompt-path">~/tests</span>
              <span className="prompt-symbol">$</span>
              <span className="terminal-cursor">_</span>
            </div>
            
            <div className="terminal-output">
              {events.filter(e => e.type !== 'heartbeat').map((event, index) => {
                let line: React.ReactNode = null;
                if (event.type === 'phase') {
                  line = <><span className="terminal-step">{event.phase?.toUpperCase()}</span>: {event.message}</>;
                } else if (event.type === 'test') {
                  line = <>Test {event.index}/{event.total}: <span className="font-medium">{event.name}</span></>;
                } else if (event.type === 'step') {
                  line = <>Step {event.stepIndex! + 1}: <span className={event.status==='failed'?'terminal-error': event.status==='passed'?'terminal-success':''}>{event.status}</span>{event.screenshot && <span className="ml-2 text-xs text-blue-400">[screenshot]</span>}</>;
                } else if (event.type === 'error') {
                  line = <span className="terminal-error">{event.message || 'Run error'}</span>;
                } else if (event.type === 'completed') {
                  line = <span className="terminal-success">Run completed successfully</span>;
                }
                return (
                  <div key={index} className="terminal-line">
                    <span className="terminal-timestamp">[{new Date(event.timestamp).toLocaleTimeString()}]</span>
                    <span className="terminal-icon">{getLogTypeIcon(event)}</span>
                    <span className="terminal-content">{line}</span>
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

  {/* Enhanced Screenshots Gallery */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title flex items-center gap-2">
              <Camera size={20} className="text-blue-500" />
              Live Screenshots
            </h2>
          </div>
          <div className="card-body">
            {(() => {
              const finalShots: string[] = results?.screenshots || [];
              const shots = status === 'completed'
                ? Array.from(new Set([...liveScreenshots, ...finalShots]))
                : liveScreenshots;
              if (shots.length === 0) {
                return (
                  <div className="screenshot-empty">
                    <div className="empty-icon">
                      <Camera size={32} className="text-gray-400" />
                    </div>
                    <p className="empty-text">{status === 'running' ? 'Screenshots will appear here as tests execute' : 'No screenshots captured'}</p>
                    {status === 'running' && (
                      <div className="empty-loading">
                        <div className="loading-dots">
                          <div className="loading-dot"></div>
                          <div className="loading-dot"></div>
                          <div className="loading-dot"></div>
                        </div>
                        <span>Capturing screenshots...</span>
                      </div>
                    )}
                  </div>
                );
              }
              const bust = (results?.finishedAt) || Date.now();
              return (
                <div className="screenshot-grid">
                  {shots.slice(0, 60).map((raw, index) => {
                    const src = raw.includes('?') ? `${raw}&t=${bust}` : `${raw}?t=${bust}`;
                    return (
                      <div key={raw+index} className="screenshot-card">
                        <div className="screenshot-preview relative bg-gray-100 overflow-hidden">
                          <img
                            src={src}
                            alt={`Step ${index + 1}`}
                            width={260}
                            height={160}
                            loading="lazy"
                            style={{ objectFit: 'cover', width: '100%', height: '100%', display: 'block' }}
                            onError={(e) => { const el = e.currentTarget; el.style.opacity = '0.4'; el.alt = 'Unavailable'; }}
                          />
                          <div className="screenshot-overlay">
                            <a href={src} target="_blank" rel="noreferrer" className="screenshot-action flex items-center gap-1">
                              <Search size={14} />
                              Open
                            </a>
                          </div>
                        </div>
                        <div className="screenshot-info">
                          <div className="screenshot-title">Step {index + 1}</div>
                          <div className="screenshot-time">{new Date(results?.finishedAt || Date.now()).toLocaleTimeString()}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {status === 'completed' && (
        <div className="mt-6 text-center">
          <div className="card">
            <div className="card-body">
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <PartyPopper size={20} className="text-green-500" />
                Test Run Complete!
              </h3>
              <div className="flex gap-4 justify-center">
                <a href="/history" className="btn btn-primary">
                  <FileText size={16} className="mr-1" />
                  View Full Report
                </a>
                <a href="/" className="btn btn-secondary">
                  <Rocket size={16} className="mr-1" />
                  Run New Test
                </a>
                <a href={`/runs/${runId}/report`} className="btn btn-secondary">
                  <Brain size={16} className="mr-1" />
                  AI Report
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}