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
  currentFeatureName: string | null
  currentFeatureRetries: number
  rateLimitedUntil: string | null
  apiKeys: { index: number; rateLimitedUntil: string | null }[]
  recentFeatures: Feature[]
  allFeatures: Feature[]
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
      {status.replace(/_/g, ' ')}
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

function ProgressRing({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#27272a" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.7s ease' }}
      />
    </svg>
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
  const [showAllFeatures, setShowAllFeatures] = useState(false)
  const [deployMsg, setDeployMsg] = useState('')
  const [deployLoading, setDeployLoading] = useState<'web' | 'api' | null>(null)

  const fetchStatus = useCallback(async (pwd: string) => {
    try {
      const res = await fetch(`${API}/admin/status`, {
        headers: { 'x-admin-password': pwd },
      })
      if (res.status === 401) {
        setError('Wrong password')
        setAuthed(false)
        return
      }
      if (!res.ok) {
        setError(`API error: ${res.status} ${res.statusText}`)
        setAuthed(false)
        return
      }
      const data = await res.json()
      setStatus(data)
      setAuthed(true)
      setError('')
    } catch {
      setError('Cannot reach API — check CORS or network')
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
    const res = await fetch(`${API}/admin/start`, { method: 'POST', headers: { 'x-admin-password': password } })
    const data = await res.json()
    setActionMsg(data.message)
    await fetchStatus(password)
    setActionLoading(false)
    setTimeout(() => setActionMsg(''), 6000)
  }

  const handleStop = async () => {
    setActionLoading(true)
    const res = await fetch(`${API}/admin/stop`, { method: 'POST', headers: { 'x-admin-password': password } })
    const data = await res.json()
    setActionMsg(data.message)
    await fetchStatus(password)
    setActionLoading(false)
    setTimeout(() => setActionMsg(''), 6000)
  }

  const handleDeploy = async (target: 'web' | 'api') => {
    setDeployLoading(target)
    const res = await fetch(`${API}/admin/deploy/${target}`, { method: 'POST', headers: { 'x-admin-password': password } })
    const data = await res.json()
    setDeployMsg(data.message)
    setDeployLoading(null)
    setTimeout(() => setDeployMsg(''), 8000)
  }

  useEffect(() => {
    if (!authed) return
    const interval = setInterval(() => fetchStatus(password), 10000)
    return () => clearInterval(interval)
  }, [authed, password, fetchStatus])

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

  const buildPct = status ? Math.round((status.completedFeatures / status.totalFeatures) * 100) : 0
  const tokenPct = status?.geminiStats
    ? Math.min(100, Math.round((status.geminiStats.tokensUsed / status.geminiStats.tokenBudget) * 100))
    : 0
  const tokenColor = tokenPct > 80 ? '#ef4444' : tokenPct > 50 ? '#eab308' : '#6366f1'

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white">Admin Dashboard</h1>
            <p className="text-zinc-500 text-sm">toolbox365 — autonomous builder</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => fetchStatus(password)} className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 transition-colors">
              ↻ Refresh
            </button>
            <button onClick={() => handleDeploy('web')} disabled={deployLoading === 'web'} className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm text-white font-medium transition-colors disabled:opacity-50">
              {deployLoading === 'web' ? 'Deploying...' : '🌐 Deploy Web'}
            </button>
            <button onClick={() => handleDeploy('api')} disabled={deployLoading === 'api'} className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm text-white font-medium transition-colors disabled:opacity-50">
              {deployLoading === 'api' ? 'Deploying...' : '⚙️ Deploy API'}
            </button>
            {isRunning ? (
              <button onClick={handleStop} disabled={actionLoading} className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Stop Builder
              </button>
            ) : (
              <button onClick={handleStart} disabled={actionLoading || status?.status === 'completed'} className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm text-white font-medium transition-colors disabled:opacity-50">
                ▶ Start Builder
              </button>
            )}
          </div>
        </div>

        {deployMsg && <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-4 text-violet-300 text-sm">{deployMsg}</div>}
        {actionMsg && <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-indigo-300 text-sm">{actionMsg}</div>}

        {/* Rate limit warning */}
        {isRateLimited && status?.rateLimitedUntil && (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-300 text-sm space-y-2">
            <div className="flex items-center gap-3">
              <span>⏳</span>
              <span>All Gemini API keys rate limited. Builder will auto-resume at <strong>{new Date(status.rateLimitedUntil).toLocaleString()}</strong></span>
            </div>
          </div>
        )}

        {/* Currently building */}
        {isRunning && status?.currentFeatureDay && (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-blue-300 text-sm flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
            <span>
              Building Day <strong>{status.currentFeatureDay}</strong>
              {status.currentFeatureName && <> — <strong>{status.currentFeatureName}</strong></>}
            </span>
          </div>
        )}

        {status && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Status" value={status.status.replace(/_/g, ' ')} sub={isRunning ? 'Active on GitHub Actions' : undefined} />
              <StatCard label="Features Built" value={`${status.completedFeatures} / ${status.totalFeatures}`} sub={`${status.successRate}% success rate`} />
              <StatCard label="🔥 Streak" value={status.streak} sub="consecutive days" />
              <StatCard label="Failed Attempts" value={status.failedAttempts} sub="total build failures" />
            </div>

            {/* Progress + Token rings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Build Progress */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 flex items-center gap-6">
                <div className="relative flex-shrink-0">
                  <ProgressRing pct={buildPct} color="#6366f1" size={88} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">{buildPct}%</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-zinc-400 text-xs uppercase tracking-widest">Build Progress</p>
                  <p className="text-white text-2xl font-bold">{status.completedFeatures} <span className="text-zinc-500 text-base font-normal">/ {status.totalFeatures} features</span></p>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500 transition-all duration-700" style={{ width: `${buildPct}%` }} />
                  </div>
                  <p className="text-zinc-600 text-xs">{status.daysRemaining} days remaining</p>
                </div>
              </div>

              {/* Gemini Token Usage */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 flex items-center gap-6">
                <div className="relative flex-shrink-0">
                  <ProgressRing pct={tokenPct} color={tokenColor} size={88} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">{tokenPct}%</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-zinc-400 text-xs uppercase tracking-widest">Gemini Token Budget</p>
                  {status.geminiStats ? (
                    <>
                      <p className="text-white text-2xl font-bold">
                        ~{status.geminiStats.tokensUsed.toLocaleString()}
                        <span className="text-zinc-500 text-base font-normal"> / {status.geminiStats.tokenBudget.toLocaleString()}</span>
                      </p>
                      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${tokenPct}%`, backgroundColor: tokenColor }}
                        />
                      </div>
                      <div className="flex gap-4 text-xs text-zinc-500">
                        <span>{status.geminiStats.totalCalls} calls</span>
                        <span>~{status.geminiStats.totalInputTokens.toLocaleString()} in</span>
                        <span>~{status.geminiStats.totalOutputTokens.toLocaleString()} out</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-zinc-600 text-sm">No data yet — appears after first build run.</p>
                  )}
                </div>
              </div>
            </div>

            {/* API Key Health */}
            {status.apiKeys.length > 0 && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-3">
                <p className="text-zinc-400 text-xs uppercase tracking-widest">API Key Health</p>
                <div className="flex gap-3">
                  {status.apiKeys.map((k) => (
                    <div key={k.index} className={`flex-1 rounded-lg p-3 border text-center ${k.rateLimitedUntil ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                      <p className={`text-sm font-medium ${k.rateLimitedUntil ? 'text-red-400' : 'text-emerald-400'}`}>Key {k.index + 1}</p>
                      <p className={`text-xs mt-0.5 ${k.rateLimitedUntil ? 'text-red-500' : 'text-emerald-600'}`}>
                        {k.rateLimitedUntil ? `limited until ${new Date(k.rateLimitedUntil).toLocaleTimeString()}` : 'healthy'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Features List */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-zinc-400 text-xs uppercase tracking-widest">
                  Features {status.allFeatures?.length > 0 && `(${status.allFeatures.length} built)`}
                </h2>
                {status.allFeatures?.length > 5 && (
                  <button onClick={() => setShowAllFeatures(!showAllFeatures)} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                    {showAllFeatures ? 'Show less ↑' : `Show all ${status.allFeatures.length} ↓`}
                  </button>
                )}
              </div>
              {!status.allFeatures?.length ? (
                <p className="text-zinc-600 text-sm text-center py-8">No builds yet. Press Start to begin.</p>
              ) : (
                <div className="space-y-1">
                  {(showAllFeatures ? status.allFeatures : status.allFeatures.slice(0, 10)).map((f) => (
                    <div key={f.day} className="flex items-center justify-between py-2.5 border-b border-zinc-800/60 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-zinc-600 text-xs font-mono w-14 flex-shrink-0">Day {String(f.day).padStart(3, '0')}</span>
                        <span className="text-zinc-200 text-sm truncate">{f.name.split('|')[2]?.trim() ?? f.name}</span>
                        {f.name.split('|')[3]?.trim() && (
                          <span className="text-zinc-600 text-xs hidden md:inline flex-shrink-0">{f.name.split('|')[3].trim()}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        {f.duration != null && <span className="text-zinc-600 text-xs">{f.duration}s</span>}
                        {f.tokensUsed != null && <span className="text-zinc-600 text-xs hidden sm:inline">~{f.tokensUsed.toLocaleString()} tok</span>}
                        <span className="text-zinc-600 text-xs hidden sm:inline">{new Date(f.date).toLocaleDateString()}</span>
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
                  <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-zinc-800 hover:bg-zinc-700 p-4 text-sm text-zinc-300 transition-colors text-center">
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
