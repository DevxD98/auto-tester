"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');

  const handleStartTest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('Test started', url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-6 shadow-lg">
            <Rocket className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-800 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-4">
            AI-Powered Web Testing
          </h1>
        </div>
        
        <form onSubmit={handleStartTest}>
          <input 
            type="url" 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter website URL"
          />
          <button type="submit">Start Test</button>
        </form>
      </div>
    </div>
  );
}