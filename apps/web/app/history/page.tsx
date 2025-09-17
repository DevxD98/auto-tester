'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ClipboardList, 
  Clock, 
  Globe, 
  Hash, 
  RefreshCw, 
  Trash2, 
  FileText, 
  Target, 
  Inbox,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';

interface TestRun {
  id: string;
  name: string;
  url: string;
  status: 'passed' | 'failed' | 'running' | 'pending' | 'completed';
  createdAt: string;
  duration?: number;
  testCount: number;
  passedCount: number;
  failedCount: number;
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchRuns();
  }, []);

  // Helper function to parse duration string to seconds
  const parseDuration = (durationStr: string) => {
    if (!durationStr) return 0;
    const match = durationStr.match(/(?:(\d+)m\s*)?(\d+)s/);
    if (!match) return 0;
    const minutes = parseInt(match[1] || '0');
    const seconds = parseInt(match[2] || '0');
    return minutes * 60 + seconds;
  };

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/run');
      if (!response.ok) throw new Error('Failed to fetch runs');
      const data = await response.json();
      // Transform API response to match frontend interface
      const runsArray = Array.isArray(data.runs) ? data.runs.map((run: any) => ({
        id: run.runId,
        name: `Test Run ${run.runId.slice(0, 8)}`,
        url: run.url,
        status: run.status,
        createdAt: run.timestamp,
        duration: parseDuration(run.duration),
        testCount: run.testsGenerated || 0,
        passedCount: run.testsPassed || 0,
        failedCount: run.testsFailed || 0
      })) : [];
      setRuns(runsArray);
    } catch (error) {
      console.error('Error fetching runs:', error);
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchRuns();
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/run/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete run');
      if (Array.isArray(runs)) {
        setRuns(runs.filter(run => run.id !== id));
      }
    } catch (error) {
      console.error('Error deleting run:', error);
    }
  };

  // Filter runs
  const filteredRuns = Array.isArray(runs) ? runs.filter(run => {
    if (statusFilter !== 'all' && run.status !== statusFilter) {
      return false;
    }
    
    const searchLower = searchTerm.toLowerCase();
    return (
      run.id.toLowerCase().includes(searchLower) ||
      run.status.toLowerCase().includes(searchLower) ||
      run.name.toLowerCase().includes(searchLower) ||
      run.url.toLowerCase().includes(searchLower)
    );
  }) : [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': 
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running': return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'pending': return <Clock className="w-5 h-5 text-yellow-500" />;
      default: return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': 
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      case 'running': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCardColor = (status: string) => {
    switch (status) {
      case 'passed': 
      case 'completed': return 'bg-white border-green-200 shadow-green-100/50 border-l-4 border-l-green-400';
      case 'failed': return 'bg-white border-red-200 shadow-red-100/50 border-l-4 border-l-red-400';
      case 'running': return 'bg-white border-blue-200 shadow-blue-100/50 border-l-4 border-l-blue-400';
      case 'pending': return 'bg-white border-yellow-200 shadow-yellow-100/50 border-l-4 border-l-yellow-400';
      default: return 'bg-white border-gray-200 shadow-gray-100/50 border-l-4 border-l-gray-400';
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <ClipboardList className="w-8 h-8 text-blue-600" />
                Test Run History
              </h1>
              <p className="text-gray-600 mt-2">
                View and manage your automated test runs with detailed insights and reports.
              </p>
            </div>
            <button 
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by test name or URL..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
            />
          </div>
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
            >
              <option value="all">All Status</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Test Runs Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading test runs...</span>
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border-2 border-gray-200 shadow-lg">
            <Inbox className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">No test runs found</h3>
            <p className="text-sm text-gray-600">
              {runs.length === 0 
                ? "You haven't created any test runs yet." 
                : "No test runs match your current filters."
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRuns.map((run) => (
              <div key={run.id} className={`rounded-xl shadow-lg border-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 ${getCardColor(run.status)}`}>
                <div className="p-4">
                  {/* Header with Status and Delete */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(run.status)}
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(run.status)}`}>
                        {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(run.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-white/50"
                      title="Delete test run"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Test Name */}
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm truncate" title={run.name}>
                    {run.name}
                  </h3>

                  {/* URL */}
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                    <Globe className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate" title={run.url}>{run.url}</span>
                  </div>

                  {/* Tests and Duration in single line */}
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-3">
                    <span className="flex items-center gap-1">
                      <span className="font-medium text-gray-900">{run.testCount}</span> tests
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span className="font-medium text-gray-900">{formatDuration(run.duration)}</span>
                    </span>
                  </div>

                  {/* Success Rate Progress Bar */}
                  {run.testCount > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Success Rate</span>
                        <span className="font-medium">{Math.round((run.passedCount / run.testCount) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-200/50 rounded-full h-1.5">
                        <div 
                          className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${(run.passedCount / run.testCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Footer with Date and ID */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>{formatDate(run.createdAt)}</span>
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      {run.id.slice(0, 8)}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Link
                      href={`/runs/${run.id}`}
                      className="flex-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-all text-center text-xs font-medium flex items-center justify-center gap-1 border border-blue-200"
                    >
                      <Target className="w-3 h-3" />
                      Details
                    </Link>
                    <Link
                      href={`/runs/${run.id}/report`}
                      className="flex-1 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 transition-all text-center text-xs font-medium flex items-center justify-center gap-1 border border-gray-200"
                    >
                      <FileText className="w-3 h-3" />
                      Report
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
