import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';

interface UploadedAsset {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: 'image' | 'pdf' | 'video' | 'other';
  // Filesystem relative path from repo root, usable by Playwright setInputFiles
  path: string;
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const files = form.getAll('files');
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    const uploadsRoot = path.join(process.cwd(), 'apps/web/artifacts/uploads');
    fs.mkdirSync(uploadsRoot, { recursive: true });
    const batchId = nanoid();
    const batchDir = path.join(uploadsRoot, batchId);
    fs.mkdirSync(batchDir, { recursive: true });

    const saved: UploadedAsset[] = [];

    for (const f of files) {
      if (!(f instanceof File)) continue;
      const arrayBuf = await f.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      const safeName = sanitizeFilename(f.name || 'file');
      const filePath = path.join(batchDir, safeName);
      fs.writeFileSync(filePath, buf);

      const mime = f.type || 'application/octet-stream';
      const kind: UploadedAsset['kind'] = mime.startsWith('image/')
        ? 'image'
        : mime === 'application/pdf'
        ? 'pdf'
        : mime.startsWith('video/')
        ? 'video'
        : 'other';

      const relPath = path.relative(process.cwd(), filePath);
      saved.push({
        id: nanoid(),
        name: safeName,
        mime,
        size: buf.length,
        kind,
        path: relPath
      });
    }

    return NextResponse.json({ batchId, assets: saved }, { status: 201 });
  } catch (err: any) {
    console.error('Upload error', err);
    return NextResponse.json({ error: 'Failed to upload assets' }, { status: 500 });
  }
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100);
}
