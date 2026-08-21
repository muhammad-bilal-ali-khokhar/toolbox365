import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { generateFeature, getTokensUsed, getGeminiStats, AllKeysRateLimitedError, getRateLimitedKeyCount, getTotalKeyCount } from './gemini'
import { commitChanges, pushChanges } from './git'

const ROOT = join(__dirname, '../../')
const FEATURES_MD = join(ROOT, 'features/FEATURES.md')
const PROGRESS_JSON = join(ROOT, 'features/progress.json')
// One feature per run — no retries, no fix attempts, no validation

interface ApiKeyStatus {
  index: number
  rateLimitedUntil: string | null
}

interface FeatureEntry {
  day: number
  name: string
  status: string
  date: string
  retries?: number
  duration?: number
  tokensUsed?: number
}

interface Progress {
  status: 'idle' | 'running' | 'stopped' | 'rate_limited' | 'completed'
  currentDay: number
  totalFeatures: number
  completedFeatures: number
  failedAttempts: number
  lastBuildDate: string | null
  lastBuildStatus: string | null
  startDate: string | null
  currentFeatureDay: number | null
  currentFeatureRetries: number
  rateLimitedUntil: string | null
  apiKeys: ApiKeyStatus[]
  features: FeatureEntry[]
}

function readProgress(): Progress {
  return JSON.parse(readFileSync(PROGRESS_JSON, 'utf-8'))
}

function writeProgress(progress: Progress): void {
  writeFileSync(PROGRESS_JSON, JSON.stringify(progress, null, 2))
}

function getFeatureLine(day: number): string | null {
  const content = readFileSync(FEATURES_MD, 'utf-8')
  const paddedDay = String(day).padStart(3, '0')
  const lines = content.split('\n')
  return lines.find((l) => l.includes(`| ${paddedDay} |`)) ?? null
}

function applyFileChanges(files: { path: string; content: string }[]): void {
  for (const file of files) {
    const fullPath = join(ROOT, file.path)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, file.content, 'utf-8')
    console.log(`  Written: ${file.path}`)
  }
}

function getRelevantContext(): string {
  const paths = [
    'apps/web/app/page.tsx',
    'apps/web/app/layout.tsx',
    'apps/api/src/app.controller.ts',
    'apps/api/src/app.module.ts',
    'packages/shared/src/types.ts',
  ]
  return paths
    .map((p) => {
      try { return `// ${p}\n${readFileSync(join(ROOT, p), 'utf-8')}` }
      catch { return '' }
    })
    .filter(Boolean)
    .join('\n\n---\n\n')
}

// Generate feature with Gemini — no validation, no fix attempts, no retries
// If it fails, log and move on. Next day = next feature.
async function buildFeature(featureLine: string): Promise<'success' | 'failed' | 'rate_limited'> {
  const context = getRelevantContext()
  console.log(`  Generating feature with Gemini...`)
  try {
    const changes = await generateFeature(featureLine, context)
    // Only apply files scoped to this feature's slug — never touch other days
    const slug = featureLine.split('|')[2]?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ?? `day-${Date.now()}`
    const allowed = [
      `apps/web/app/tools/${slug}/`,
      `apps/api/src/features/${slug}/`,
      `packages/shared/src/`,
    ]
    const scoped = changes.files.filter((f) =>
      allowed.some((prefix) => f.path.startsWith(prefix))
    )
    if (scoped.length === 0) {
      // Gemini returned files outside allowed paths — apply all but warn
      console.log(`  ⚠ No scoped files found, applying all ${changes.files.length} files`)
      applyFileChanges(changes.files)
    } else {
      applyFileChanges(scoped)
    }
    return 'success'
  } catch (err) {
    if (err instanceof AllKeysRateLimitedError) return 'rate_limited'
    console.error('  Gemini generation error:', err)
    return 'failed'
  }
}

