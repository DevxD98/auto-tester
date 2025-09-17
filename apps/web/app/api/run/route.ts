import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { startRun, runStore } from '../internal/orchestrator';

// TODO: Import from @autotest packages once wired
// import { crawl } from '@autotest/crawler';
// import { generateTests } from '@autotest/generator';
// import { runTest } from '@autotest/runner';

export async function POST(request: NextRequest) {
  try {
    const { 
      url, 
      depth = 1, 
      dynamic = true, 
      aiGenerated = true,
      screenshotCapture = true,
      credentials,
      assets
    } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate credentials if provided
    if (credentials) {
      if (!credentials.username || !credentials.password) {
        return NextResponse.json({ 
          error: 'Both username and password are required when providing credentials' 
        }, { status: 400 });
      }
    }

  const runId = nanoid();
    const timestamp = new Date().toISOString();

    // Kick off background orchestrator (fire and forget)
    startRun(runId, { 
      url, 
      depth, 
      dynamic, 
      aiGenerated, 
      screenshotCapture,
      credentials,
      assets
    }, () => {/* no immediate push here */});
    
    const response = { 
      runId, 
      status: 'started', 
      timestamp, 
      config: { 
        url, 
        depth, 
        dynamic, 
        aiGenerated, 
        screenshotCapture,
        hasCredentials: !!credentials,
        assetsCount: Array.isArray(assets) ? assets.length : 0 
      } 
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Failed to start test run:', error);
    return NextResponse.json(
      { error: 'Failed to start test run' }, 
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId');
  if (runId) {
    const r = runStore.get(runId);
    if (!r) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    return NextResponse.json({
      run: {
        runId: r.runId,
        url: r.config.url,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        results: r.results,
        screenshots: r.results?.screenshots || [],
        finishedAt: r.results?.finishedAt
      }
    });
  }

  // Helper function to calculate duration
  const calculateDuration = (createdAt: number, finishedAt?: number) => {
    const start = createdAt;
    const end = finishedAt || Date.now();
    const diffMs = end - start;
    const minutes = Math.floor(diffMs / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const runs = Array.from(runStore.values()).map(r => ({
    runId: r.runId,
    url: r.config.url,
    status: r.status,
    timestamp: new Date(r.createdAt).toISOString(),
    testsGenerated: r.results?.testsGenerated || 0,
    testsPassed: r.results?.testsPassed || 0,
    testsFailed: r.results?.testsFailed || 0,
    duration: calculateDuration(r.createdAt, r.results?.finishedAt)
  }));
  
  return NextResponse.json({ runs });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId');
  
  if (!runId) {
    return NextResponse.json({ error: 'runId is required' }, { status: 400 });
  }

  const deleted = runStore.delete(runId);
  
  if (!deleted) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: 'Run deleted successfully' });
}