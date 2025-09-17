"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Lock, 
  Paperclip, 
  Rocket, 
  Shield, 
  CheckSquare, 
  ClipboardList, 
  Mouse, 
  Folder,
  Lightbulb,
  BarChart3
} from 'lucide-react';

interface PlatformStats {
  totalTestRuns: number;
  successRate: number;
  avgDuration: number;
  sitesTestedCount: number;
  recentActivity: {
    testsToday: number;
    issuesDetected: number;
    aiSuggestions: number;
    avgResponseTime: number;
  };
  trends: {
    totalTestsChange: string;
    successRateChange: string;
    durationChange: string;
    sitesChange: string;
  };
}

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [depth, setDepth] = useState(1);
  const [mode, setMode] = useState('dynamic');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [screenshotEnabled, setScreenshotEnabled] = useState(true);
  const [showCredentials, setShowCredentials] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const validateUrl = (url: string) => {
    try {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      new URL(url);
      return url;
    } catch {
      throw new Error('Please enter a valid URL');
    }
  };

  const handleStartTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!url.trim()) {
      setError('Please enter a URL to test');
      return;
    }

    setIsRunning(true);

    try {
      const validatedUrl = validateUrl(url.trim());
      
      const requestBody = {
        url: validatedUrl,
        depth,
        dynamic: mode !== 'static',
        aiGenerated: aiEnabled,
        screenshotCapture: screenshotEnabled,
        ...(showCredentials && username && password ? { credentials: { username, password } } : {})
      };

      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Redirect to live run page
      router.push(`/runs/${data.runId}`);
      
    } catch (err) {
      setError('Failed to start test. Please try again.');
      setIsRunning(false);
    }
  };

  return (
    <div style={{minHeight: '100vh', backgroundColor: '#f8fafc'}}>
      <div style={{maxWidth: '1000px', margin: '0 auto', padding: '40px 24px'}}>
        {/* Header */}
        <div style={{textAlign: 'center', marginBottom: '40px'}}>
          <div style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', backgroundColor: '#6366f1', borderRadius: '12px', marginBottom: '16px'}}>
            <Rocket style={{width: '24px', height: '24px', color: 'white'}} />
          </div>
          <h1 style={{fontSize: '32px', fontWeight: '700', color: '#1e293b', marginBottom: '8px', margin: '0 0 8px 0'}}>
            AI-Powered Web Testing
          </h1>
          <p style={{fontSize: '16px', color: '#64748b', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6'}}>
            Automatically crawl, analyze, and test any website with intelligent test generation and comprehensive reporting
          </p>
        </div>

        {/* Main Form Card */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Shield size={20} />
              Test Configuration
            </h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleStartTest}>
              {/* URL Input */}
              <div className="form-group">
                <label className="form-label">Target Website URL</label>
                <input
                  className="form-input"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter or paste a URL e.g. the-internet.herokuapp.com/login"
                  autoComplete="off"
                  required
                />
                {url && !url.startsWith('http') && (
                  <p style={{fontSize: '12px', color: '#6b7280', marginTop: '4px'}}>
                    Protocol will be added automatically if omitted
                  </p>
                )}
              </div>

              {/* Crawl Depth */}
              <div className="form-group">
                <label className="form-label">
                  <BarChart3 size={16} style={{display: 'inline', marginRight: '8px'}} />
                  Crawl Depth
                </label>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  max="5"
                  value={depth}
                  onChange={(e) => setDepth(parseInt(e.target.value))}
                />
              </div>

              {/* Test Mode */}
              <div className="form-group">
                <label className="form-label">Test Mode</label>
                <select 
                  className="form-select"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                >
                  <option value="dynamic">Dynamic (Recommended)</option>
                  <option value="static">Static Analysis</option>
                  <option value="hybrid">Hybrid Approach</option>
                </select>
              </div>

              {/* Feature Toggles */}
              <div className="form-group">
                <div className="checkbox-group">
                  <div className="checkbox-item">
                    <input
                      type="checkbox"
                      id="ai-enabled"
                      checked={aiEnabled}
                      onChange={(e) => setAiEnabled(e.target.checked)}
                    />
                    <label htmlFor="ai-enabled">
                      <Lightbulb size={16} style={{marginRight: '4px'}} />
                      AI-Generated Tests
                    </label>
                  </div>
                  <div className="checkbox-item">
                    <input
                      type="checkbox"
                      id="screenshot-enabled"
                      checked={screenshotEnabled}
                      onChange={(e) => setScreenshotEnabled(e.target.checked)}
                    />
                    <label htmlFor="screenshot-enabled">
                      <Folder size={16} style={{marginRight: '4px'}} />
                      Screenshot Capture
                    </label>
                  </div>
                </div>
              </div>

              {/* Login Credentials */}
              <div className="form-group">
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px'}}>
                  <label className="form-label" style={{margin: 0}}>
                    <Lock size={16} style={{marginRight: '8px'}} />
                    Login Credentials
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{fontSize: '12px', padding: '4px 12px'}}
                    onClick={() => setShowCredentials(!showCredentials)}
                  >
                    {showCredentials ? 'Hide' : 'Add Credentials'}
                  </button>
                </div>
                <p style={{fontSize: '12px', color: '#6b7280', marginBottom: '12px'}}>
                  Optional authentication details
                </p>
                
                {showCredentials && (
                  <div className="form-row">
                    <div>
                      <input
                        className="form-input"
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </div>
                    <div>
                      <input
                        className="form-input"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* File Upload */}
              <div className="form-group">
                <label className="form-label">
                  <Paperclip size={16} style={{marginRight: '8px'}} />
                  Upload Test Assets (images, PDF, video)
                  <span style={{color: '#6b7280', fontWeight: 'normal', marginLeft: '8px'}}>Optional</span>
                </label>
                <p style={{fontSize: '12px', color: '#6b7280', marginBottom: '8px'}}>
                  These files will be used when a page has a file upload field. We'll attach a suitable file automatically.
                </p>
                <input
                  className="form-input"
                  type="file"
                  multiple
                  accept="image/*,.pdf,video/*"
                  style={{padding: '8px 12px'}}
                />
              </div>

              {/* Error Display */}
              {error && (
                <div style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  marginBottom: '16px'
                }}>
                  {error}
                </div>
              )}

              {/* Info Display */}
              {info && (
                <div style={{
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1d4ed8',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  marginBottom: '16px'
                }}>
                  {info}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isRunning}
                style={{width: '100%', justifyContent: 'center', padding: '16px'}}
              >
                {isRunning ? (
                  <>Starting Test...</>
                ) : (
                  <>
                    <Rocket size={16} />
                    Start Testing
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Quick Demo and Platform Statistics */}
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '32px'}}>
          <div className="card">
            <div className="card-body" style={{textAlign: 'center'}}>
              <Mouse size={32} style={{color: '#6366f1', marginBottom: '16px'}} />
              <h3 style={{fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#1e293b'}}>Quick Demo</h3>
              <p style={{fontSize: '14px', color: '#64748b', marginBottom: '16px'}}>
                Try our interactive demo to see the platform in action
              </p>
              <button className="btn btn-primary" style={{width: '100%'}}>
                Launch Demo
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div style={{display: 'flex', alignItems: 'center', marginBottom: '16px'}}>
                <BarChart3 size={20} style={{color: '#6366f1', marginRight: '8px'}} />
                <h3 style={{fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0}}>Platform Statistics</h3>
              </div>
              
              {stats ? (
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
                  <div style={{textAlign: 'center', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px'}}>
                    <div style={{fontSize: '20px', fontWeight: '700', color: '#1e293b'}}>{stats.totalTestRuns}</div>
                    <div style={{fontSize: '12px', color: '#64748b'}}>Total Tests</div>
                  </div>
                  <div style={{textAlign: 'center', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px'}}>
                    <div style={{fontSize: '20px', fontWeight: '700', color: '#16a34a'}}>{stats.successRate}%</div>
                    <div style={{fontSize: '12px', color: '#64748b'}}>Success Rate</div>
                  </div>
                  <div style={{textAlign: 'center', padding: '12px', backgroundColor: '#faf5ff', borderRadius: '8px'}}>
                    <div style={{fontSize: '20px', fontWeight: '700', color: '#9333ea'}}>{Math.round(stats.avgDuration)}s</div>
                    <div style={{fontSize: '12px', color: '#64748b'}}>Avg Duration</div>
                  </div>
                  <div style={{textAlign: 'center', padding: '12px', backgroundColor: '#fff7ed', borderRadius: '8px'}}>
                    <div style={{fontSize: '20px', fontWeight: '700', color: '#ea580c'}}>{stats.sitesTestedCount}</div>
                    <div style={{fontSize: '12px', color: '#64748b'}}>Sites Tested</div>
                  </div>
                </div>
              ) : (
                <div style={{textAlign: 'center', padding: '20px', color: '#64748b'}}>
                  Loading statistics...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}