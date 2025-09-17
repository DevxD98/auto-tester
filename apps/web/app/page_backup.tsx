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
  const [assets, setAssets] = useState<{ id: string; name: string; mime: string; size: number; kind: string; path: string; }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Fetch platform statistics on component mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };
    
    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const normalizeUrl = (raw: string): string => {
    let value = raw.trim();
    if (!value) return '';
    // Auto-prepend protocol if missing so user can type e.g. example.com
    if (!/^https?:\/\//i.test(value)) {
      value = 'https://' + value;
    }
    return value;
  };

  const handleStartTest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!url) {
      setError('Please enter a URL to test.');
      return;
    }

    const normalized = normalizeUrl(url);
    let validated: string;
    try {
      // Use WHATWG URL for robust validation
      const u = new URL(normalized);
      validated = u.toString();
    } catch {
      setError('That does not look like a valid URL. Try including a domain like example.com');
      return;
    }

    setIsRunning(true);
    if (validated !== url) {
      setInfo(`Normalized URL to ${validated}`);
      setUrl(validated); // reflect normalization in the field
    }
    
    try {
      const payload: any = {
        url: validated, 
        depth, 
        dynamic: mode === 'dynamic', 
        aiGenerated: aiEnabled,
        screenshotCapture: screenshotEnabled
      };

      // Add credentials if provided
      if (username && password) {
        payload.credentials = {
          username: username.trim(),
          password: password
        };
      }

      // Attach uploaded assets if any
      if (assets.length) {
        payload.assets = assets;
      }

      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to start test run');
      }

      const data = await response.json();
      
      // Clear password for security after successful submission
      setPassword('');
      // Keep uploaded assets for reuse; optionally clear: setAssets([])
      
      // Redirect to live run page
      router.push(`/runs/${data.runId}`);
      
    } catch (err) {
      setError('Failed to start test. Please try again.');
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-6 shadow-lg">
            <Rocket className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-800 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-4">
            AI-Powered Web Testing
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Automatically crawl, analyze, and test any website with intelligent test generation and comprehensive reporting
          </p>
        </div>

        {/* Main Form Card */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <Shield className="w-7 h-7" />
                Test Configuration
              </h2>
              <p className="text-blue-100 mt-2">Configure your automated testing parameters</p>
            </div>
            <div className="p-8">
              <form onSubmit={handleStartTest} className="space-y-8">
                {/* URL Input */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                    Target Website URL
                  </label>
                  <div className="relative">
                    <input
                      className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-200 text-gray-800 placeholder-gray-400 bg-white/80 backdrop-blur-sm"
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="Enter or paste a URL e.g. the-internet.herokuapp.com/login"
                      autoComplete="off"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
                        <Lightbulb className="w-4 h-4 text-blue-600" />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <CheckSquare className="w-3 h-3" />
                    Protocol will be added automatically if omitted
                  </p>
                </div>

                {/* Configuration Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-blue-500 rounded-full"></div>
                      Crawl Depth
                    </label>
                    <div className="relative">
                      <input 
                        className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-500/20 transition-all duration-200 text-gray-800 bg-white/80 backdrop-blur-sm"
                        type="number" 
                        value={depth} 
                        onChange={(e) => setDepth(Number(e.target.value))}
                        min={1} 
                        max={5} 
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                        <BarChart3 className="w-5 h-5 text-green-600" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"></div>
                      Test Mode
                    </label>
                    <div className="relative">
                      <select 
                        className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all duration-200 text-gray-800 bg-white/80 backdrop-blur-sm appearance-none cursor-pointer"
                        value={mode}
                        onChange={(e) => setMode(e.target.value)}
                      >
                        <option value="dynamic">Dynamic (Recommended)</option>
                        <option value="static">Static</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                        <Mouse className="w-5 h-5 text-purple-600" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Feature Toggles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      id="ai-tests" 
                      checked={aiEnabled}
                      onChange={(e) => setAiEnabled(e.target.checked)}
                      className="sr-only"
                    />
                    <label 
                      htmlFor="ai-tests" 
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                        aiEnabled 
                          ? 'border-blue-400 bg-gradient-to-r from-blue-50 to-purple-50 shadow-lg' 
                          : 'border-gray-200 bg-white/50 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200 ${
                        aiEnabled ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gray-200'
                      }`}>
                        {aiEnabled && <CheckSquare className="w-4 h-4 text-white" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Lightbulb className={`w-5 h-5 ${aiEnabled ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className={`font-medium ${aiEnabled ? 'text-gray-800' : 'text-gray-600'}`}>
                          AI-Generated Tests
                        </span>
                      </div>
                    </label>
                  </div>
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      id="screenshots" 
                      checked={screenshotEnabled}
                      onChange={(e) => setScreenshotEnabled(e.target.checked)}
                      className="sr-only"
                    />
                    <label 
                      htmlFor="screenshots" 
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                        screenshotEnabled 
                          ? 'border-green-400 bg-gradient-to-r from-green-50 to-blue-50 shadow-lg' 
                          : 'border-gray-200 bg-white/50 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200 ${
                        screenshotEnabled ? 'bg-gradient-to-r from-green-500 to-blue-500' : 'bg-gray-200'
                      }`}>
                        {screenshotEnabled && <CheckSquare className="w-4 h-4 text-white" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Folder className={`w-5 h-5 ${screenshotEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                        <span className={`font-medium ${screenshotEnabled ? 'text-gray-800' : 'text-gray-600'}`}>
                          Screenshot Capture
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Credentials Section */}
                <div className="border-t-2 border-gray-100 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl flex items-center justify-center">
                        <Lock className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Login Credentials</h3>
                        <p className="text-sm text-gray-600">Optional authentication details</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCredentials(!showCredentials)}
                      className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                        showCredentials 
                          ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg hover:shadow-xl' 
                          : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg hover:shadow-xl'
                      }`}
                    >
                      {showCredentials ? 'Hide Credentials' : 'Add Credentials'}
                    </button>
                  </div>
              
              {showCredentials && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm text-gray-600 mb-3">
                    Add credentials to test successful login flows. These are sent securely and never stored.
                  </p>
                  
                  <div className="form-row">
                    <div className="form-group mb-0">
                      <label className="form-label text-sm">Username / Email</label>
                      <input
                        className="form-input"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="user@example.com"
                        autoComplete="off"
                      />
                    </div>
                    <div className="form-group mb-0">
                      <label className="form-label text-sm">Password</label>
                      <input
                        className="form-input"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded border border-blue-200">
                    <span className="text-blue-600">ℹ️</span> These credentials are only used for this test run and are transmitted securely. They are never logged or stored permanently.
                  </div>
                </div>
              )}
            </div>

            {/* Upload Assets Section */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="form-label mb-0 flex items-center gap-2">
                  <Paperclip size={16} className="text-gray-500" />
                  Upload Test Assets (images, PDF, video)
                </label>
                <span className="text-xs text-gray-500">Optional</span>
              </div>
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                <p className="text-sm text-gray-600">These files will be used when a page has a file upload field. We’ll attach a suitable file automatically.</p>
                <div>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf,video/*"
                    onChange={async (e) => {
                      // Capture the input element reference up-front to avoid React event reuse issues
                      const inputEl = e.target as HTMLInputElement;
                      setUploadError('');
                      const files = inputEl?.files;
                      if (!files || !files.length) return;
                      const form = new FormData();
                      Array.from(files).forEach(f => form.append('files', f));
                      setUploading(true);
                      try {
                        const res = await fetch('/api/assets', { method: 'POST', body: form });
                        if (!res.ok) throw new Error('Upload failed');
                        const data = await res.json();
                        setAssets(prev => [...prev, ...data.assets]);
                      } catch (err) {
                        setUploadError('Failed to upload files.');
                      } finally {
                        setUploading(false);
                        // reset input value so the same files can be reselected
                        if (inputEl) inputEl.value = '';
                      }
                    }}
                  />
                </div>
                {uploadError && (
                  <div className="status-badge status-failed">{uploadError}</div>
                )}
                {uploading && (
                  <div className="status-badge status-running">Uploading…</div>
                )}
                {assets.length > 0 && (
                  <div className="text-sm">
                    <div className="font-medium mb-2">Selected assets</div>
                    <ul className="list-disc pl-5 space-y-1">
                      {assets.map((a, idx) => (
                        <li key={a.id + idx} className="flex items-center justify-between">
                          <span className="truncate mr-2">{a.name} <span className="text-gray-500">({a.kind}, {(a.size/1024).toFixed(1)} KB)</span></span>
                          <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => setAssets(prev => prev.filter((x, i) => i !== idx))}>remove</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="status-badge status-failed">
                {error}
              </div>
            )}
            {!error && info && (
              <div className="status-badge status-running">
                {info}
              </div>
            )}

                {/* Submit Button */}
                <button 
                  type="submit" 
                  disabled={isRunning || !url}
                  className={`w-full py-4 px-8 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                    isRunning || !url
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-xl hover:shadow-2xl'
                  }`}
                >
                  {isRunning ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Launching Test Suite...</span>
                      <Rocket className="w-5 h-5 text-white animate-bounce" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <Rocket className="w-6 h-6" />
                      <span>Start Testing</span>
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    </div>
                  )}
                </button>
          </form>
        </div>
      </div>

      <div className="grid grid-2 gap-6">
        {/* Quick Demo */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2">
              <Rocket size={20} className="text-blue-500" />
              Quick Demo
            </h3>
          </div>
          <div className="card-body">
            <p className="text-gray mb-4">Try these popular testing scenarios to see our AI in action:</p>
            
            <div className="space-y-3">
              {[
                { 
                  icon: <Shield size={18} className="text-green-500" />, 
                  name: 'Login Authentication', 
                  url: 'https://the-internet.herokuapp.com/login',
                  description: 'Test form validation, credential handling'
                },
                { 
                  icon: <CheckSquare size={18} className="text-blue-500" />, 
                  name: 'Interactive Checkboxes', 
                  url: 'https://the-internet.herokuapp.com/checkboxes',
                  description: 'UI element state testing'
                },
                { 
                  icon: <ClipboardList size={18} className="text-purple-500" />, 
                  name: 'Dynamic Dropdown', 
                  url: 'https://the-internet.herokuapp.com/dropdown',
                  description: 'Selection validation & behavior'
                },
                { 
                  icon: <Mouse size={18} className="text-orange-500" />, 
                  name: 'Drag & Drop', 
                  url: 'https://the-internet.herokuapp.com/drag_and_drop',
                  description: 'Complex user interactions'
                },
                { 
                  icon: <Folder size={18} className="text-indigo-500" />, 
                  name: 'File Upload', 
                  url: 'https://the-internet.herokuapp.com/upload',
                  description: 'File handling & upload flows'
                }
              ].map(demo => (
                <button
                  key={demo.name}
                  onClick={() => setUrl(demo.url)}
                  className="demo-btn w-full text-left p-3 rounded-lg border border-gray-200 hover:border-primary hover:bg-primary-light transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-gray-50 group-hover:bg-white transition-colors">
                      {demo.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-dark group-hover:text-primary">{demo.name}</div>
                      <div className="text-sm text-gray mb-1">{demo.description}</div>
                      <div className="text-xs text-gray-400 truncate">{demo.url}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={18} className="text-blue-600" />
                <span className="font-medium text-blue-800">What we test automatically:</span>
              </div>
              <div className="grid grid-2 gap-2 text-sm text-blue-700">
                <div>• Form validation</div>
                <div>• Error handling</div>
                <div>• Navigation flows</div>
                <div>• Accessibility</div>
                <div>• Performance</div>
                <div>• Cross-browser compatibility</div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Platform Statistics */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2">
              <BarChart3 size={20} className="text-blue-500" />
              Platform Statistics
            </h3>
          </div>
          <div className="card-body">
            <div className="grid grid-2 gap-4 mb-6">
              <div className="stat-item text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">
                  {stats?.totalTestRuns.toLocaleString() || '0'}
                </div>
                <div className="text-sm text-gray-600">Total Tests Run</div>
                <div className="text-xs text-blue-500 mt-1">{stats?.trends.totalTestsChange || 'Loading...'}</div>
              </div>
              <div className="stat-item text-center p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                <div className="text-3xl font-bold text-green-600">
                  {stats?.successRate ? `${stats.successRate}%` : '0%'}
                </div>
                <div className="text-sm text-gray-600">Success Rate</div>
                <div className="text-xs text-green-500 mt-1">{stats?.trends.successRateChange || 'Loading...'}</div>
              </div>
            </div>
            
            <div className="grid grid-2 gap-4 mb-6">
              <div className="stat-item text-center p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                <div className="text-3xl font-bold text-purple-600">
                  {stats?.avgDuration ? `${stats.avgDuration}s` : '0s'}
                </div>
                <div className="text-sm text-gray-600">Avg Duration</div>
                <div className="text-xs text-purple-500 mt-1">{stats?.trends.durationChange || 'Loading...'}</div>
              </div>
              <div className="stat-item text-center p-3 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
                <div className="text-3xl font-bold text-orange-600">
                  {stats?.sitesTestedCount || '0'}
                </div>
                <div className="text-sm text-gray-600">Sites Tested</div>
                <div className="text-xs text-orange-500 mt-1">{stats?.trends.sitesChange || 'Loading...'}</div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 text-center">Recent Activity</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Tests executed today</span>
                  <span className="font-medium">{stats?.recentActivity.testsToday || '0'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Issues detected</span>
                  <span className="font-medium text-red-500">{stats?.recentActivity.issuesDetected || '0'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">AI suggestions generated</span>
                  <span className="font-medium text-blue-500">{stats?.recentActivity.aiSuggestions || '0'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Avg response time</span>
                  <span className="font-medium text-green-500">
                    {stats?.recentActivity.avgResponseTime ? `${stats.recentActivity.avgResponseTime}s` : '0s'}
                  </span>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}