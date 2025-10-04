"use client";

import { useState, useEffect } from 'react';
import { ClipboardList, Clock, Globe, BarChart3, Camera, RefreshCw, Trash2, Zap, CheckCircle, XCircle, Circle, Inbox, Hash } from 'lucide-react';

interface TestRun {
  runId: string;
  url: string;
  timestamp: string;
  status: 'completed' | 'failed' | 'running' | 'error';
  testsGenerated?: number;
  testsPassed?: number;
  testsFailed?: number;
  duration?: string;
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch real run history
  useEffect(() => {
    const fetchRuns = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/run');
        if (response.ok) {
          const data = await response.json();
          setRuns(data.runs || []);
        } else {
          // Fallback to mock data if API fails
          setRuns(mockRuns);
        }
      } catch (error) {
        console.error('Failed to fetch runs:', error);
        setRuns(mockRuns);
      } finally {
        setLoading(false);
      }
    };

    fetchRuns();
  }, []);

  const mockRuns: TestRun[] = [
    {
      runId: 'run-1',
      url: 'https://the-internet.herokuapp.com/login',
      timestamp: '2025-09-16T10:30:00Z',
      status: 'completed',
      testsGenerated: 8,
      testsPassed: 6,
      testsFailed: 2,
      duration: '2m 15s'
    },
    {
      runId: 'run-2', 
      url: 'https://example.com/checkout',
      timestamp: '2025-09-16T09:15:00Z',
      status: 'completed',
      testsGenerated: 12,
      testsPassed: 12,
      testsFailed: 0,
      duration: '3m 45s'
    },
    {
      runId: 'run-3',
      url: 'https://demo-store.com',
      timestamp: '2025-09-15T16:20:00Z', 
      status: 'failed',
      testsGenerated: 0,
      testsPassed: 0,
      testsFailed: 0,
      duration: '0m 30s'
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': 
        return <div className="status-badge status-passed flex items-center gap-1"><CheckCircle size={14}/> Completed</div>;
      case 'failed': 
      case 'error':
        return <div className="status-badge status-failed flex items-center gap-1"><XCircle size={14}/> Failed</div>;
      case 'running': 
        return <div className="status-badge status-running flex items-center gap-1"><Zap size={14}/> Running</div>;
      default: 
        return <div className="status-badge flex items-center gap-1"><Circle size={12} className="text-gray-400"/> {status}</div>;
    }
  };

  const getSuccessRate = (passed: number = 0, failed: number = 0) => {
    const total = passed + failed;
    if (total === 0) return 0;
    return Math.round((passed / total) * 100);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getUrlDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const filteredAndSortedRuns = runs
    .filter(run => {
      const matchesSearch = run.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           getUrlDomain(run.url).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || run.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      // Sort by newest first
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/run');
      if (response.ok) {
        const data = await response.json();
        setRuns(data.runs || []);
      }
    } catch (error) {
      console.error('Failed to refresh runs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRerun = async (run: TestRun) => {
    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: run.url, 
          depth: 1, 
          dynamic: true, 
          aiGenerated: true 
        })
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = `/runs/${data.runId}`;
      }
    } catch (error) {
      console.error('Failed to start rerun:', error);
    }
  };

  const handleDelete = async (run: TestRun) => {
    if (!confirm(`Are you sure you want to delete the test run for ${getUrlDomain(run.url)}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/run?runId=${run.runId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Remove from local state
        setRuns(prev => prev.filter(r => r.runId !== run.runId));
      } else {
        alert('Failed to delete run. Please try again.');
      }
    } catch (error) {
      console.error('Failed to delete run:', error);
      alert('Failed to delete run. Please try again.');
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h1 className="card-title flex items-center gap-2">
              <ClipboardList size={20} className="text-blue-500" />
              Test Run History
            </h1>
            <button 
              onClick={handleRefresh}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="loading-dots">
                    <div className="loading-dot"></div>
                    <div className="loading-dot"></div>
                    <div className="loading-dot"></div>
                  </div>
                  Loading...
                </div>
              ) : (
                <span className="flex items-center gap-2">
                  <RefreshCw size={16}/>
                  Refresh
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="card-body">
          {/* Compact Controls */}
          {runs.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span className="font-medium">{runs.length} total runs</span>
                <span>•</span>
                <span className="text-green-600">{runs.filter(r => r.status === 'completed').length} completed</span>
                <span>•</span>
                <span className="text-red-600">{runs.filter(r => r.status === 'failed' || r.status === 'error').length} failed</span>
                <span>•</span>
                <span className="text-purple-600">{Math.round(runs.filter(r => r.status === 'completed').length / runs.length * 100) || 0}% success rate</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="form-input text-sm w-48"
                  placeholder="Search URLs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select 
                  className="form-select text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="running">Running</option>
                </select>
              </div>
            </div>
          )}

          {/* Run List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="loading-dots mb-4">
                <div className="loading-dot"></div>
                <div className="loading-dot"></div>
                <div className="loading-dot"></div>
              </div>
              <p className="text-gray-600">Loading test runs...</p>
            </div>
          ) : filteredAndSortedRuns.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <div className="text-6xl mb-4"><Inbox size={56} className="inline text-gray-400"/></div>
              <h3 className="text-xl mb-2">
                {searchTerm || statusFilter !== 'all' ? 'No matching runs found' : 'No test runs yet'}
              </h3>
              <p className="mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria'
                  : 'Start your first test from the dashboard to see results here'
                }
              </p>
              {(!searchTerm && statusFilter === 'all') && (
                <a href="/" className="btn btn-primary flex items-center gap-2">
                  <Zap size={16}/>
                  Start Testing
                </a>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAndSortedRuns.map(run => (
                <div key={run.runId} className="glass rounded-lg p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center text-white">
                        <Globe size={18} />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-lg mb-1">{getUrlDomain(run.url)}</div>
                        <div className="text-gray-600 text-sm mb-1">{run.url}</div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock size={14} className="text-gray-500" />
                            {formatDate(run.timestamp)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Hash size={14} className="text-gray-500" />
                            {run.runId.slice(-8)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {run.status === 'completed' && (
                        <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          {getSuccessRate(run.testsPassed, run.testsFailed)}% success
                        </div>
                      )}
                      {getStatusBadge(run.status)}
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-xl font-semibold text-gray-700">{run.testsGenerated || 0}</div>
                      <div className="text-xs text-gray-500">Generated</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-xl font-semibold text-green-600">{run.testsPassed || 0}</div>
                      <div className="text-xs text-green-600">Passed</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <div className="text-xl font-semibold text-red-600">{run.testsFailed || 0}</div>
                      <div className="text-xs text-red-600">Failed</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-xl font-semibold text-blue-600">{run.duration || 'N/A'}</div>
                      <div className="text-xs text-blue-600">Duration</div>
                    </div>
                  </div>

                  {/* Progress Bar for Completed Runs */}
                  {run.status === 'completed' && (run.testsPassed || 0) + (run.testsFailed || 0) > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Test Results</span>
                        <span>{run.testsPassed}/{(run.testsPassed || 0) + (run.testsFailed || 0)} passed</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ 
                            width: `${getSuccessRate(run.testsPassed, run.testsFailed)}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 flex-wrap">
                    <a 
                      href={`/runs/${run.runId}`} 
                      className="btn btn-secondary text-xs px-3 py-1 flex items-center gap-1"
                    >
                      <BarChart3 size={14}/>
                      View Report
                    </a>
                    <a 
                      href={`/runs/${run.runId}#screenshots`} 
                      className="btn btn-secondary text-xs px-3 py-1 flex items-center gap-1"
                    >
                      <Camera size={14}/>
                      Screenshots
                    </a>
                    <button 
                      onClick={() => handleRerun(run)}
                      className="btn btn-secondary text-xs px-3 py-1 flex items-center gap-1"
                    >
                      <RefreshCw size={14}/>
                      Re-run
                    </button>
                    <button 
                      onClick={() => handleDelete(run)}
                      className="btn btn-outline text-xs px-3 py-1 text-gray-500 hover:text-red-500 hover:border-red-300 flex items-center gap-1"
                    >
                      <Trash2 size={14}/>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
