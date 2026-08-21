import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { generateFeature, fixError, getTokensUsed, getGeminiStats, AllKeysRateLimitedError, getRateLimitedKeyCount, getTotalKeyCount } from './gemini'
import { commitChanges, pushChanges } from './git'
import { runLint, runTests, runBuild } from './validator'

const ROOT = join(__dirname, '../../')
const FEATURES_MD = join(ROOT, 'features/FEATURES.md')
const PROGRESS_JSON = join(ROOT, 'features/progress.json')
const MAX_RETRIES = 5
// Stop 10 min before GitHub Actions 6h limit to allow final commit/push
const JOB_DEADLINE = Date.now() + 5 * 60 * 60 * 1000 + 50 * 60 * 1000

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Run all validation steps. On failure, ask Gemini to fix then re-validate once.
// Returns 'success' | 'failed' | 'rate_limited'
async function validateAndFix(context: string): Promise<'success' | 'failed' | 'rate_limited'> {
  const steps = [
    { name: 'lint', fn: runLint },
    { name: 'tests', fn: runTests },
    { name: 'build', fn: runBuild },
  ]

  for (const step of steps) {
    console.log(`  Running ${step.name}...`)
    const result = step.fn()
    if (!result.success) {
      console.log(`  ${step.name} failed. Asking Gemini to fix...`)
      try {
        const fix = await fixError(result.errors, context)
        applyFileChanges(fix.files)
        // Re-run the same step after fix to verify it actually fixed it
        const recheck = step.fn()
        if (!recheck.success) {
          console.log(`  ${step.name} still failing after fix.`)
          return 'failed'
        }
      } catch (err) {
        if (err instanceof AllKeysRateLimitedError) return 'rate_limited'
        console.error('  Fix error:', err)
        return 'failed'
      }
    }
  }

  return 'success'
}

async function buildFeature(featureLine: string): Promise<'success' | 'failed' | 'rate_limited'> {
  const context = getRelevantContext()

  // Always re-generate on each attempt — previous attempt's files may be broken
  console.log(`  Generating feature with Gemini...`)
  try {
    const changes = await generateFeature(featureLine, context)
    applyFileChanges(changes.files)
  } catch (err) {
    if (err instanceof AllKeysRateLimitedError) return 'rate_limited'
    console.error('  Gemini generation error:', err)
    return 'failed'
  }

  return validateAndFix(context)
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

  // Resume from saved state or start next feature
  let targetDay = progress.currentFeatureDay ?? progress.currentDay + 1
  let retries = (progress.currentFeatureDay === targetDay) ? progress.currentFeatureRetries : 0

  console.log(`\n🚀 365 Continuous Builder — starting from Day ${targetDay}`)

  while (Date.now() < JOB_DEADLINE) {
    // Re-read on every iteration to catch stop signals written externally
    progress = readProgress()

    if (progress.status === 'stopped') {
      console.log('Stop signal received. Exiting.')
      return
    }

    if (targetDay > progress.totalFeatures) {
      progress.status = 'completed'
      writeProgress(progress)
      console.log('🎉 All 365 features complete!')
      return
    }

    const featureLine = getFeatureLine(targetDay)
    if (!featureLine) {
      console.log(`No feature found for Day ${targetDay}. Skipping.`)
      targetDay++
      retries = 0
      continue
    }

    console.log(`\n📦 Day ${targetDay} (attempt ${retries + 1}/${MAX_RETRIES}): ${featureLine.trim()}`)

    // Persist current working state so dashboard shows live progress
    progress.currentFeatureDay = targetDay
    progress.currentFeatureRetries = retries
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
      progress.currentFeatureRetries = retries
      progress.lastBuildDate = now
      progress.apiKeys = Array.from({ length: totalKeys }, (_, i) => ({
        index: i,
        rateLimitedUntil: i < limitedCount ? resumeAt : null,
      }))
      writeProgress(progress)
      commitChanges(`chore: pause build — Gemini API rate limited, resume at ${resumeAt}`)
      pushChanges()
      console.log(`⏳ All keys rate limited. Will resume at ${resumeAt}`)
      return
    }

    if (result === 'success') {
      progress.currentDay = targetDay
      progress.completedFeatures += 1
      progress.lastBuildDate = now
      progress.lastBuildStatus = 'success'
      progress.currentFeatureDay = null
      progress.currentFeatureRetries = 0

      const existing = progress.features.findIndex((f) => f.day === targetDay)
      const geminiStats = getGeminiStats()
      const entry: FeatureEntry = { day: targetDay, name: featureLine, status: 'completed', date: now, retries, duration: buildDuration, tokensUsed: geminiStats.tokensUsed }
      if (existing >= 0) progress.features[existing] = entry
      else progress.features.push(entry)

      progress.geminiStats = geminiStats
      writeProgress(progress)
      const featureName = featureLine.split('|')[2]?.trim() ?? 'feature'
      const category = featureLine.split('|')[3]?.trim() ?? ''
      commitChanges(`feat: add ${featureName} tool (${category})`)
      pushChanges()
      console.log(`✅ Day ${targetDay} complete! Tokens used: ~${getTokensUsed()}`)

      targetDay++
      retries = 0
    } else {
      retries++
      if (retries >= MAX_RETRIES) {
        console.log(`❌ Day ${targetDay} failed after ${MAX_RETRIES} attempts. Moving on.`)
        progress.failedAttempts += 1
        progress.lastBuildDate = now
        progress.lastBuildStatus = 'failed'
        progress.currentFeatureDay = null
        progress.currentFeatureRetries = 0
        progress.currentDay = targetDay

        const existing = progress.features.findIndex((f) => f.day === targetDay)
        const entry: FeatureEntry = { day: targetDay, name: featureLine, status: 'failed', date: now, retries, duration: buildDuration, tokensUsed: getTokensUsed() }
        if (existing >= 0) progress.features[existing] = entry
        else progress.features.push(entry)

        progress.geminiStats = getGeminiStats()
        writeProgress(progress)
        const failedName = featureLine.split('|')[2]?.trim() ?? 'feature'
        commitChanges(`chore: skip ${failedName} — build failed after ${MAX_RETRIES} attempts`)
        pushChanges()

        targetDay++
        retries = 0
      } else {
        console.log(`  Retrying Day ${targetDay} (attempt ${retries + 1}/${MAX_RETRIES})...`)
        await sleep(3000)
      }
    }
  }

  // Job deadline reached — save state, next cron trigger will continue
  progress = readProgress()
  if (progress.status === 'running') {
    progress.currentFeatureDay = targetDay
    progress.currentFeatureRetries = retries
    writeProgress(progress)
    commitChanges(`chore: save builder checkpoint — resuming next scheduled run`)
    pushChanges()
    console.log('⏱ Job time limit reached. State saved. Next trigger will continue.')
  }
}

main().catch((err) => {
  console.error('Builder crashed:', err)
  process.exit(1)
})
