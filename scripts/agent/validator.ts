import { execSync } from 'child_process'

interface ValidationResult {
  success: boolean
  errors: string
}

function run(cmd: string): ValidationResult {
  try {
    execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    return { success: true, errors: '' }
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string }
    const errors = [error.stdout, error.stderr, error.message].filter(Boolean).join('\n')
    return { success: false, errors }
  }
}

export function runLint(): ValidationResult {
  return run('npm run lint --workspaces --if-present')
}

export function runTests(): ValidationResult {
  return run('npm run test --workspaces --if-present')
}

export function runBuild(): ValidationResult {
  return run('npm run build --workspaces --if-present')
}