async function main() {
  let progress = readProgress()

  if (progress.status === 'stopped') {
    console.log('Builder is stopped. Exiting.')
    return
  }

  if (progress.status === 'rate_limited' && progress.rateLimitedUntil) {
    const until = new Date(progress.rateLimitedUntil).getTime()
    if (Date.now() < until) {
      console.log(`Rate limited until ${progress.rateLimitedUntil}. Exiting.`)
      return
    }
    // Cooldown passed — clear rate limit and resume
    progress.rateLimitedUntil = null
    progress.apiKeys = progress.apiKeys.map((k) => ({ ...k, rateLimitedUntil: null }))
  }

  if (progress.currentDay >= progress.totalFeatures) {
    progress.status = 'completed'
    writeProgress(progress)
    console.log('🎉 All 365 features complete!')
    return
  }

  progress.status = 'running'
  if (!progress.startDate) progress.startDate = new Date().toISOString()
  writeProgress(progress)

  console.log(`\n🚀 365 Builder — one feature per run, no retries`)

  // One feature per run — always the next unbuilt day
  const targetDay = progress.currentDay + 1

  if (targetDay > progress.totalFeatures) {
    progress.status = 'completed'
    writeProgress(progress)
    console.log('🎉 All 365 features complete!')
    return
  }

  const featureLine = getFeatureLine(targetDay)
  if (!featureLine) {
    console.log(`No feature found for Day ${targetDay}. Skipping.`)
    progress.currentDay = targetDay
    writeProgress(progress)
    return
  }

  console.log(`\n📦 Day ${targetDay}: ${featureLine.trim()}`)
  progress.currentFeatureDay = targetDay
  progress.currentFeatureRetries = 0
  writeProgress(progress)

  const buildStart = Date.now()
  const result = await buildFeature(featureLine)
  const now = new Date().toISOString()
  const buildDuration = Math.round((Date.now() - buildStart) / 1000)

  if (result === 'rate_limited') {
    const resumeAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const limitedCount = getRateLimitedKeyCount()
    const totalKeys = getTotalKeyCount()
    progress.status = 'rate_limited'
    progress.rateLimitedUntil = resumeAt
    progress.lastBuildDate = now
    progress.apiKeys = Array.from({ length: totalKeys }, (_, i) => ({
      index: i,
      rateLimitedUntil: i < limitedCount ? resumeAt : null,
    }))
    writeProgress(progress)
    commitChanges(`chore: pause — Gemini rate limited, resume at ${resumeAt}`)
    pushChanges()
    console.log(`⏳ Rate limited. Will resume at ${resumeAt}`)
    return
  }

  // Always advance to next day regardless of success or failure
  progress.currentDay = targetDay
  progress.currentFeatureDay = null
  progress.currentFeatureRetries = 0
  progress.lastBuildDate = now
  progress.geminiStats = getGeminiStats()

  const existing = progress.features.findIndex((f) => f.day === targetDay)
  const featureName = featureLine.split('|')[2]?.trim() ?? 'feature'
  const category = featureLine.split('|')[3]?.trim() ?? ''

  if (result === 'success') {
    progress.completedFeatures += 1
    progress.lastBuildStatus = 'success'
    const entry: FeatureEntry = { day: targetDay, name: featureLine, status: 'completed', date: now, retries: 0, duration: buildDuration, tokensUsed: getGeminiStats().tokensUsed }
    if (existing >= 0) progress.features[existing] = entry
    else progress.features.push(entry)
    writeProgress(progress)
    commitChanges(`feat: day ${String(targetDay).padStart(3, '0')} — ${featureName} (${category})`)
    pushChanges()
    console.log(`✅ Day ${targetDay} done. Tokens: ~${getTokensUsed()}`)
  } else {
    // Failed — log it, push it, move on. No fix. No retry.
    progress.failedAttempts += 1
    progress.lastBuildStatus = 'failed'
    const entry: FeatureEntry = { day: targetDay, name: featureLine, status: 'failed', date: now, retries: 0, duration: buildDuration, tokensUsed: getTokensUsed() }
    if (existing >= 0) progress.features[existing] = entry
    else progress.features.push(entry)
    writeProgress(progress)
    commitChanges(`chore: day ${String(targetDay).padStart(3, '0')} — ${featureName} skipped (build failed, moving on)`)
    pushChanges()
    console.log(`❌ Day ${targetDay} failed. Moving on — next run will build Day ${targetDay + 1}.`)
  }
}

main().catch((err) => {
  console.error('Builder crashed:', err)
  process.exit(1)
})
