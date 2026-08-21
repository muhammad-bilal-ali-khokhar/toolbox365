'use client'

import { useState, useEffect, useCallback } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Feature {
  day: number
  name: string
  status: string
  date: string
  retries?: number
  duration?: number
  tokensUsed?: number
}

interface GeminiStats {
  tokensUsed: number
  tokenBudget: number
  tokenBudgetRemaining: number
  totalCalls: number
  totalInputTokens: number
  totalOutputTokens: number
  rateLimitedKeys: number
  totalKeys: number
}

interface AdminStatus {
  status: 'idle' | 'running' | 'stopped' | 'rate_limited' | 'completed'
  currentDay: number
  totalFeatures: number
  completedFeatures: number
  failedAttempts: number
  successRate: number
  streak: number
  lastBuildDate: string | null
  lastBuildStatus: string | null
  startDate: string | null
  daysRemaining: number
  currentFeatureDay: number | null
  currentFeatureRetries: number
  rateLimitedUntil: string | null
  apiKeys: { index: number; rateLimitedUntil: string | null }[]
  recentFeatures: Feature[]
  geminiStats: GeminiStats | null
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    running: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    stopped: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    idle: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    rate_limited: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    not_started: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${styles[status] ?? styles.not_started}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
      <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-zinc-600 text-xs mt-1">{sub}</p>}
    </div>
  )
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<AdminStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchStatus = useCallback(async (pwd: string) => {
    try {
      const res = await fetch(`${API}/admin/status`, {
        headers: { 'x-admin-password': pwd },
      })
      if (!res.ok) throw new Error('Unauthorized')
      const data = await res.json()
      setStatus(data)
      setAuthed(true)
      setError('')
    } catch {
      setError('Wrong password or API unavailable')
      setAuthed(false)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await fetchStatus(password)
    setLoading(false)
  }

  const handleStart = async () => {
    setActionLoading(true)
    const res = await fetch(`${API}/admin/start`, {
      method: 'POST',
      headers: { 'x-admin-password': password },
    })
    const data = await res.json()
    setActionMsg(data.message)
    await fetchStatus(password)
    setActionLoading(false)
    setTimeout(() => setActionMsg(''), 6000)
  }

  const handleStop = async () => {
    setActionLoading(true)
    const res = await fetch(`${API}/admin/stop`, {
      method: 'POST',
      headers: { 'x-admin-password': password },
    })
    const data = await res.json()
    setActionMsg(data.message)
    await fetchStatus(password)
    setActionLoading(false)
    setTimeout(() => setActionMsg(''), 6000)
  }

  // Poll every 10 seconds when authed
  useEffect(() => {
    if (!authed) return
    const interval = setInterval(() => fetchStatus(password), 10000)
    return () => clearInterval(interval)
  }, [authed, password, fetchStatus])

  const [deployMsg, setDeployMsg] = useState('')
  const [deployLoading, setDeployLoading] = useState<'web' | 'api' | null>(null)

  const handleDeploy = async (target: 'web' | 'api') => {
    setDeployLoading(target)
    const res = await fetch(`${API}/admin/deploy/${target}`, {
      method: 'POST',
      headers: { 'x-admin-password': password },
    })
    const data = await res.json()
    setDeployMsg(data.message)
    setDeployLoading(null)
    setTimeout(() => setDeployMsg(''), 8000)
  }


  const isRunning = status?.status === 'running'
  const isRateLimited = status?.status === 'rate_limited'

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-black text-white">Admin</h1>
            <p className="text-zinc-500 text-sm mt-1">toolbox365 control panel</p>
          </div>
          <form onSubmit={handleLogin} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <div>
              <label className="text-zinc-400 text-sm block mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Enter admin password"
                autoFocus
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Login'}
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">Admin Dashboard</h1>
            <p className="text-zinc-500 text-sm">toolbox365 — autonomous builder</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchStatus(password)}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 transition-colors"
            >
              ↻ Refresh
            </button>
            <button
              onClick={() => handleDeploy('web')}
              disabled={deployLoading === 'web'}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm text-white font-medium transition-colors disabled:opacity-50"
            >
              {deployLoading === 'web' ? 'Deploying...' : '🌐 Deploy Web'}
            </button>
            <button
              onClick={() => handleDeploy('api')}
              disabled={deployLoading === 'api'}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm text-white font-medium transition-colors disabled:opacity-50"
            >
              {deployLoading === 'api' ? 'Deploying...' : '⚙️ Deploy API'}
            </button>
            {isRunning ? (
              <button
                onClick={handleStop}
                disabled={actionLoading}
                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Stop Builder
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={actionLoading || status?.status === 'completed'}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm text-white font-medium transition-colors disabled:opacity-50"
              >
                ▶ Start Builder
              </button>
            )}
          </div>
        </div>

        {/* Deploy message */}
        {deployMsg && (
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-4 text-violet-300 text-sm">
            {deployMsg}
          </div>
        )}

        {/* Action message */}
        {actionMsg && (
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-indigo-300 text-sm">
            {actionMsg}
          </div>
        )}

        {/* Rate limit warning */}
        {isRateLimited && status?.rateLimitedUntil && (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-300 text-sm space-y-2">
            <div className="flex items-center gap-3">
              <span>⏳</span>
              <span>
                All Gemini API keys rate limited. Builder will auto-resume at{' '}
                <strong>{new Date(status.rateLimitedUntil).toLocaleString()}</strong>
              </span>
            </div>
            {status.apiKeys.length > 0 && (
              <div className="flex gap-3 pl-6">
                {status.apiKeys.map((k) => (
                  <span
                    key={k.index}
                    className={`px-2 py-0.5 rounded-full text-xs border font-medium ${
                      k.rateLimitedUntil
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    Key {k.index + 1}: {k.rateLimitedUntil ? 'limited' : 'ok'}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Currently building */}
        {isRunning && status?.currentFeatureDay && (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-blue-300 text-sm flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
            <span>
              Building Day <strong>{status.currentFeatureDay}</strong>
              {status.currentFeatureRetries > 0 && (
                <> — retry {status.currentFeatureRetries} / 5</>
              )}
            </span>
          </div>
        )}

        {status && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Status" value={status.status.replace('_', ' ')} sub={isRunning ? 'Active on GitHub Actions' : undefined} />
              <StatCard label="Features Built" value={`${status.completedFeatures} / ${status.totalFeatures}`} sub={`${status.successRate}% success rate`} />
              <StatCard label="🔥 Streak" value={status.streak} sub="consecutive days" />
              <StatCard label="Failed Attempts" value={status.failedAttempts} sub="total build failures" />
            </div>

            {/* Gemini API Usage */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-zinc-400 text-xs uppercase tracking-widest">Gemini API Usage</h2>
                <span className="text-zinc-600 text-xs">per GitHub Actions run</span>
              </div>
              {status.geminiStats ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Token Budget</span>
                      <span className="text-zinc-300">
                        ~{status.geminiStats.tokensUsed.toLocaleString()} / {status.geminiStats.tokenBudget.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          status.geminiStats.tokensUsed / status.geminiStats.tokenBudget > 0.8
                            ? 'bg-red-500'
                            : status.geminiStats.tokensUsed / status.geminiStats.tokenBudget > 0.5
                            ? 'bg-yellow-500'
                            : 'bg-indigo-500'
                        }`}
                        style={{ width: `${Math.min(100, (status.geminiStats.tokensUsed / status.geminiStats.tokenBudget) * 100)}%` }}
                      />
                    </div>
                    <p className="text-zinc-600 text-xs">
                      ~{status.geminiStats.tokenBudgetRemaining.toLocaleString()} tokens remaining
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-zinc-800/50 p-3 text-center">
                      <p className="text-xl font-bold text-white">{status.geminiStats.totalCalls}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">API Calls</p>
                    </div>
                    <div className="rounded-xl bg-zinc-800/50 p-3 text-center">
                      <p className="text-xl font-bold text-white">~{status.geminiStats.totalInputTokens.toLocaleString()}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">Input Tokens</p>
                    </div>
                    <div className="rounded-xl bg-zinc-800/50 p-3 text-center">
                      <p className="text-xl font-bold text-white">~{status.geminiStats.totalOutputTokens.toLocaleString()}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">Output Tokens</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-zinc-600 text-sm py-4 text-center">No data yet — stats appear after the first build run.</p>
              )}

              {/* API Key Health — always visible */}
              {status.apiKeys.length > 0 && (
                <div className="pt-2 border-t border-zinc-800 space-y-2">
                  <p className="text-zinc-500 text-xs uppercase tracking-widest">API Key Health</p>
                  <div className="flex gap-2">
                    {status.apiKeys.map((k) => (
                      <div
                        key={k.index}
                        className={`flex-1 rounded-lg p-3 border text-center ${
                          k.rateLimitedUntil
                            ? 'bg-red-500/10 border-red-500/20'
                            : 'bg-emerald-500/10 border-emerald-500/20'
                        }`}
                      >
                        <p className={`text-sm font-medium ${
                          k.rateLimitedUntil ? 'text-red-400' : 'text-emerald-400'
                        }`}>
                          Key {k.index + 1}
                        </p>
                        <p className={`text-xs mt-0.5 ${
                          k.rateLimitedUntil ? 'text-red-500' : 'text-emerald-600'
                        }`}>
                          {k.rateLimitedUntil
                            ? `limited until ${new Date(k.rateLimitedUntil).toLocaleTimeString()}`
                            : 'healthy'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Overall Progress</span>
                <span className="text-zinc-400">{status.completedFeatures} / {status.totalFeatures}</span>
              </div>
              <div className="h-3 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                  style={{ width: `${(status.completedFeatures / status.totalFeatures) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-zinc-600">
                <span>Started: {status.startDate ? new Date(status.startDate).toLocaleDateString() : '—'}</span>
                <span>Last build: {status.lastBuildDate ? new Date(status.lastBuildDate).toLocaleString() : '—'}</span>
                <span>Status: <StatusBadge status={status.lastBuildStatus ?? 'not_started'} /></span>
              </div>
            </div>

            {/* Recent Builds */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-zinc-400 text-xs uppercase tracking-widest mb-4">Recent Builds</h2>
              {status.recentFeatures.length === 0 ? (
                <p className="text-zinc-600 text-sm text-center py-8">No builds yet. Press Start to begin.</p>
              ) : (
                <div className="space-y-2">
                  {status.recentFeatures.map((f) => (
                    <div key={f.day} className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
                      <div className="flex items-center gap-4">
                        <span className="text-zinc-600 text-xs font-mono w-12">Day {String(f.day).padStart(3, '0')}</span>
                        <span className="text-zinc-200 text-sm">{f.name.split('|')[2]?.trim() ?? f.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        {f.retries != null && f.retries > 0 && (
                          <span className="text-zinc-600 text-xs">{f.retries} retries</span>
                        )}
                        {f.duration != null && (
                          <span className="text-zinc-600 text-xs">{f.duration}s</span>
                        )}
                        {f.tokensUsed != null && (
                          <span className="text-zinc-600 text-xs">~{f.tokensUsed.toLocaleString()} tok</span>
                        )}
                        <span className="text-zinc-600 text-xs">{new Date(f.date).toLocaleDateString()}</span>
                        <StatusBadge status={f.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Links */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-zinc-400 text-xs uppercase tracking-widest mb-4">Quick Links</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: '📦 GitHub Repo', url: 'https://github.com/muhammad-bilal-ali-khokhar/toolbox365' },
                  { label: '⚙️ GitHub Actions', url: 'https://github.com/muhammad-bilal-ali-khokhar/toolbox365/actions' },
                  { label: '🚀 Vercel Dashboard', url: 'https://vercel.com/dashboard' },
                  { label: '🤖 Gemini Console', url: 'https://aistudio.google.com' },
                ].map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-zinc-800 hover:bg-zinc-700 p-4 text-sm text-zinc-300 transition-colors text-center"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
