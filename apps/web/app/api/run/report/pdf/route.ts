import { NextRequest } from 'next/server';
import { runStore } from '../../../internal/orchestrator';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { summarizeRun } from '@autotest/reporting';

export const dynamic = 'force-dynamic';

// Fetch the AI report for PDF inclusion
async function fetchAiReport(runId: string) {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/run/report?runId=${runId}`);
    if (response.ok) {
      const data = await response.json();
      return data.markdown || null;
    }
  } catch {
    // Fallback to deterministic summary if AI report fails
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('runId');
  if (!runId) return new Response('runId required', { status: 400 });
  const record = runStore.get(runId);
  if (!record || record.status !== 'completed' || !record.results) return new Response('Run not completed', { status: 404 });

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  // const fontMono = await pdf.embedFont(StandardFonts.Courier);

  const margin = 50;
  const pageWidth = 612; // US Letter width in points
  const pageHeight = 792;

  function addPage() { return pdf.addPage([pageWidth, pageHeight]); }
  function drawText(page: any, text: string, x: number, y: number, size = 11, weight: 'regular'|'bold' = 'regular', color = rgb(0.12, 0.12, 0.12)) {
    page.drawText(text, { x, y, size, font: weight === 'bold' ? fontBold : font, color });
  }

  let page = addPage();
  let y = pageHeight - margin;
  const lineGap = 18; // Increased from 16 for better spacing

  // Branded header bar
  const headerH = 50; // Increased height
  page.drawRectangle({ x: 0, y: pageHeight - headerH, width: pageWidth, height: headerH, color: rgb(0.28, 0.25, 0.90) });
  drawText(page, 'TestFlowAI — Test Run Report', margin, pageHeight - headerH + 18, 16, 'bold', rgb(1,1,1));
  drawText(page, new Date(record.results.finishedAt).toLocaleString(), pageWidth - margin - 180, pageHeight - headerH + 18, 11, 'regular', rgb(0.92,0.92,0.98));
  y = pageHeight - headerH - 25; // More space after header

  // Meta block with improved spacing and layout
  drawText(page, 'Run Information', margin, y, 14, 'bold', rgb(0.2,0.2,0.5)); y -= lineGap * 1.5;
  
  const metaItems = [
    { label: 'Run ID:', value: runId },
    { label: 'URL Tested:', value: record.config.url },
    { label: 'Execution Started:', value: new Date(record.createdAt).toLocaleString() },
    { label: 'Completed:', value: new Date(record.results.finishedAt).toLocaleString() },
    { label: 'AI Generation:', value: record.aiGeneration?.used ? `${record.aiGeneration.provider || 'Yes'} (${record.aiGeneration.model || 'unknown model'})` : 'Not used' }
  ];
  
  for (const item of metaItems) {
    drawText(page, item.label, margin + 10, y, 11, 'bold');
    const valueText = item.value.length > 75 ? item.value.slice(0, 75) + '...' : item.value;
    drawText(page, valueText, margin + 130, y, 11, 'regular', rgb(0.3,0.3,0.3)); 
    y -= lineGap * 1.1; // Better spacing between items
  }
  y -= lineGap;

  // Test Results Summary section
  drawText(page, 'Test Results Summary', margin, y, 14, 'bold', rgb(0.2,0.2,0.5)); y -= lineGap * 1.3;
  
  // KPI chips with better spacing
  const chipY = y; let chipX = margin + 10;
  const kpis = [
    { label: 'Generated', value: String(record.results.testsGenerated) },
    { label: 'Passed', value: String(record.results.testsPassed) },
    { label: 'Failed', value: String(record.results.testsFailed) }
  ];
  for (const k of kpis) {
    const w = 95; const h = 32; // Slightly larger for better readability
    page.drawRectangle({ x: chipX, y: chipY - h, width: w, height: h, borderColor: rgb(0.82,0.82,0.92), borderWidth: 1.5, color: rgb(0.95,0.95,0.99) });
    drawText(page, k.label, chipX + 12, chipY - 12, 10, 'regular', rgb(0.35,0.35,0.65));
    drawText(page, k.value, chipX + 12, chipY - 24, 14, 'bold', rgb(0.15,0.15,0.5));
    chipX += w + 15; // More space between chips
  }
  y = chipY - 50; // More space after chips

  // Summary
  // AI-powered executive summary with better spacing
  const aiReport = await fetchAiReport(runId);
  if (aiReport) {
    drawText(page, 'Executive Summary (AI Generated)', margin, y, 14, 'bold', rgb(0.2,0.2,0.5)); y -= lineGap * 1.5;
    
    // Parse and render markdown sections
    const sections = aiReport.split('###').filter(Boolean);
    for (const section of sections.slice(0, 3)) { // Reduced to 3 sections for better fit
      const lines = section.trim().split('\n').filter(Boolean);
      if (lines.length === 0) continue;
      
      const title = lines[0].trim();
      const content = lines.slice(1).filter((l: string) => l.trim().length > 0);
      
      // Section title with more space
      if (y < margin + lineGap * 8) { page = addPage(); y = pageHeight - margin; }
      drawText(page, title, margin + 10, y, 12, 'bold', rgb(0.3,0.3,0.6)); y -= lineGap * 1.3;
      
      // Section content with proper indentation and spacing
      for (const line of content.slice(0, 3)) { // Limit lines per section
        let text = line.trim().replace(/^\*\s*/, '• ').replace(/^-\s*/, '• ');
        if (text.length > 85) text = text.slice(0, 85) + '...';
        if (y < margin + lineGap * 2) { page = addPage(); y = pageHeight - margin; }
        const indent = text.startsWith('•') ? 25 : 15;
        drawText(page, text, margin + indent, y, 10, 'regular', rgb(0.4,0.4,0.4)); 
        y -= lineGap * 1.1;
      }
      y -= lineGap * 0.8; // Space between sections
    }
  } else {
    // Fallback to deterministic summary
    drawText(page, 'Executive Summary', margin, y, 14, 'bold', rgb(0.2,0.2,0.5)); y -= lineGap * 1.5;
    try {
      const md = summarizeRun(record.testResults || [], record.tests || []);
      const lines = md.split('\n').filter(Boolean).slice(0, 6);
      for (const ln of lines) {
        const text = ln.replace(/^#+\s*/, '');
        if (y < margin + lineGap * 2) { page = addPage(); y = pageHeight - margin; }
        drawText(page, text.slice(0, 95), margin + 10, y, 11, 'regular'); y -= lineGap * 1.2;
      }
    } catch {
      drawText(page, 'Summary generation unavailable.', margin + 10, y, 11, 'regular'); y -= lineGap;
    }
  }
  y -= lineGap * 1.5;

  // Steps overview (first page)
  if (record.testResults?.length) {
    drawText(page, 'Tests Overview', margin, y, 14, 'bold', rgb(0.2,0.2,0.5)); y -= lineGap * 1.4;
    for (const r of record.testResults.slice(0, 5)) { // Reduced to 5 for better spacing
      const name = record.tests?.find(t => t.id === r.testId)?.name || r.testId;
      const text = `${name} — ${r.status.toUpperCase()} (${r.stepResults.length} steps)`;
      if (y < margin + lineGap * 2) { page = addPage(); y = pageHeight - margin; }
      drawText(page, text, margin + 10, y, 11, r.status === 'passed' ? 'regular' : 'bold', r.status === 'passed' ? rgb(0.2,0.6,0.2) : rgb(0.7,0.2,0.2)); 
      y -= lineGap * 1.2; // Better spacing between test items
    }
    y -= lineGap;
  }

  // Helper: resolve artifact URL or relative path to absolute file path
  const artifactsRoot = path.join(process.cwd(), 'apps/web/artifacts');
  function toAbs(fileOrUrl: string): { abs: string | null; type: 'png' | 'jpg' | 'other' } {
    let rel = fileOrUrl;
    if (fileOrUrl.startsWith('/api/artifacts/')) {
      const tail = decodeURIComponent(fileOrUrl.replace('/api/artifacts/', ''));
      rel = tail.split('/').join(path.sep);
    }
    const abs = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
    const withinArtifacts = abs.startsWith(artifactsRoot) || fs.existsSync(abs);
    const ext = path.extname(abs).toLowerCase();
    const type = ext === '.png' ? 'png' : (ext === '.jpg' || ext === '.jpeg' ? 'jpg' : 'other');
    return { abs: withinArtifacts ? abs : null, type } as const;
  }

  // Test results section with enhanced formatting
  if (record.testResults && record.testResults.length > 0) {
    page = addPage(); y = pageHeight - margin;
    
    // Add page header for test results with proper spacing
    const detailsHeaderH = 50;
    page.drawRectangle({ x: 0, y: pageHeight - detailsHeaderH, width: pageWidth, height: detailsHeaderH, color: rgb(0.15, 0.15, 0.15) });
    drawText(page, 'Detailed Test Results', margin, pageHeight - detailsHeaderH + 18, 16, 'bold', rgb(1,1,1));
    y = pageHeight - detailsHeaderH - 30; // More space after header
  }

  // Embed screenshots grouped by test with captions
  const results = record.testResults || [];
  for (const r of results) {
    if (y < 150) { // Better threshold for new page
      page = addPage(); y = pageHeight - margin;
    }
    const test = record.tests?.find(t => t.id === r.testId) as any;
    const name = test?.name || r.testId;
    const priority = test?.priority || 'medium';
    const tags = test?.tags?.join(', ') || '';
    
    // Test header with better spacing and styling
    const statusColor = r.status === 'passed' ? rgb(0.1,0.6,0.1) : rgb(0.8,0.2,0.2);
    drawText(page, name, margin, y, 16, 'bold', rgb(0.1,0.1,0.1)); y -= lineGap * 1.3;
    
    // Status line with better layout
    drawText(page, `Status: ${r.status.toUpperCase()}`, margin + 10, y, 11, 'bold', statusColor);
    drawText(page, `Priority: ${priority.toUpperCase()}`, margin + 140, y, 11, 'regular', rgb(0.3,0.3,0.3));
    drawText(page, `Steps: ${r.stepResults.length}`, margin + 260, y, 11, 'regular', rgb(0.3,0.3,0.3)); y -= lineGap * 1.1;
    
    if (tags) {
      drawText(page, `Tags: ${tags}`, margin + 10, y, 10, 'regular', rgb(0.5,0.5,0.7)); y -= lineGap * 1.1;
    }
    y -= lineGap * 0.8; // More space before screenshots    // Screenshots in single column with better spacing
    for (const s of r.stepResults) {
      const stepIdx = s.stepIndex + 1;
      const desc = record.tests?.find(t => t.id === r.testId)?.steps?.[s.stepIndex]?.description || '';
      const { abs, type } = toAbs(String(s.evidence || ''));
      
      // Check if we need a new page (more generous spacing)
      if (y < 250) { page = addPage(); y = pageHeight - margin; }
      
      const cap = `Step ${stepIdx}: ${desc || 'screenshot'} — ${s.status.toUpperCase()}`;
      drawText(page, cap.slice(0, 75), margin + 15, y, 11, 'bold', rgb(0.3,0.3,0.5)); y -= lineGap * 1.2;
      
      if (abs && fs.existsSync(abs) && (type === 'png' || type === 'jpg')) {
        try {
          const bytes = fs.readFileSync(abs);
          const img = type === 'png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
          const maxW = pageWidth - margin * 2 - 30; // Single column, full width
          const maxH = 160; // Slightly smaller for better fit
          let w = img.width; let h = img.height;
          const scale = Math.min(maxW / w, maxH / h, 1);
          w = w * scale; h = h * scale;
          
          // Center the image
          const imgX = margin + 15 + (maxW - w) / 2;
          page.drawImage(img, { x: imgX, y: y - h, width: w, height: h });
          y -= h + lineGap * 1.5; // More space after each screenshot
        } catch {
          drawText(page, '(Screenshot unavailable)', margin + 15, y, 10, 'regular', rgb(0.6,0.4,0.4)); 
          y -= lineGap * 1.2;
        }
      } else if (s.evidence) {
        const line = String(s.evidence);
        drawText(page, line.length > 80 ? line.slice(0, 80) + '…' : line, margin + 15, y, 10, 'regular', rgb(0.5,0.5,0.5)); 
        y -= lineGap * 1.2;
      }
    }
    y -= lineGap * 2; // Extra space between tests
  }

  // Add footer to all pages
  const pageCount = pdf.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const p = pdf.getPage(i);
    const footerY = 25;
    drawText(p, `TestFlowAI Report • Generated ${new Date().toLocaleDateString()}`, margin, footerY, 9, 'regular', rgb(0.5,0.5,0.5));
    drawText(p, `Page ${i + 1} of ${pageCount}`, pageWidth - margin - 80, footerY, 9, 'regular', rgb(0.5,0.5,0.5));
  }

  const bytes = await pdf.save();
  const filename = `TestFlowAI_Report_${runId}_${new Date().toISOString().split('T')[0]}.pdf`;
  return new Response(Buffer.from(bytes), { 
    headers: { 
      'Content-Type': 'application/pdf', 
      'Content-Disposition': `attachment; filename="${filename}"` 
    } 
  });
}
