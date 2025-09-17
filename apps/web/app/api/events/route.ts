import { NextRequest } from 'next/server';
import { runStore } from '../internal/orchestrator';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('runId');
  if (!runId) return new Response('runId required', { status: 400 });

  return new Response(new ReadableStream({
    start(controller) {
      let closed = false;
      let record = runStore.get(runId);
      const send = (data: any) => {
        if (closed) return;
        try { controller.enqueue(`data: ${JSON.stringify(data)}\n\n`); } catch { closed = true; }
      };

      // Grace period: allow a short time for the run to register in-memory after POST triggers startRun
      // This avoids a race on first connection after server (re)start.
      if (!record) {
        let waitedMs = 0;
        const waitInterval = 150;
        const maxWait = 4000;
        const waitTimer = setInterval(() => {
          if (closed) { clearInterval(waitTimer); return; }
          record = runStore.get(runId);
          waitedMs += waitInterval;
          if (record) {
            clearInterval(waitTimer);
            // Proceed below to stream events
            replayAndStream(record!);
          } else if (waitedMs >= maxWait) {
            clearInterval(waitTimer);
            send({ type: 'error', runId, message: 'Run not found', timestamp: new Date().toISOString() });
            closed = true; controller.close();
          }
        }, waitInterval);

        req.signal.addEventListener('abort', () => {
          clearInterval(waitTimer);
          closed = true; try { controller.close(); } catch { /* ignore */ }
        });
        return; // Defer; we'll continue inside replayAndStream or close on timeout
      }

      // If we have a record immediately, stream now
      replayAndStream(record);

  function replayAndStream(initial: any) {
        // Replay existing events
        for (const e of initial.events) send(mapOrchestratorEvent(e));
        if (initial.status === 'completed' || initial.status === 'error') {
          closed = true; controller.close(); return;
        }

        let lastLen = initial.events.length;
        const poll = setInterval(() => {
          if (closed) return;
          const r = runStore.get(runId!);
          if (!r) return;
          if (r.events.length > lastLen) {
            const newEvents = r.events.slice(lastLen);
            newEvents.forEach(ev => send(mapOrchestratorEvent(ev)));
            lastLen = r.events.length;
          }
          if (r.status === 'completed' || r.status === 'error') {
            send(mapTerminalCompletion(r));
            clearInterval(poll);
            clearInterval(heartbeat);
            closed = true; controller.close();
          }
        }, 800);

        const heartbeat = setInterval(() => send({ type: 'heartbeat', runId, timestamp: new Date().toISOString() }), 25000);

        req.signal.addEventListener('abort', () => {
          closed = true;
          clearInterval(poll);
          clearInterval(heartbeat);
          try { controller.close(); } catch { /* already closed */ }
        });
      }
    }
  }), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
}

function mapOrchestratorEvent(e: any) {
  const ts = new Date(e.timestamp).toISOString();
  switch (e.type) {
    case 'phase':
      return { type: 'phase', runId: e.runId, phase: e.phase, message: e.message, timestamp: ts };
    case 'test-progress':
      return { type: 'test', runId: e.runId, index: e.current, total: e.total, name: e.testName, timestamp: ts };
    case 'test-step':
      return { type: 'step', runId: e.runId, testId: e.testId, stepIndex: e.stepIndex, status: e.status, screenshot: e.screenshot, timestamp: ts };
    case 'error':
      return { type: 'error', runId: e.runId, message: e.error, timestamp: ts };
    case 'completed':
      return { type: 'completed', runId: e.runId, results: { testsGenerated: e.summary.testsGenerated, testsPassed: e.summary.testsPassed, testsFailed: e.summary.testsFailed, coverage: e.summary.coverage, screenshots: e.summary.screenshots, finishedAt: e.summary.finishedAt }, timestamp: ts };
    default:
      return { type: 'unknown', runId: e.runId, timestamp: ts };
  }
}

function mapTerminalCompletion(r: any) {
  if (r.results) return { type: 'completed', runId: r.runId, results: r.results, timestamp: new Date().toISOString() };
  return { type: r.status === 'error' ? 'error' : 'completed', runId: r.runId, timestamp: new Date().toISOString() };
}