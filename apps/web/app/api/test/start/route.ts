import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { startRun } from '../../internal/orchestrator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Accept both the new UI shape and the legacy /api/run shape
    const url: string | undefined = body.url;
    const depth: number = typeof body.depth === 'number' ? body.depth : 1;
    const mode: string | undefined = body.mode; // 'dynamic' | 'static' | 'hybrid'
    const aiEnabled: boolean = typeof body.aiEnabled === 'boolean' ? body.aiEnabled : (typeof body.aiGenerated === 'boolean' ? body.aiGenerated : true);
    const screenshotEnabled: boolean = typeof body.screenshotEnabled === 'boolean' ? body.screenshotEnabled : (typeof body.screenshotCapture === 'boolean' ? body.screenshotCapture : true);

    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Normalize to orchestrator config
    const dynamic: boolean = mode ? mode !== 'static' : (typeof body.dynamic === 'boolean' ? body.dynamic : true);
    const credentials = body.credentials && typeof body.credentials === 'object'
      ? body.credentials
      : undefined;
    const assets = Array.isArray(body.assets) ? body.assets : undefined;

    // Validate credentials shape if provided
    if (credentials) {
      if (!credentials.username || !credentials.password) {
        return NextResponse.json({ error: 'Both username and password are required when providing credentials' }, { status: 400 });
      }
    }

    const runId = nanoid();
    const timestamp = new Date().toISOString();

    // Fire-and-forget start
    startRun(runId, {
      url,
      depth,
      dynamic,
      aiGenerated: aiEnabled,
      screenshotCapture: screenshotEnabled,
      credentials,
      assets
    }, () => { /* noop - events are stored in-memory */ });

    return NextResponse.json({
      runId,
      status: 'started',
      timestamp,
      config: {
        url,
        depth,
        dynamic,
        aiGenerated: aiEnabled,
        screenshotCapture: screenshotEnabled,
        hasCredentials: !!credentials,
        assetsCount: Array.isArray(assets) ? assets.length : 0
      }
    }, { status: 201 });
  } catch (err) {
    console.error('Failed to start test (wrapper):', err);
    return NextResponse.json({ error: 'Failed to start test run' }, { status: 500 });
  }
}
