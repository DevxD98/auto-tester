"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' }}>
        <h2>Something went wrong</h2>
        <p style={{ color: '#525252' }}>{error?.message || 'Unknown error'}</p>
        <button onClick={() => reset()} style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6 }}>Try again</button>
      </body>
    </html>
  );
}
