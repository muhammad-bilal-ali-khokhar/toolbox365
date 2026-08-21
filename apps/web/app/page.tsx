'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Feature {
  day: number
  name: string
  status: string
  date: string
}

interface Progress {
  status: string
  currentDay: number
  totalFeatures: number
  completedFeatures: number
  successRate: number
  daysRemaining: number
  lastBuildDate: string | null
  allFeatures: Feature[]
}

export default function Home() {
  const [data, setData] = useState<Progress | null>(null)

  useEffect(() => {
    fetch(`${API}/admin/public/progress`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => null)
  }, [])

  const completed = data?.completedFeatures ?? 0
  const total = data?.totalFeatures ?? 365
  const pct = Math.round((completed / total) * 100)
  const statusLabel =
    data?.status === 'running' ? 'Building...' :
    data?.status === 'completed' ? '🎉 Complete!' :
    data?.status === 'stopped' ? 'Paused' :
    data?.status === 'rate_limited' ? 'Rate limited' :
    'Starting soon'

  const statusColor =
    data?.status === 'running' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
    data?.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
    'bg-zinc-800 text-zinc-400 border-zinc-700'

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl space-y-10">

        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-7xl font-black tracking-tight text-white">365</h1>
          <p className="text-zinc-400 text-lg">365 days. 365 features. Built autonomously by AI.</p>
        </div>

        {/* Status Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-zinc-500 text-sm uppercase tracking-widest">Current Day</p>
              <p className="text-4xl font-bold text-white mt-1">Day {data?.currentDay ?? 0}</p>
            </div>
            <div className="text-right">
              <p className="text-zinc-500 text-sm uppercase tracking-widest">Status</p>
              <span className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium border ${statusColor}`}>
                {data ? statusLabel : 'Loading...'}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-zinc-500">
              <span>Progress</span>
              <span>{completed} / {total}</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-zinc-600 text-xs text-right">{pct}% complete</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            {[
              { label: 'Features Built', value: completed.toString() },
              { label: 'Days Remaining', value: (data?.daysRemaining ?? 365).toString() },
              { label: 'Success Rate', value: data ? `${data.successRate}%` : '—' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-zinc-800/50 p-4 text-center">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-zinc-500 text-xs mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Features Grid */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
          <h2 className="text-zinc-400 text-sm uppercase tracking-widest mb-6">Features</h2>
          {!data || data.allFeatures?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="text-5xl">🚀</div>
              <p className="text-zinc-500 text-center">No features built yet.</p>
              <p className="text-zinc-600 text-sm text-center">
                The autonomous builder will add one feature every day starting on Day 1.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {data.allFeatures.map((f) => (
                <div key={f.day} className="flex items-center justify-between py-2.5 border-b border-zinc-800/60 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-600 text-xs font-mono w-14">Day {String(f.day).padStart(3, '0')}</span>
                    <Link
                      href={`/tools/${f.name.split('|')[2]?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ?? `day-${f.day}`}`}
                      className="text-zinc-200 text-sm hover:text-indigo-400 transition-colors"
                    >
                      {f.name.split('|')[2]?.trim() ?? f.name}
                    </Link>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${
                    f.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {f.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center space-y-2">
          <a
            href="https://github.com/muhammad-bilal-ali-khokhar/toolbox365"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            View on GitHub
          </a>
        </div>

      </div>
    </main>
  )
}
