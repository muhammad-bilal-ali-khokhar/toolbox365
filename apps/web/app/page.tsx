export default function Home() {
  const progress = 0
  const total = 365

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
              <p className="text-4xl font-bold text-white mt-1">Day 0</p>
            </div>
            <div className="text-right">
              <p className="text-zinc-500 text-sm uppercase tracking-widest">Status</p>
              <span className="inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                Challenge not started
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-zinc-500">
              <span>Progress</span>
              <span>{progress} / {total}</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${(progress / total) * 100}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            {[
              { label: 'Features Built', value: '0' },
              { label: 'Days Remaining', value: '365' },
              { label: 'Success Rate', value: '—' },
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
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="text-5xl">🚀</div>
            <p className="text-zinc-500 text-center">No features built yet.</p>
            <p className="text-zinc-600 text-sm text-center">
              The autonomous builder will add one feature every day starting on Day 1.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-2">
          <a
            href="https://github.com"
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
