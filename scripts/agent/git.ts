import { execSync } from 'child_process'

function exec(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}

export function getCurrentBranch(): string {
  return exec('git rev-parse --abbrev-ref HEAD')
}

export function commitChanges(message: string): void {
  exec('git config user.email "muhammad.bilal@toolbox365.dev"')
  exec('git config user.name "Muhammad Bilal Ali Khokhar"')
  exec('git add -A')
  // Only commit if there are actual changes
  try {
    exec(`git commit -m "${message.replace(/"/g, "'")}"`)
  } catch {
    // Nothing to commit — that's fine
    console.log('  Nothing to commit, skipping.')
  }
}

export function pushChanges(): void {
  const branch = getCurrentBranch()
  try {
    // Pull with rebase first to avoid diverged branch errors
    exec(`git pull --rebase origin ${branch}`)
    exec(`git push origin ${branch}`)
  } catch (err) {
    console.error('  Push failed, retrying once...', err instanceof Error ? err.message : err)
    try {
      exec(`git pull --rebase origin ${branch}`)
      exec(`git push origin ${branch}`)
    } catch (retryErr) {
      console.error('  Push retry failed:', retryErr instanceof Error ? retryErr.message : retryErr)
      // Don't crash the builder — state is saved in progress.json locally
      // Next job will push it
    }
  }
}
