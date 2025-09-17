import './globals.css';
import React from 'react';
import { Bot, CircleDot } from 'lucide-react';

export const metadata = { title: 'TestFlowAI - Intelligent Web Testing Platform' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="page-header">
          <div className="container">
            <div className="header-content">
              <div className="logo">
                <Bot size={24} className="text-blue-400" />
                <span>TestFlowAI</span>
                <span className="text-sm text-gray">Intelligent Web Testing Platform</span>
              </div>
              <nav className="nav-tabs">
                <a className="nav-tab active" href="/">Dashboard</a>
                <a className="nav-tab" href="/history">History</a>
                <div className="status-badge status-ready flex items-center gap-1">
                  <CircleDot size={12} /> Ready
                </div>
              </nav>
            </div>
          </div>
        </header>
        <main className="page-content" style={{padding: 0}}>{children}</main>
      </body>
    </html>
  );
}
