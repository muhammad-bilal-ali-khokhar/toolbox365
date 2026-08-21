import { Injectable } from '@nestjs/common'

const GITHUB_REPO = 'muhammad-bilal-ali-khokhar/toolbox365'
const PROGRESS_FILE = 'features/progress.json'
const GITHUB_API = 'https://api.github.com'

@Injectable()
export class AdminService {
  private get token(): string {
    return process.env.GITHUB_TOKEN ?? ''
  }

  private async githubGet(path: string) {
    const res = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/contents/${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
      },
    })
    if (!res.ok) throw new Error(`GitHub GET failed: ${res.status} ${await res.text()}`)
    return res.json()
  }

  private async readProgress() {
    const data = await this.githubGet(PROGRESS_FILE)
    const content = Buffer.from(data.content, 'base64').toString('utf-8')
    return { progress: JSON.parse(content), sha: data.sha as string }
  }

  private async writeProgress(progress: Record<string, unknown>, sha: string) {
    const content = Buffer.from(JSON.stringify(progress, null, 2)).toString('base64')
    const res = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/contents/${PROGRESS_FILE}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `chore: update builder status to "${progress.status}"`,
        content,
        sha,
      }),
    })
    if (!res.ok) throw new Error(`GitHub PUT failed: ${res.status} ${await res.text()}`)
  }

  async getFullStatus() {
    try {
      const { progress } = await this.readProgress()
      const features = progress.features ?? []
      const completed = features.filter((f: { status: string }) => f.status === 'completed').length
      const failed = features.filter((f: { status: string }) => f.status === 'failed').length
      const successRate = features.length > 0 ? Math.round((completed / features.length) * 100) : 0

      let streak = 0
      const sorted = [...features].sort((a: { day: number }, b: { day: number }) => b.day - a.day)
      for (const f of sorted) {
        if ((f as { status: string }).status === 'completed') streak++
        else break
      }

      return {
        status: progress.status ?? 'idle',
        currentDay: progress.currentDay,
        totalFeatures: progress.totalFeatures,
        completedFeatures: completed,
        failedAttempts: failed,
        successRate,
        streak,
        lastBuildDate: progress.lastBuildDate,
        lastBuildStatus: progress.lastBuildStatus,
        startDate: progress.startDate,
        daysRemaining: progress.totalFeatures - progress.currentDay,
        currentFeatureDay: progress.currentFeatureDay ?? null,
        currentFeatureRetries: progress.currentFeatureRetries ?? 0,
        rateLimitedUntil: progress.rateLimitedUntil ?? null,
        apiKeys: progress.apiKeys ?? [],
        recentFeatures: sorted.slice(0, 10),
        allFeatures: sorted,
        geminiStats: progress.geminiStats ?? null,
        currentFeatureName: progress.currentFeatureName ?? null,
      }
    } catch {
      return {
        status: 'idle',
        currentDay: 0,
        totalFeatures: 365,
        completedFeatures: 0,
        failedAttempts: 0,
        successRate: 0,
        streak: 0,
        lastBuildDate: null,
        lastBuildStatus: null,
        startDate: null,
        daysRemaining: 365,
        currentFeatureDay: null,
        currentFeatureRetries: 0,
        rateLimitedUntil: null,
        apiKeys: [],
        recentFeatures: [],
        allFeatures: [],
        geminiStats: null,
        currentFeatureName: null,
      }
    }
  }

  async start() {
    try {
      const { progress, sha } = await this.readProgress()
      if (progress.status === 'running') {
        return { message: 'Builder is already running.' }
      }
      progress.status = 'running'
      progress.rateLimitedUntil = null
      if (!progress.startDate) progress.startDate = new Date().toISOString()
      await this.writeProgress(progress, sha)
      await this.triggerWorkflow('daily-builder.yml')
      return {
        message: 'Builder started. GitHub Actions workflow triggered now.',
        actionsUrl: 'https://github.com/muhammad-bilal-ali-khokhar/toolbox365/actions/workflows/daily-builder.yml',
      }
    } catch (err) {
      console.error('start() error:', err)
      return { message: 'Failed to start builder.' }
    }
  }

  private async triggerWorkflow(workflow: string) {
    const res = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/actions/workflows/${workflow}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    })
    if (!res.ok) throw new Error(`GitHub workflow trigger failed: ${res.status} ${await res.text()}`)
  }

  async deployWeb() {
    try {
      await this.triggerWorkflow('deploy-web.yml')
      return { message: 'Web deployment started. Check GitHub Actions for progress.', url: 'https://github.com/muhammad-bilal-ali-khokhar/toolbox365/actions/workflows/deploy-web.yml' }
    } catch (err) {
      console.error('deployWeb() error:', err)
      return { message: 'Failed to trigger web deployment.' }
    }
  }

  async deployApi() {
    try {
      await this.triggerWorkflow('deploy-api.yml')
      return { message: 'API deployment started. Check GitHub Actions for progress.', url: 'https://github.com/muhammad-bilal-ali-khokhar/toolbox365/actions/workflows/deploy-api.yml' }
    } catch (err) {
      console.error('deployApi() error:', err)
      return { message: 'Failed to trigger API deployment.' }
    }
  }

  async stop() {
    try {
      const { progress, sha } = await this.readProgress()
      progress.status = 'stopped'
      await this.writeProgress(progress, sha)
      return { message: 'Builder stopped. It will halt after the current feature attempt completes.' }
    } catch (err) {
      console.error('stop() error:', err)
      return { message: 'Failed to stop builder.' }
    }
  }
}
