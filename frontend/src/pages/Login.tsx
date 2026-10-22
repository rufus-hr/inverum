import React, { useState } from 'react';
import { Layers, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { getLastTenantSlug } from '../lib/api';

export default function Login() {
  const { login, isLoading, error, clearError } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login({
      tenant_slug: getLastTenantSlug(),
      provider: 'local',
      provider_id: username,
      password,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-10">
          <div className="p-2.5 bg-blue-600 rounded-xl">
            <Layers size={24} className="text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">Inverum</span>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-5">
          <div>
            <h1 className="text-lg font-bold text-white mb-1">Sign in</h1>
            <p className="text-sm text-slate-500">Enter your credentials to continue.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 text-red-400 text-sm px-3 py-2.5 rounded-lg">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
              <button type="button" onClick={clearError} className="ml-auto text-red-600 hover:text-red-400">×</button>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ivan.stimac"
                required
                autoFocus
                autoComplete="username"
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2.5 rounded-lg
                  placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2.5 rounded-lg
                  placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed
              text-white font-semibold text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Signing in...
              </>
            ) : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-600 mt-6">
          Inverum ITAM — {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
